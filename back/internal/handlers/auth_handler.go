package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type AuthHandler struct {
	service *services.AuthService
	logger  *logrus.Logger
}

func NewAuthHandler(service *services.AuthService, logger *logrus.Logger) *AuthHandler {
	return &AuthHandler{service: service, logger: logger}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var request models.LoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.Login(c.Request.Context(), request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) Me(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	response, err := h.service.Me(c.Request.Context(), claims.UserID, claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}
