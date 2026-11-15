package handlers

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	"medrese-back/internal/models"
)

type InquiryHandler struct {
	db     *sqlx.DB
	logger *logrus.Logger
	mail   InquiryMailConfig
}

type InquiryMailConfig struct {
	Host, Port, User, Password, From, To string
}

type schoolInquiryRequest struct {
	SchoolName  string `json:"schoolName"`
	ContactName string `json:"contactName"`
	City        string `json:"city"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	Message     string `json:"message"`
	Consent     bool   `json:"consent"`
	Website     string `json:"website"`
}

type schoolInquiry struct {
	ID          string    `db:"id" json:"id"`
	SchoolName  string    `db:"school_name" json:"schoolName"`
	ContactName string    `db:"contact_name" json:"contactName"`
	City        string    `db:"city" json:"city"`
	Phone       string    `db:"phone" json:"phone"`
	Email       string    `db:"email" json:"email"`
	Message     string    `db:"message" json:"message"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
}

func NewInquiryHandler(db *sqlx.DB, logger *logrus.Logger, mailConfig InquiryMailConfig) *InquiryHandler {
	return &InquiryHandler{db: db, logger: logger, mail: mailConfig}
}

func (h *InquiryHandler) Create(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var request schoolInquiryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректная заявка"))
		return
	}
	if request.Website != "" {
		c.JSON(http.StatusAccepted, gin.H{"status": "received"})
		return
	}
	request.SchoolName = strings.TrimSpace(request.SchoolName)
	request.ContactName = strings.TrimSpace(request.ContactName)
	request.City = strings.TrimSpace(request.City)
	request.Phone = strings.TrimSpace(request.Phone)
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))
	request.Message = strings.TrimSpace(request.Message)
	if request.SchoolName == "" || request.ContactName == "" || !request.Consent || len([]rune(request.SchoolName)) > 120 || len([]rune(request.ContactName)) > 80 || len([]rune(request.City)) > 120 || len(request.Phone) > 40 || len(request.Email) > 254 || len([]rune(request.Message)) > 1000 || (request.Phone == "" && request.Email == "") {
		respondError(c, h.logger, models.ValidationError("Укажите школу, имя, телефон или email и согласие на обработку данных"))
		return
	}
	if request.Email != "" {
		parsed, err := mail.ParseAddress(request.Email)
		if err != nil || parsed.Address != request.Email {
			respondError(c, h.logger, models.ValidationError("Проверьте адрес электронной почты"))
			return
		}
	}
	_, err := h.db.ExecContext(c.Request.Context(), `INSERT INTO school_inquiries(id,school_name,contact_name,city,phone,email,message,consent_at,consent_version) VALUES($1,$2,$3,$4,$5,$6,$7,NOW(),'2026-11-15')`, uuid.NewString(), request.SchoolName, request.ContactName, request.City, request.Phone, request.Email, request.Message)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось отправить заявку", err))
		return
	}
	if h.mail.Host != "" && h.mail.To != "" {
		go func() {
			if err := h.notify(); err != nil {
				h.logger.WithError(err).Warn("school inquiry email notification failed")
			}
		}()
	}
	c.JSON(http.StatusCreated, gin.H{"status": "received"})
}

func (h *InquiryHandler) notify() error {
	cfg := h.mail
	if cfg.Port == "" || cfg.User == "" || cfg.Password == "" || cfg.From == "" {
		return fmt.Errorf("inquiry SMTP configuration is incomplete")
	}
	address := net.JoinHostPort(cfg.Host, cfg.Port)
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	var conn net.Conn
	var err error
	if cfg.Port == "465" {
		conn, err = tls.DialWithDialer(dialer, "tcp", address, &tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12})
	} else {
		conn, err = dialer.Dial("tcp", address)
	}
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return err
	}
	defer client.Close()
	if cfg.Port != "465" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(&tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if err := client.Auth(smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Host)); err != nil {
		return err
	}
	if err := client.Mail(cfg.From); err != nil {
		return err
	}
	if err := client.Rcpt(cfg.To); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: New Al-Qalam school inquiry\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nA new school inquiry is available in the platform dashboard: https://al-qalam.ru/platform\r\n", cfg.From, cfg.To)
	if _, err := w.Write([]byte(message)); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func (h *InquiryHandler) List(c *gin.Context) {
	items := make([]schoolInquiry, 0)
	if err := h.db.SelectContext(c.Request.Context(), &items, `SELECT id,school_name,contact_name,city,phone,email,message,created_at FROM school_inquiries ORDER BY created_at DESC LIMIT 200`); err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось загрузить заявки", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"inquiries": items})
}
