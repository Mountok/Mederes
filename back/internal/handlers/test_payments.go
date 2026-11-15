package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"medrese-back/internal/middleware"
)

type PaymentHandler struct {
	DB              *sqlx.DB
	Shop, Key, Site string
	Client          *http.Client
}

type paymentPlan struct {
	amount string
	months int
}

var paymentPlans = map[string]paymentPlan{"month": {"499.00", 1}, "half-year": {"2490.00", 6}, "year": {"3990.00", 12}}

type order struct {
	ID       string
	Reader   string `db:"reader_id"`
	Plan     string
	Amount   string
	Months   int
	Provider sql.NullString `db:"provider_id"`
	Status   string
	Created  time.Time `db:"created_at"`
}

type gatewayPayment struct {
	ID        string                           `json:"id"`
	Status    string                           `json:"status"`
	Paid      bool                             `json:"paid"`
	Test      bool                             `json:"test"`
	Amount    struct{ Value, Currency string } `json:"amount"`
	Metadata  map[string]string                `json:"metadata"`
	Recipient struct {
		Account string `json:"account_id"`
	} `json:"recipient"`
	Confirmation struct {
		URL string `json:"confirmation_url"`
	} `json:"confirmation"`
}

func payError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": gin.H{"message": message}})
}

func (h *PaymentHandler) enabled(c *gin.Context) bool {
	c.Header("Cache-Control", "no-store")
	if h.Shop != "" && strings.HasPrefix(h.Key, "test_") && h.Site != "" {
		return true
	}
	payError(c, 503, "Тестовый магазин пока не подключён")
	return false
}

func (h *PaymentHandler) call(ctx context.Context, method, path, key string, body any) (gatewayPayment, error) {
	var out gatewayPayment
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			return out, err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, "https://api.yookassa.ru/v3/payments"+path, bytes.NewReader(payload))
	if err != nil {
		return out, err
	}
	req.SetBasicAuth(h.Shop, h.Key)
	if key != "" {
		req.Header.Set("Idempotence-Key", key)
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := h.Client.Do(req)
	if err != nil {
		return out, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return out, fmt.Errorf("provider status %d", resp.StatusCode)
	}
	err = json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&out)
	return out, err
}

func (h *PaymentHandler) matches(o order, p gatewayPayment) bool {
	_, err := uuid.Parse(p.ID)
	return err == nil && p.Test && p.Recipient.Account == h.Shop && p.Metadata["order"] == o.ID && p.Amount.Value == o.Amount && p.Amount.Currency == "RUB" && (!o.Provider.Valid || p.ID == o.Provider.String)
}

const orderFields = "id,reader_id,plan,amount,months,provider_id,status,created_at"

func (h *PaymentHandler) Create(c *gin.Context) {
	if !h.enabled(c) {
		return
	}
	var input struct {
		Plan      string `json:"plan"`
		RequestID string `json:"requestId"`
	}
	if c.ShouldBindJSON(&input) != nil {
		payError(c, 400, "Проверьте параметры платежа")
		return
	}
	plan, ok := paymentPlans[input.Plan]
	id, err := uuid.Parse(input.RequestID)
	if !ok || err != nil || id == uuid.Nil {
		payError(c, 400, "Проверьте тариф и номер заказа")
		return
	}
	claims, _ := middleware.GetClaims(c)
	ctx := c.Request.Context()
	_, err = h.DB.ExecContext(ctx, "INSERT INTO reader_payments(id,reader_id,plan,amount,months) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING", id, claims.UserID, input.Plan, plan.amount, plan.months)
	if err != nil {
		payError(c, 500, "Не удалось сохранить заказ")
		return
	}
	var o order
	err = h.DB.GetContext(ctx, &o, "SELECT "+orderFields+" FROM reader_payments WHERE id=$1 AND reader_id=$2", id, claims.UserID)
	if err != nil || o.Plan != input.Plan {
		payError(c, 409, "Начните новый заказ")
		return
	}
	back := strings.TrimRight(h.Site, "/") + "/account?payment=" + o.ID
	if o.Status != "pending" {
		c.JSON(200, gin.H{"id": o.ID, "confirmationUrl": back})
		return
	}
	var p gatewayPayment
	if o.Provider.Valid {
		p, err = h.call(ctx, "GET", "/"+o.Provider.String, "", nil)
	} else {
		if time.Since(o.Created) >= 23*time.Hour {
			payError(c, 409, "Время заказа истекло. Начните новый заказ")
			return
		}
		p, err = h.call(ctx, "POST", "", o.ID, gin.H{"amount": gin.H{"value": o.Amount, "currency": "RUB"}, "capture": true, "confirmation": gin.H{"type": "redirect", "return_url": back}, "description": fmt.Sprintf("Al-Qalam · %d мес.", o.Months), "metadata": gin.H{"order": o.ID}})
	}
	if err != nil || !h.matches(o, p) {
		payError(c, 502, "ЮKassa не подтвердила заказ. Повторите попытку")
		return
	}
	_, err = h.DB.ExecContext(ctx, "UPDATE reader_payments SET provider_id=$2 WHERE id=$1 AND (provider_id IS NULL OR provider_id=$2)", o.ID, p.ID)
	if err != nil {
		payError(c, 500, "Повторите открытие заказа")
		return
	}
	dest := back
	if p.Status == "pending" {
		u, err := url.Parse(p.Confirmation.URL)
		if err != nil || u.Scheme != "https" || u.Host == "" {
			payError(c, 502, "ЮKassa не выдала ссылку на оплату")
			return
		}
		dest = u.String()
	}
	c.JSON(200, gin.H{"id": o.ID, "confirmationUrl": dest})
}

