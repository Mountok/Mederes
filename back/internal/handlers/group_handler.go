package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type GroupHandler struct {
	service *services.GroupService
	logger  *logrus.Logger
}

func NewGroupHandler(service *services.GroupService, logger *logrus.Logger) *GroupHandler {
	return &GroupHandler{service: service, logger: logger}
}

func (h *GroupHandler) List(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	response, err := h.service.List(c.Request.Context(), claims)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *GroupHandler) Create(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.CreateGroupRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	group, err := h.service.Create(c.Request.Context(), claims.SchoolID, request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusCreated, group)
}

func (h *GroupHandler) GetByID(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	response, err := h.service.GetByID(c.Request.Context(), c.Param("id"), claims)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *GroupHandler) Delete(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	if err := h.service.Delete(c.Request.Context(), c.Param("id"), claims.SchoolID); err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *GroupHandler) GetJournal(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	from, to, err := journalPeriodFromQuery(c.Query("from"), c.Query("to"))
	if err != nil {
		h.logger.WithFields(logrus.Fields{
			"user_id":   claims.UserID,
			"role":      claims.Role,
			"school_id": claims.SchoolID,
			"group_id":  c.Param("id"),
			"from":      c.Query("from"),
			"to":        c.Query("to"),
			"action":    "group journal load",
			"result":    "error",
		}).Warn(err.Message)
		respondError(c, h.logger, err)
		return
	}

	response, serviceErr := h.service.GetJournal(c.Request.Context(), claims, c.Param("id"), from, to)
	if serviceErr != nil {
		appErr := models.AsAppError(serviceErr)
		h.logger.WithFields(logrus.Fields{
			"user_id":   claims.UserID,
			"role":      claims.Role,
			"school_id": claims.SchoolID,
			"group_id":  c.Param("id"),
			"from":      from.Format("2006-01-02"),
			"to":        to.Format("2006-01-02"),
			"action":    "group journal load",
			"result":    "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, serviceErr)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"user_id":   claims.UserID,
		"role":      claims.Role,
		"school_id": claims.SchoolID,
		"group_id":  c.Param("id"),
		"from":      from.Format("2006-01-02"),
		"to":        to.Format("2006-01-02"),
		"action":    "group journal loaded",
		"result":    "success",
	}).Info("group journal loaded")

	c.JSON(http.StatusOK, response)
}

func journalPeriodFromQuery(fromRaw string, toRaw string) (time.Time, time.Time, *models.AppError) {
	now := time.Now()
	defaultFrom := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	defaultTo := defaultFrom.AddDate(0, 1, 0).Add(-24 * time.Hour)

	from := defaultFrom
	to := defaultTo

	if fromRaw != "" {
		parsed, err := time.ParseInLocation("2006-01-02", fromRaw, now.Location())
		if err != nil {
			return time.Time{}, time.Time{}, models.ValidationError("Некорректный диапазон дат")
		}
		from = parsed
	}

	if toRaw != "" {
		parsed, err := time.ParseInLocation("2006-01-02", toRaw, now.Location())
		if err != nil {
			return time.Time{}, time.Time{}, models.ValidationError("Некорректный диапазон дат")
		}
		to = parsed
	}

	if from.After(to) {
		return time.Time{}, time.Time{}, models.ValidationError("Некорректный диапазон дат")
	}

	return from, to, nil
}
