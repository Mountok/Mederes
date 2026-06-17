package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type AdminHandler struct {
	service *services.AdminService
	logger  *logrus.Logger
}

func NewAdminHandler(service *services.AdminService, logger *logrus.Logger) *AdminHandler {
	return &AdminHandler{service: service, logger: logger}
}

func (h *AdminHandler) CreateSchoolWithUsers(c *gin.Context) {
	var request models.CreateSchoolWithUsersRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.CreateSchoolWithUsers(c.Request.Context(), request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusCreated, response)
}
