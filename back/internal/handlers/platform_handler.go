package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type PlatformHandler struct {
	service *services.PlatformService
	logger  *logrus.Logger
}

func NewPlatformHandler(service *services.PlatformService, logger *logrus.Logger) *PlatformHandler {
	return &PlatformHandler{service: service, logger: logger}
}

func (h *PlatformHandler) actor(c *gin.Context) string {
	claims, _ := middleware.GetClaims(c)
	return claims.UserID
}

func (h *PlatformHandler) List(c *gin.Context) {
	schools, err := h.service.List(c.Request.Context())
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"schools": schools})
}

func (h *PlatformHandler) Detail(c *gin.Context) {
	school, users, err := h.service.Detail(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"school": school, "users": users})
}

func (h *PlatformHandler) Create(c *gin.Context) {
	var req models.CreatePlatformSchoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}
	school, account, err := h.service.Create(c.Request.Context(), h.actor(c), req)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusCreated, gin.H{"school": school, "account": account})
}

func (h *PlatformHandler) Rename(c *gin.Context) {
	var req models.RenamePlatformSchoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}
	school, err := h.service.Rename(c.Request.Context(), h.actor(c), c.Param("id"), req.Name)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"school": school})
}

func (h *PlatformHandler) ResetAccess(c *gin.Context) {
	account, err := h.service.ResetAccess(c.Request.Context(), h.actor(c), c.Param("id"), c.Param("userId"))
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"account": account})
}
