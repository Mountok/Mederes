package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type ReaderHandler struct {
	service *services.ReaderService
	logger  *logrus.Logger
}

func NewReaderHandler(service *services.ReaderService, logger *logrus.Logger) *ReaderHandler {
	return &ReaderHandler{service: service, logger: logger}
}

func (h *ReaderHandler) Register(c *gin.Context) {
	var request models.ReaderAuthRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}
	response, err := h.service.Register(c.Request.Context(), request)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.JSON(http.StatusCreated, response)
}

func (h *ReaderHandler) Login(c *gin.Context) {
	var request models.ReaderAuthRequest
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
