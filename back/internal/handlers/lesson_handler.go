package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type LessonHandler struct {
	service *services.LessonService
	logger  *logrus.Logger
}

func NewLessonHandler(service *services.LessonService, logger *logrus.Logger) *LessonHandler {
	return &LessonHandler{service: service, logger: logger}
}

func (h *LessonHandler) Create(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.CreateLessonRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	lesson, err := h.service.Create(c.Request.Context(), claims, request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusCreated, lesson)
}

func (h *LessonHandler) GetByID(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	response, err := h.service.GetByID(c.Request.Context(), claims, c.Param("id"))
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *LessonHandler) Update(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.UpdateLessonRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	lessonID := c.Param("id")
	response, err := h.service.Update(c.Request.Context(), claims, lessonID, request)
	if err != nil {
		appErr := models.AsAppError(err)
		entry := h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"lesson_id":  lessonID,
			"action":     "lesson updated",
			"result":     "error",
		})
		if appErr.Err != nil {
			entry = entry.WithError(appErr.Err)
		}
		entry.Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"teacher_id": claims.UserID,
		"school_id":  claims.SchoolID,
		"lesson_id":  lessonID,
		"action":     "lesson updated",
		"result":     "success",
	}).Info("lesson updated")

	c.JSON(http.StatusOK, response)
}

func (h *LessonHandler) Delete(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	lessonID := c.Param("id")
	if err := h.service.Delete(c.Request.Context(), claims, lessonID); err != nil {
		appErr := models.AsAppError(err)
		entry := h.logger.WithFields(logrus.Fields{
			"user_id":   claims.UserID,
			"role":      claims.Role,
			"school_id": claims.SchoolID,
			"lesson_id": lessonID,
			"action":    "lesson deleted",
			"result":    "error",
		})
		if appErr.Err != nil {
			entry = entry.WithError(appErr.Err)
		}
		entry.Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"user_id":   claims.UserID,
		"role":      claims.Role,
		"school_id": claims.SchoolID,
		"lesson_id": lessonID,
		"action":    "lesson deleted",
		"result":    "success",
	}).Info("lesson deleted")

	c.JSON(http.StatusOK, models.DeleteLessonResponse{
		Success: true,
		Message: "Урок удалён",
	})
}
