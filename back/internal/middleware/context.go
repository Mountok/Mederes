package middleware

import (
	"github.com/gin-gonic/gin"

	"medrese-back/pkg/auth"
)

const authClaimsKey = "authClaims"

func SetClaims(c *gin.Context, claims *auth.Claims) {
	c.Set(authClaimsKey, claims)
}

func GetClaims(c *gin.Context) (*auth.Claims, bool) {
	value, ok := c.Get(authClaimsKey)
	if !ok {
		return nil, false
	}

	claims, ok := value.(*auth.Claims)
	return claims, ok
}
