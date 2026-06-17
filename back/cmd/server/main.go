package main

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"

	"medrese-back/internal/config"
	"medrese-back/internal/handlers"
	livekitclient "medrese-back/internal/livekit"
	"medrese-back/internal/realtime"
	"medrese-back/internal/repository"
	"medrese-back/internal/routes"
	"medrese-back/internal/services"
	"medrese-back/pkg/auth"
	"medrese-back/pkg/db"
	applogger "medrese-back/pkg/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	logger, logCloser, err := applogger.New(cfg.LogFilePath)
	if err != nil {
		panic(err)
	}
	defer func() {
		if logCloser != nil {
			_ = logCloser.Close()
		}
	}()

	conn, err := db.Connect(cfg.DatabaseDSN())
	if err != nil {
		logger.WithError(err).Fatal("failed to connect to database")
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	migrationsDir := filepath.Join(".", "migrations")
	if err := db.ApplyMigrations(ctx, conn, migrationsDir, logger); err != nil {
		logger.WithError(err).Fatal("failed to apply migrations")
	}

	jwtManager := auth.NewJWTManager(cfg.JWTSecret, 24*time.Hour)

	authRepo := repository.NewAuthRepository(conn)
	adminRepo := repository.NewAdminRepository(conn)
	groupRepo := repository.NewGroupRepository(conn)
	studentRepo := repository.NewStudentRepository(conn)
	staffRepo := repository.NewStaffRepository(conn)
	lessonRepo := repository.NewLessonRepository(conn)
	attendanceRepo := repository.NewAttendanceRepository(conn)
	liveRepo := repository.NewLiveRepository(conn)

	liveKitClient := livekitclient.NewClient(cfg.LiveKitURL, cfg.LiveKitKey, cfg.LiveKitSecret)
	liveHub := realtime.NewLiveHub()
	accessService := services.NewAccessService(groupRepo, studentRepo, staffRepo)

	authService := services.NewAuthService(authRepo, jwtManager)
	adminService := services.NewAdminService(adminRepo)
	groupService := services.NewGroupService(groupRepo, studentRepo, staffRepo, lessonRepo, attendanceRepo, accessService)
	studentService := services.NewStudentService(studentRepo, groupRepo, accessService)
	staffService := services.NewStaffService(staffRepo, groupRepo)
	lessonService := services.NewLessonService(lessonRepo, groupRepo, studentRepo, attendanceRepo, accessService)
	attendanceService := services.NewAttendanceService(attendanceRepo, lessonRepo, groupRepo, studentRepo, accessService)
	liveService := services.NewLiveService(liveRepo, groupRepo, liveKitClient)

	authHandler := handlers.NewAuthHandler(authService, logger)
	adminHandler := handlers.NewAdminHandler(adminService, logger)
	groupHandler := handlers.NewGroupHandler(groupService, logger)
	studentHandler := handlers.NewStudentHandler(studentService, logger)
	staffHandler := handlers.NewStaffHandler(staffService, logger)
	lessonHandler := handlers.NewLessonHandler(lessonService, logger)
	attendanceHandler := handlers.NewAttendanceHandler(attendanceService, logger)
	liveHandler := handlers.NewLiveHandler(liveService, jwtManager, liveHub, logger)

	router := routes.Setup(
		logger,
		jwtManager,
		cfg.AdminAPIKey,
		authHandler,
		adminHandler,
		groupHandler,
		studentHandler,
		staffHandler,
		lessonHandler,
		attendanceHandler,
		liveHandler,
	)

	server := cfg.HTTPServer(router)

	go func() {
		logger.WithFields(logrus.Fields{
			"port": cfg.AppPort,
			"env":  cfg.AppEnv,
		}).Info("server started")

		if err := server.ListenAndServe(); err != nil && err.Error() != "http: Server closed" {
			logger.WithError(err).Fatal("server stopped unexpectedly")
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.WithError(err).Error("graceful shutdown failed")
	}
}