func (h *PaymentHandler) sync(ctx context.Context, o order) (string, error) {
	if o.Status != "pending" {
		return o.Status, nil
	}
	if !o.Provider.Valid {
		return "pending", nil
	}
	p, err := h.call(ctx, "GET", "/"+o.Provider.String, "", nil)
	if err != nil || !h.matches(o, p) {
		return "", errors.New("payment verification failed")
	}
	if p.Status == "pending" || p.Status == "waiting_for_capture" {
		return "pending", nil
	}
	if p.Status != "canceled" && !(p.Status == "succeeded" && p.Paid) {
		return "", errors.New("unexpected payment state")
	}
	tx, err := h.DB.BeginTxx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, "UPDATE reader_payments SET status=$2 WHERE id=$1 AND status='pending'", o.ID, p.Status)
	if err != nil {
		return "", err
	}
	changed, err := res.RowsAffected()
	if err != nil {
		return "", err
	}
	if changed == 1 && p.Status == "succeeded" {
		_, err = tx.ExecContext(ctx, "UPDATE readers SET subscription_until=greatest(subscription_until,now())+make_interval(months=>$2::int),updated_at=now() WHERE id=$1", o.Reader, o.Months)
		if err != nil {
			return "", err
		}
	}
	return p.Status, tx.Commit()
}

func (h *PaymentHandler) Check(c *gin.Context) {
	if !h.enabled(c) {
		return
	}
	claims, _ := middleware.GetClaims(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		payError(c, 404, "Заказ не найден")
		return
	}
	var o order
	ctx := c.Request.Context()
	err = h.DB.GetContext(ctx, &o, "SELECT "+orderFields+" FROM reader_payments WHERE id=$1 AND reader_id=$2", id, claims.UserID)
	if errors.Is(err, sql.ErrNoRows) {
		payError(c, 404, "Заказ не найден")
		return
	}
	if err != nil {
		payError(c, 500, "Не удалось открыть заказ")
		return
	}
	status, err := h.sync(ctx, o)
	if err != nil {
		payError(c, 502, "Не удалось проверить статус в ЮKassa")
		return
	}
	c.JSON(200, gin.H{"status": status})
}

func (h *PaymentHandler) Notify(c *gin.Context) {
	if !h.enabled(c) {
		return
	}
	var msg struct {
		Event  string
		Object struct{ ID string }
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
	if c.ShouldBindJSON(&msg) != nil {
		c.Status(400)
		return
	}
	if msg.Event != "payment.succeeded" && msg.Event != "payment.canceled" {
		c.Status(200)
		return
	}
	id, err := uuid.Parse(msg.Object.ID)
	if err != nil {
		c.Status(400)
		return
	}
	var o order
	ctx := c.Request.Context()
	err = h.DB.GetContext(ctx, &o, "SELECT "+orderFields+" FROM reader_payments WHERE provider_id=$1", id.String())
	if errors.Is(err, sql.ErrNoRows) {
		c.Status(200)
		return
	}
	if err != nil {
		c.Status(500)
		return
	}
	if _, err = h.sync(ctx, o); err != nil {
		c.Status(503)
		return
	}
	c.Status(200)
}
