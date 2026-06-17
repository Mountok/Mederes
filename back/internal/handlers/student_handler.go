package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type StudentHandler struct {
	service *services.StudentService
	logger  *logrus.Logger
}

func NewStudentHandler(service *services.StudentService, logger *logrus.Logger) *StudentHandler {
	return &StudentHandler{service: service, logger: logger}
}

func (h *StudentHandler) Create(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.CreateStudentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.Create(c.Request.Context(), claims, request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusCreated, response)
}

func (h *StudentHandler) Update(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.UpdateStudentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	student, err := h.service.Update(c.Request.Context(), claims, c.Param("id"), request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, student)
}

func (h *StudentHandler) ResetAccess(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	response, err := h.service.ResetAccess(c.Request.Context(), claims.SchoolID, c.Param("id"))
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *StudentHandler) Delete(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	studentID := c.Param("id")
	if err := h.service.Delete(c.Request.Context(), claims, studentID); err != nil {
		appErr := models.AsAppError(err)
		entry := h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"student_id": studentID,
			"action":     "student deleted",
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
		"student_id": studentID,
		"action":     "student deleted",
		"result":     "success",
	}).Info("student deleted")

	c.JSON(http.StatusOK, models.DeleteStudentResponse{
		Success: true,
		Message: "Ученик удалён",
	})
}
