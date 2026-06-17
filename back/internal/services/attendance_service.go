package services

import (
	"context"
	"database/sql"
	"errors"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
	"medrese-back/pkg/auth"
)

type AttendanceService struct {
	attendanceRepo repository.AttendanceRepository
	lessonRepo     repository.LessonRepository
	groupRepo      repository.GroupRepository
	studentRepo    repository.StudentRepository
	accessService  *AccessService
}

func NewAttendanceService(
	attendanceRepo repository.AttendanceRepository,
	lessonRepo repository.LessonRepository,
	groupRepo repository.GroupRepository,
	studentRepo repository.StudentRepository,
	accessService *AccessService,
) *AttendanceService {
	return &AttendanceService{
		attendanceRepo: attendanceRepo,
		lessonRepo:     lessonRepo,
		groupRepo:      groupRepo,
		studentRepo:    studentRepo,
		accessService:  accessService,
	}
}

func (s *AttendanceService) Update(ctx context.Context, claims *auth.Claims, request models.UpdateAttendanceRequest) (*models.LessonDetailsResponse, error) {
	if request.LessonID == "" || request.StudentID == "" {
		return nil, models.ValidationError("Укажите lessonId и studentId")
	}

	if !request.Attended.Set && !request.Grade.Set {
		return nil, models.ValidationError("Передайте attended и/или grade")
	}

	if request.Grade.Set && request.Grade.Value != nil {
		if *request.Grade.Value < 1 || *request.Grade.Value > 5 {
			return nil, models.ValidationError("Оценка должна быть от 1 до 5")
		}
	}

	lesson, group, err := s.getLessonAndGroup(ctx, claims.SchoolID, request.LessonID)
	if err != nil {
		return nil, err
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, lesson.GroupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	student, err := s.studentRepo.GetByID(ctx, request.StudentID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Ученик не найден")
		}
		return nil, models.InternalError("Не удалось получить ученика", err)
	}

	if student.GroupID != lesson.GroupID {
		return nil, models.NotFoundError("Ученик не найден в рамках урока")
	}

	if err := s.attendanceRepo.Upsert(ctx, repository.AttendanceMutation{
		SchoolID:    claims.SchoolID,
		LessonID:    request.LessonID,
		StudentID:   request.StudentID,
		AttendedSet: request.Attended.Set,
		Attended:    request.Attended.Value,
		GradeSet:    request.Grade.Set,
		Grade:       request.Grade.Value,
	}); err != nil {
		return nil, models.InternalError("Не удалось обновить посещаемость", err)
	}

	return s.lessonDetails(ctx, claims.SchoolID, lesson, group)
}

func (s *AttendanceService) SetForAll(ctx context.Context, claims *auth.Claims, lessonID string, attended bool) (*models.LessonDetailsResponse, error) {
	lesson, group, err := s.getLessonAndGroup(ctx, claims.SchoolID, lessonID)
	if err != nil {
		return nil, err
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, lesson.GroupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	if err := s.attendanceRepo.SetForAll(ctx, lesson.ID, lesson.GroupID, claims.SchoolID, attended); err != nil {
		return nil, models.InternalError("Не удалось массово обновить посещаемость", err)
	}

	return s.lessonDetails(ctx, claims.SchoolID, lesson, group)
}

func (s *AttendanceService) getLessonAndGroup(ctx context.Context, schoolID string, lessonID string) (*models.Lesson, *models.Group, error) {
	lesson, err := s.lessonRepo.GetByID(ctx, lessonID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, models.NotFoundError("Урок не найден")
		}
		return nil, nil, models.InternalError("Не удалось получить урок", err)
	}

	group, err := s.groupRepo.GetByID(ctx, lesson.GroupID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, models.NotFoundError("Группа не найдена")
		}
		return nil, nil, models.InternalError("Не удалось получить группу урока", err)
	}

	return lesson, group, nil
}

func (s *AttendanceService) lessonDetails(ctx context.Context, schoolID string, lesson *models.Lesson, group *models.Group) (*models.LessonDetailsResponse, error) {
	rows, err := s.attendanceRepo.ListRowsByLesson(ctx, lesson.ID, schoolID)
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
