package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type AttendanceHandler struct {
	service *services.AttendanceService
	logger  *logrus.Logger
}

func NewAttendanceHandler(service *services.AttendanceService, logger *logrus.Logger) *AttendanceHandler {
	return &AttendanceHandler{service: service, logger: logger}
}

func (h *AttendanceHandler) Update(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.UpdateAttendanceRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.Update(c.Request.Context(), claims, request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *AttendanceHandler) SetAll(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.UpdateAttendanceAllRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.SetForAll(c.Request.Context(), claims, c.Param("id"), request.Attended)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}
