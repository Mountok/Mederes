package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
)

type PlatformReadersHandler struct {
	db     *sqlx.DB
	logger *logrus.Logger
}

func NewPlatformReadersHandler(db *sqlx.DB, logger *logrus.Logger) *PlatformReadersHandler {
	return &PlatformReadersHandler{db: db, logger: logger}
}

type platformReader struct {
	ID                string     `db:"id" json:"id"`
	Name              string     `db:"name" json:"name"`
	Email             string     `db:"email" json:"email"`
	TrialUsed         int        `db:"trial_used" json:"trialUsed"`
	SubscriptionUntil *time.Time `db:"subscription_until" json:"subscriptionUntil"`
}

const platformReaderFields = "id,name,email,trial_used,subscription_until"
const readersPageSize = 40

func (h *PlatformReadersHandler) List(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if utf8.RuneCountInString(query) > 320 || err != nil || offset < 0 {
		respondError(c, h.logger, models.ValidationError("Проверьте параметры поиска"))
		return
	}
	items := make([]platformReader, 0)
	err = h.db.SelectContext(c.Request.Context(), &items,
		`SELECT `+platformReaderFields+` FROM readers
		 WHERE strpos(lower(name), lower($1)) > 0 OR strpos(lower(email), lower($1)) > 0
		 ORDER BY created_at DESC, id LIMIT $2 OFFSET $3`, query, readersPageSize+1, offset)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось загрузить пользователей", err))
		return
	}
	hasMore := len(items) > readersPageSize
	if hasMore {
		items = items[:readersPageSize]
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"readers": items, "hasMore": hasMore, "pageSize": readersPageSize, "trialLimit": models.ReaderTrialLimit})
}

func (h *PlatformReadersHandler) ResetTrial(c *gin.Context) {
	h.update(c, "reader_trial_reset", func(ctx context.Context, tx *sqlx.Tx, p *platformReader) error {
		return tx.GetContext(ctx, p, `UPDATE readers SET trial_used=0, updated_at=NOW()
			WHERE id=$1 RETURNING `+platformReaderFields, p.ID)
	})
}

func (h *PlatformReadersHandler) SetSubscription(c *gin.Context) {
	var req struct {
		Months        *int       `json:"months"`
		ExpectedUntil *time.Time `json:"expectedUntil"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Months == nil {
		respondError(c, h.logger, models.ValidationError("Укажите срок подписки"))
		return
	}
	months := *req.Months
	if months != 0 && months != 1 && months != 6 && months != 12 {
		respondError(c, h.logger, models.ValidationError("Выберите 1, 6 или 12 месяцев"))
		return
	}
	action := "reader_subscription_revoked"
	if months > 0 {
		action = "reader_subscription_extended_" + strconv.Itoa(months) + "m"
	}
	h.update(c, action, func(ctx context.Context, tx *sqlx.Tx, p *platformReader) error {
		// An out-of-date dialog or a retried request must not grant extra months.
		if (p.SubscriptionUntil == nil) != (req.ExpectedUntil == nil) ||
			(p.SubscriptionUntil != nil && !p.SubscriptionUntil.Equal(*req.ExpectedUntil)) {
			return models.ConflictError("Подписка уже изменилась. Обновите список пользователей")
		}
		return tx.GetContext(ctx, p, `UPDATE readers SET subscription_until =
			CASE WHEN $2::int=0 THEN NULL ELSE greatest(subscription_until, now()) + make_interval(months => $2) END,
			updated_at=now() WHERE id=$1 RETURNING `+platformReaderFields, p.ID, months)
	})
}

func (h *PlatformReadersHandler) update(c *gin.Context, action string, mutate func(context.Context, *sqlx.Tx, *platformReader) error) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, h.logger, models.NotFoundError("Пользователь не найден"))
		return
	}
	claims, ok := middleware.GetClaims(c)
	if !ok || claims.Role != "platform_admin" {
		respondError(c, h.logger, models.ForbiddenError("Требуются права владельца"))
		return
	}
	ctx := c.Request.Context()
	tx, err := h.db.BeginTxx(ctx, nil)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	defer tx.Rollback()
	var p platformReader
	err = tx.GetContext(ctx, &p, `SELECT `+platformReaderFields+` FROM readers WHERE id=$1 FOR UPDATE`, id)
	if errors.Is(err, sql.ErrNoRows) {
		respondError(c, h.logger, models.NotFoundError("Пользователь не найден"))
		return
	}
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	if err := mutate(ctx, tx, &p); err != nil {
		respondError(c, h.logger, err)
		return
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO platform_audit(actor_id, reader_id, action) VALUES ($1,$2,$3)`, claims.UserID, id, action); err != nil {
		respondError(c, h.logger, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"reader": p})
}
