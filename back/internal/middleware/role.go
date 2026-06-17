package middleware

import (
	"github.com/gin-gonic/gin"

	"medrese-back/internal/models"
)

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(c *gin.Context) {
		claims, ok := GetClaims(c)
		if !ok {
			c.AbortWithStatusJSON(401, models.ErrorResponse{
				Error: models.ErrorBody{Code: "unauthorized", Message: "Требуется авторизация"},
			})
			return
		}

		if _, ok := allowed[claims.Role]; !ok {
			c.AbortWithStatusJSON(403, models.ErrorResponse{
				Error: models.ErrorBody{Code: "forbidden", Message: "Недостаточно прав"},
			})
			return
		}

		c.Next()
	}
}
