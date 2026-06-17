package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"medrese-back/internal/models"
	"medrese-back/pkg/auth"
)

func AuthMiddleware(jwtManager *auth.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" {
			c.AbortWithStatusJSON(401, models.ErrorResponse{
				Error: models.ErrorBody{Code: "unauthorized", Message: "Требуется авторизация"},
			})
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
		if token == header || token == "" {
			c.AbortWithStatusJSON(401, models.ErrorResponse{
				Error: models.ErrorBody{Code: "unauthorized", Message: "Некорректный токен"},
			})
			return
		}

		claims, err := jwtManager.ParseToken(token)
		if err != nil {
			c.AbortWithStatusJSON(401, models.ErrorResponse{
				Error: models.ErrorBody{Code: "unauthorized", Message: "Некорректный токен"},
			})
			return
		}

		SetClaims(c, claims)
		c.Next()
	}
}
