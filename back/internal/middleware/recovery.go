package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/models"
)

func Recovery(logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if rec := recover(); rec != nil {
				logger.WithField("panic", rec).Error("panic recovered")
				c.AbortWithStatusJSON(500, models.ErrorResponse{
					Error: models.ErrorBody{Code: "internal_error", Message: "Внутренняя ошибка сервера"},
				})
			}
		}()

		c.Next()
	}
}
