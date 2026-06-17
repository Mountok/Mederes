package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/handlers"
	"medrese-back/internal/middleware"
	"medrese-back/pkg/auth"
)

func Setup(
	logger *logrus.Logger,
	jwtManager *auth.JWTManager,
	adminAPIKey string,
	authHandler *handlers.AuthHandler,
	adminHandler *handlers.AdminHandler,
	groupHandler *handlers.GroupHandler,
	studentHandler *handlers.StudentHandler,
	staffHandler *handlers.StaffHandler,
	lessonHandler *handlers.LessonHandler,
	attendanceHandler *handlers.AttendanceHandler,
	liveHandler *handlers.LiveHandler,
) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(middleware.RequestLogger(logger))
	router.Use(middleware.Recovery(logger))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := router.Group("/api")
	api.POST("/auth/login", authHandler.Login)
	api.POST("/live/rooms/join", liveHandler.JoinRoom)
	api.POST("/live/rooms/:id/token", liveHandler.GetToken)
	api.GET("/live/rooms/:id/messages", liveHandler.ListMessages)
	api.POST("/live/rooms/:id/messages", liveHandler.SendMessage)
	api.GET("/live/rooms/:id/ws", liveHandler.WebSocket)

	admin := api.Group("/admin")
	admin.Use(middleware.AdminKeyMiddleware(adminAPIKey))
	admin.POST("/schools", adminHandler.CreateSchoolWithUsers)

	protected := api.Group("/")
	protected.Use(middleware.AuthMiddleware(jwtManager))

	protected.GET("/me", authHandler.Me)
	protected.GET("/groups", groupHandler.List)
	protected.GET("/groups/:id", groupHandler.GetByID)
	protected.GET("/groups/:id/journal", groupHandler.GetJournal)
	protected.GET("/lessons/:id", lessonHandler.GetByID)

	teacherOnly := protected.Group("/")
	teacherOnly.Use(middleware.RequireRoles("teacher"))
	teacherOnly.POST("/groups", groupHandler.Create)
	teacherOnly.DELETE("/groups/:id", groupHandler.Delete)
	teacherOnly.POST("/students/:id/access/reset", studentHandler.ResetAccess)
	teacherOnly.GET("/staff", staffHandler.List)
	teacherOnly.POST("/staff", staffHandler.Create)
	teacherOnly.PUT("/staff/:id", staffHandler.Update)
	teacherOnly.PUT("/staff/:id/groups", staffHandler.UpdateGroups)
	teacherOnly.POST("/staff/:id/access/reset", staffHandler.ResetAccess)
	teacherOnly.DELETE("/staff/:id", staffHandler.Delete)
	teacherOnly.POST("/live/rooms", liveHandler.CreateRoom)
	teacherOnly.GET("/live/rooms/:id", liveHandler.GetRoom)
	teacherOnly.POST("/live/rooms/:id/end", liveHandler.EndRoom)

	teacherOrStaff := protected.Group("/")
	teacherOrStaff.Use(middleware.RequireRoles("teacher", "staff"))
	teacherOrStaff.POST("/students", studentHandler.Create)
	teacherOrStaff.PUT("/students/:id", studentHandler.Update)
	teacherOrStaff.DELETE("/students/:id", studentHandler.Delete)
	teacherOrStaff.POST("/lessons", lessonHandler.Create)
	teacherOrStaff.PUT("/lessons/:id", lessonHandler.Update)
	teacherOrStaff.DELETE("/lessons/:id", lessonHandler.Delete)
	teacherOrStaff.PUT("/attendance", attendanceHandler.Update)
	teacherOrStaff.PUT("/lessons/:id/attendance/all", attendanceHandler.SetAll)

	return router
}
