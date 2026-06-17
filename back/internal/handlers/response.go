package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/models"
)

func respondError(c *gin.Context, logger *logrus.Logger, err error) {
	appErr := models.AsAppError(err)
	entry := logger.WithFields(logrus.Fields{
		"code":   appErr.Code,
		"status": appErr.HTTPStatus,
		"path":   c.Request.URL.Path,
	})
	if appErr.Err != nil {
		entry = entry.WithError(appErr.Err)
	}

	if appErr.HTTPStatus >= 500 {
		entry.Error(appErr.Message)
	} else {
		entry.Warn(appErr.Message)
	}

	c.AbortWithStatusJSON(appErr.HTTPStatus, models.ErrorResponse{
		Error: models.ErrorBody{
			Code:    appErr.Code,
			Message: appErr.Message,
		},
	})
}
