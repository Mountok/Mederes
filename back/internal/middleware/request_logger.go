package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func RequestLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		c.Next()

		fields := logrus.Fields{
			"method":   c.Request.Method,
			"path":     c.Request.URL.Path,
			"status":   c.Writer.Status(),
			"duration": time.Since(startedAt).String(),
		}

		if claims, ok := GetClaims(c); ok {
			fields["user_id"] = claims.UserID
			fields["school_id"] = claims.SchoolID
			fields["role"] = claims.Role
		}

		logger.WithFields(fields).Info("request handled")
	}
}
