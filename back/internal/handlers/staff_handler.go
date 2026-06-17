package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type StaffHandler struct {
	service *services.StaffService
	logger  *logrus.Logger
}

func NewStaffHandler(service *services.StaffService, logger *logrus.Logger) *StaffHandler {
	return &StaffHandler{service: service, logger: logger}
}

func (h *StaffHandler) Create(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.CreateStaffRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.Create(c.Request.Context(), claims.SchoolID, request)
	if err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"action":     "staff created",
			"result":     "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"teacher_id": claims.UserID,
		"school_id":  claims.SchoolID,
		"staff_id":   response.Staff.ID,
		"action":     "staff created",
		"result":     "success",
	}).Info("staff created")

	c.JSON(http.StatusCreated, response)
}

func (h *StaffHandler) List(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	items, err := h.service.List(c.Request.Context(), claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *StaffHandler) Update(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.UpdateStaffRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	staffID := c.Param("id")
	response, err := h.service.Update(c.Request.Context(), claims.SchoolID, staffID, request)
	if err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"staff_id":   staffID,
			"action":     "staff updated",
			"result":     "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"teacher_id": claims.UserID,
		"school_id":  claims.SchoolID,
		"staff_id":   staffID,
		"action":     "staff updated",
		"result":     "success",
	}).Info("staff updated")

	c.JSON(http.StatusOK, response)
}

func (h *StaffHandler) UpdateGroups(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.UpdateStaffGroupsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	staffID := c.Param("id")
	if err := h.service.UpdateGroups(c.Request.Context(), claims.SchoolID, staffID, request); err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"staff_id":   staffID,
			"action":     "staff groups updated",
			"result":     "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"teacher_id": claims.UserID,
		"school_id":  claims.SchoolID,
		"staff_id":   staffID,
		"action":     "staff groups updated",
		"result":     "success",
	}).Info("staff groups updated")

	c.JSON(http.StatusOK, models.UpdateStaffGroupsResponse{Success: true})
}

func (h *StaffHandler) ResetAccess(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	staffID := c.Param("id")
	response, err := h.service.ResetAccess(c.Request.Context(), claims.SchoolID, staffID)
	if err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"staff_id":   staffID,
			"action":     "staff access reset",
			"result":     "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"teacher_id": claims.UserID,
		"school_id":  claims.SchoolID,
		"staff_id":   staffID,
		"action":     "staff access reset",
		"result":     "success",
	}).Info("staff access reset")

	c.JSON(http.StatusOK, response)
}

func (h *StaffHandler) Delete(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	staffID := c.Param("id")
	if err := h.service.Delete(c.Request.Context(), claims.SchoolID, staffID); err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"teacher_id": claims.UserID,
			"school_id":  claims.SchoolID,
			"staff_id":   staffID,
			"action":     "staff deleted",
			"result":     "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"teacher_id": claims.UserID,
		"school_id":  claims.SchoolID,
		"staff_id":   staffID,
		"action":     "staff deleted",
		"result":     "success",
	}).Info("staff deleted")

	c.JSON(http.StatusOK, models.DeleteStaffResponse{
		Success: true,
		Message: "Преподаватель удалён",
	})
}
