package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
	"medrese-back/pkg/auth"
)

type LessonService struct {
	lessonRepo     repository.LessonRepository
	groupRepo      repository.GroupRepository
	studentRepo    repository.StudentRepository
	attendanceRepo repository.AttendanceRepository
	accessService  *AccessService
}

func NewLessonService(
	lessonRepo repository.LessonRepository,
	groupRepo repository.GroupRepository,
	studentRepo repository.StudentRepository,
	attendanceRepo repository.AttendanceRepository,
	accessService *AccessService,
) *LessonService {
	return &LessonService{
		lessonRepo:     lessonRepo,
		groupRepo:      groupRepo,
		studentRepo:    studentRepo,
		attendanceRepo: attendanceRepo,
		accessService:  accessService,
	}
}

func (s *LessonService) Create(ctx context.Context, claims *auth.Claims, request models.CreateLessonRequest) (*models.Lesson, error) {
	topic := strings.TrimSpace(request.Topic)
	if topic == "" {
		return nil, models.ValidationError("Введите тему урока")
	}
	if len(topic) > 255 {
		return nil, models.ValidationError("Тема урока слишком длинная")
	}

	if strings.TrimSpace(request.Date) == "" {
		return nil, models.ValidationError("Укажите дату урока")
	}

	if _, err := time.Parse("2006-01-02", request.Date); err != nil {
		return nil, models.ValidationError("Дата должна быть в формате YYYY-MM-DD")
	}

	if _, err := s.accessService.EnsureGroupExists(ctx, claims.SchoolID, request.GroupID); err != nil {
		return nil, err
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, request.GroupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	lesson := &models.Lesson{
		ID:       uuid.NewString(),
		SchoolID: claims.SchoolID,
		GroupID:  request.GroupID,
		Topic:    topic,
		Date:     request.Date,
		Homework: normalizeHomework(request.Homework),
	}
	if len(lesson.Homework) > 2000 {
		return nil, models.ValidationError("Домашнее задание слишком длинное")
	}

	if err := s.lessonRepo.Create(ctx, lesson); err != nil {
		return nil, models.InternalError("Не удалось создать урок", err)
	}

	return lesson, nil
}

func (s *LessonService) GetByID(ctx context.Context, claims *auth.Claims, lessonID string) (*models.LessonDetailsResponse, error) {
	lesson, err := s.lessonRepo.GetByID(ctx, lessonID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Урок не найден")
		}
		return nil, models.InternalError("Не удалось получить урок", err)
	}

	allowed, err := s.accessService.CanViewGroup(ctx, claims, lesson.GroupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	group, err := s.groupRepo.GetByID(ctx, lesson.GroupID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Группа не найдена")
		}
		return nil, models.InternalError("Не удалось получить группу урока", err)
	}

	rows, err := s.attendanceRepo.ListRowsByLesson(ctx, lesson.ID, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить посещаемость урока", err)
	}
	if rows == nil {
		rows = []models.AttendanceRow{}
	}

	return &models.LessonDetailsResponse{
		Lesson:         *lesson,
		Group:          *group,
		AttendanceRows: rows,
	}, nil
}

func (s *LessonService) Update(ctx context.Context, claims *auth.Claims, lessonID string, request models.UpdateLessonRequest) (*models.LessonDetailsResponse, error) {
	topic := strings.TrimSpace(request.Topic)
	if topic == "" {
		return nil, models.ValidationError("Тема урока обязательна")
	}
	if len(topic) > 255 {
		return nil, models.ValidationError("Тема урока слишком длинная")
	}
	homework := normalizeHomework(request.Homework)
	if len(homework) > 2000 {
		return nil, models.ValidationError("Домашнее задание слишком длинное")
	}

	lesson, err := s.lessonRepo.GetByID(ctx, lessonID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Урок не найден")
		}
		return nil, models.InternalError("Не удалось получить урок", err)
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, lesson.GroupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	if err := s.lessonRepo.Update(ctx, lessonID, claims.SchoolID, topic, homework); err != nil {
		return nil, models.InternalError("Не удалось обновить урок", err)
	}

	updatedLesson, err := s.lessonRepo.GetByID(ctx, lessonID, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить обновлённый урок", err)
	}

	group, err := s.groupRepo.GetByID(ctx, lesson.GroupID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Группа не найдена")
		}
		return nil, models.InternalError("Не удалось получить группу урока", err)
	}

	rows, err := s.attendanceRepo.ListRowsByLesson(ctx, lessonID, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить посещаемость урока", err)
	}
	if rows == nil {
		rows = []models.AttendanceRow{}
	}

	return &models.LessonDetailsResponse{
		Lesson:         *updatedLesson,
		Group:          *group,
		AttendanceRows: rows,
	}, nil
}

func normalizeHomework(value string) string {
	return strings.TrimSpace(value)
}

func (s *LessonService) Delete(ctx context.Context, claims *auth.Claims, lessonID string) error {
	lesson, err := s.lessonRepo.GetByID(ctx, lessonID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Урок не найден")
		}
		return models.InternalError("Не удалось получить урок", err)
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, lesson.GroupID)
	if err != nil {
		return models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return models.ForbiddenError("Недостаточно прав")
	}

	if err := s.lessonRepo.DeleteCascade(ctx, lessonID, claims.SchoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Урок не найден")
		}
		return models.InternalError("Не удалось удалить урок", err)
	}

	return nil
}
