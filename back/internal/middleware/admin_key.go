package middleware

import (
	"crypto/subtle"
	"strings"

	"github.com/gin-gonic/gin"

	"medrese-back/internal/models"
)

func AdminKeyMiddleware(adminKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		providedKey := strings.TrimSpace(c.GetHeader("X-Admin-Key"))
		if adminKey == "" || subtle.ConstantTimeCompare([]byte(providedKey), []byte(adminKey)) != 1 {
			c.AbortWithStatusJSON(401, models.ErrorResponse{
				Error: models.ErrorBody{
					Code:    "unauthorized",
					Message: "Неверный admin key",
				},
			})
			return
		}

		c.Next()
	}
}
