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
	authHandler *handlers.AuthHandler,
	platformHandler *handlers.PlatformHandler,
	groupHandler *handlers.GroupHandler,
	studentHandler *handlers.StudentHandler,
	staffHandler *handlers.StaffHandler,
	lessonHandler *handlers.LessonHandler,
	attendanceHandler *handlers.AttendanceHandler,
	liveHandler *handlers.LiveHandler,
	homeworkHandler *handlers.HomeworkHandler,
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

	protected := api.Group("/")
	protected.Use(middleware.AuthMiddleware(jwtManager))

	protected.GET("/me", authHandler.Me)
	platform := protected.Group("/platform")
	platform.Use(middleware.RequireRoles("platform_admin"))
	platform.GET("/schools", platformHandler.List)
	platform.POST("/schools", platformHandler.Create)
	platform.GET("/schools/:id", platformHandler.Detail)
	platform.PATCH("/schools/:id", platformHandler.Rename)
	platform.POST("/schools/:id/users/:userId/access/reset", platformHandler.ResetAccess)
	protected.GET("/groups", groupHandler.List)
	protected.GET("/groups/:id", groupHandler.GetByID)
	protected.GET("/groups/:id/journal", groupHandler.GetJournal)
	protected.GET("/lessons/:id", lessonHandler.GetByID)
	protected.GET("/homework", homeworkHandler.List)
	protected.GET("/homework/:id", homeworkHandler.Get)
	protected.GET("/homework/:id/audio/:studentId", homeworkHandler.Audio)

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
	teacherOrStaff.POST("/homework", homeworkHandler.Create)
	teacherOrStaff.PUT("/homework/:id/submissions/:studentId/review", homeworkHandler.Review)

	studentOnly := protected.Group("/")
	studentOnly.Use(middleware.RequireRoles("student"))
	studentOnly.POST("/homework/:id/complete", homeworkHandler.Complete)
	studentOnly.POST("/homework/:id/submit", homeworkHandler.Submit)

	return router
}
