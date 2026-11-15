package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/repository"
)

type practiceLedger interface {
	Access(context.Context, string) (models.ReaderAccess, error)
	CheckAttempt(context.Context, string, repository.ReadingAttempt, bool) error
}

type PracticeHandler struct {
	ledger practiceLedger
	logger *logrus.Logger
	aiURL  string
	client *http.Client
}

func NewPracticeHandler(ledger practiceLedger, logger *logrus.Logger, aiURL string) *PracticeHandler {
	return &PracticeHandler{ledger: ledger, logger: logger, aiURL: strings.TrimRight(aiURL, "/"),
		client: &http.Client{Timeout: 80 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (h *PracticeHandler) Access(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	c.Header("Cache-Control", "no-store")
	access, err := h.ledger.Access(c.Request.Context(), claims.UserID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.JSON(http.StatusOK, access)
}

func (h *PracticeHandler) Health(c *gin.Context) {
	h.serve(c, "health")
}

func (h *PracticeHandler) Recognize(operation string) gin.HandlerFunc {
	return func(c *gin.Context) { h.serve(c, operation) }
}

const maxPracticeAudio = 20 << 20
const maxPracticeResult = 4 << 20

// Canonicalize the selection to make retries and preview/final checks unambiguous.
func practiceQuery(src url.Values) (url.Values, error) {
	q := url.Values{}
	for key, fallback := range map[string]int{"surah": 112, "ayah_from": 1, "ayah_to": 4} {
		value := fallback
		if src.Has(key) {
			n, err := strconv.Atoi(src.Get(key))
			if err != nil || n < 1 {
				return nil, models.ValidationError("Проверьте выбранные аяты")
			}
			value = n
		}
		q.Set(key, strconv.Itoa(value))
	}
	return q, nil
}

func (h *PracticeHandler) serve(c *gin.Context, operation string) {
	ctx := c.Request.Context()
	claims, _ := middleware.GetClaims(c)
	c.Header("Cache-Control", "no-store")
	var audio []byte
	q := url.Values{}
	trackTrial := claims.Role == "reader" && operation != "health"
	final := operation == "listen/final" || operation == "analyze"
	var attempt repository.ReadingAttempt
	if operation != "health" {
		var err error
		q, err = practiceQuery(c.Request.URL.Query())
		if err != nil {
			respondError(c, h.logger, err)
			return
		}
		attempt.Selection = q.Encode()
		session := c.Query("session")
		if trackTrial {
			id, err := uuid.Parse(c.GetHeader("X-Attempt-Id"))
			if err != nil || id == uuid.Nil {
				respondError(c, h.logger, models.ValidationError("Требуется идентификатор попытки"))
				return
			}
			attempt.ID = id.String()
			session = attempt.ID
		}
		if session != "" {
			digest := sha256.Sum256([]byte(claims.UserID + ":" + session))
			q.Set("session", hex.EncodeToString(digest[:]))
		}
		if c.Query("seq") != "" {
			q.Set("seq", c.Query("seq"))
		}
		audio, err = io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, maxPracticeAudio))
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				respondError(c, h.logger, &models.AppError{HTTPStatus: 413, Code: "audio_too_large", Message: "Размер записи превышает 20 МБ"})
			} else {
				respondError(c, h.logger, models.ValidationError("Не удалось получить запись"))
			}
			return
		}
		if len(audio) == 0 {
			respondError(c, h.logger, models.ValidationError("Запись пуста"))
			return
		}
		if trackTrial {
			if final {
				digest := sha256.New()
				digest.Write([]byte(claims.UserID))
				digest.Write(audio)
				attempt.FinalFingerprint = digest.Sum(nil)
			}
			if err = h.ledger.CheckAttempt(ctx, claims.UserID, attempt, false); err != nil {
				respondError(c, h.logger, err)
				return
			}
		}
	}

	target := h.aiURL + "/ai-api/" + operation
	if len(q) > 0 {
		target += "?" + q.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, c.Request.Method, target, bytes.NewReader(audio))
	if err != nil {
		respondError(c, h.logger, models.InternalError("Проверьте адрес AI-сервиса", err))
		return
	}
	req.Header.Set("X-Al-Qalam-Test", "1")
	if len(audio) > 0 {
		req.Header.Set("Content-Type", "application/octet-stream")
	}
	resp, err := h.client.Do(req)
	if err != nil {
		respondError(c, h.logger, aiUnavailable(err))
		return
	}
	defer resp.Body.Close()
	result, err := io.ReadAll(io.LimitReader(resp.Body, maxPracticeResult+1))
	if err != nil || len(result) > maxPracticeResult || !json.Valid(result) {
		respondError(c, h.logger, aiUnavailable(err))
		return
	}
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode < 400 {
			respondError(c, h.logger, aiUnavailable(nil))
			return
		}
		c.Data(resp.StatusCode, "application/json; charset=utf-8", result)
		return
	}
	if trackTrial {
		var response struct {
			Transcript *string   `json:"transcript"`
			Tracking   *struct{} `json:"tracking"`
		}
		if json.Unmarshal(result, &response) != nil || response.Transcript == nil || response.Tracking == nil {
			respondError(c, h.logger, aiUnavailable(nil))
			return
		}
		if strings.TrimSpace(*response.Transcript) == "" {
			respondError(c, h.logger, &models.AppError{HTTPStatus: 422, Code: "no_speech", Message: "Не удалось распознать слова. Попробуйте ещё раз."})
			return
		}
		if err = h.ledger.CheckAttempt(ctx, claims.UserID, attempt, true); err != nil {
			respondError(c, h.logger, err)
			return
		}
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", result)
}

func aiUnavailable(err error) *models.AppError {
	return &models.AppError{Code: "ai_unavailable", Message: "AI-сервис временно недоступен. Попробуйте ещё раз.", HTTPStatus: 502, Err: err}
}
