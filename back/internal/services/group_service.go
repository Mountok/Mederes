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

type GroupService struct {
	groupRepo      repository.GroupRepository
	studentRepo    repository.StudentRepository
	staffRepo      repository.StaffRepository
	lessonRepo     repository.LessonRepository
	attendanceRepo repository.AttendanceRepository
	accessService  *AccessService
}

func NewGroupService(
	groupRepo repository.GroupRepository,
	studentRepo repository.StudentRepository,
	staffRepo repository.StaffRepository,
	lessonRepo repository.LessonRepository,
	attendanceRepo repository.AttendanceRepository,
	accessService *AccessService,
) *GroupService {
	return &GroupService{
		groupRepo:      groupRepo,
		studentRepo:    studentRepo,
		staffRepo:      staffRepo,
		lessonRepo:     lessonRepo,
		attendanceRepo: attendanceRepo,
		accessService:  accessService,
	}
}

func (s *GroupService) List(ctx context.Context, claims *auth.Claims) ([]models.GroupListItem, error) {
	if claims.Role == "student" {
		student, err := s.studentRepo.GetByID(ctx, claims.StudentID, claims.SchoolID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.NotFoundError("Ученик не найден")
			}
			return nil, models.InternalError("Не удалось получить данные ученика", err)
		}

		item, err := s.groupRepo.GetListItemByID(ctx, student.GroupID, claims.SchoolID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.NotFoundError("Группа не найдена")
			}
			return nil, models.InternalError("Не удалось получить список групп", err)
		}

		return []models.GroupListItem{*item}, nil
	}

	if claims.Role == "staff" {
		items, err := s.staffRepo.ListGroupItemsByUserID(ctx, claims.UserID, claims.SchoolID)
		if err != nil {
			return nil, models.InternalError("Не удалось получить список групп", err)
		}
		if items == nil {
			items = []models.GroupListItem{}
		}

		return items, nil
	}

	items, err := s.groupRepo.ListBySchool(ctx, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить список групп", err)
	}
	if items == nil {
		items = []models.GroupListItem{}
	}

	return items, nil
}

func (s *GroupService) Create(ctx context.Context, schoolID string, request models.CreateGroupRequest) (*models.Group, error) {
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return nil, models.ValidationError("Введите название группы")
	}

	group := &models.Group{
		ID:          uuid.NewString(),
		SchoolID:    schoolID,
		Name:        name,
		Description: strings.TrimSpace(request.Description),
	}

	if err := s.groupRepo.Create(ctx, group); err != nil {
		return nil, models.InternalError("Не удалось создать группу", err)
	}

	return group, nil
}

func (s *GroupService) GetByID(ctx context.Context, id string, claims *auth.Claims) (*models.GroupDetailsResponse, error) {
	group, err := s.groupRepo.GetByID(ctx, id, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Группа не найдена")
		}
		return nil, models.InternalError("Не удалось получить группу", err)
	}

	allowed, err := s.accessService.CanViewGroup(ctx, claims, id)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	students, err := s.studentRepo.ListByGroup(ctx, id, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить список учеников", err)
	}
	if students == nil {
		students = []models.Student{}
	}

	lessons, err := s.lessonRepo.ListByGroup(ctx, id, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить список уроков", err)
	}
	if lessons == nil {
		lessons = []models.LessonPreview{}
	}

	return &models.GroupDetailsResponse{
		Group:    *group,
		Students: students,
		Lessons:  lessons,
	}, nil
}

func (s *GroupService) Delete(ctx context.Context, id string, schoolID string) error {
	if err := s.groupRepo.DeleteCascade(ctx, id, schoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Группа не найдена")
		}
		return models.InternalError("Не удалось удалить группу", err)
	}

	return nil
}

func (s *GroupService) GetJournal(ctx context.Context, claims *auth.Claims, groupID string, from time.Time, to time.Time) (*models.GroupJournalResponse, error) {
	if claims.Role != "teacher" && claims.Role != "parent" && claims.Role != "student" && claims.Role != "staff" {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	group, err := s.groupRepo.GetByID(ctx, groupID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Группа не найдена")
		}
		return nil, models.InternalError("Не удалось загрузить журнал группы", err)
	}

	allowed, err := s.accessService.CanViewGroup(ctx, claims, groupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	students, err := s.studentRepo.ListByGroup(ctx, groupID, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось загрузить журнал группы", err)
	}
	if students == nil {
		students = []models.Student{}
	}

	lessons, err := s.lessonRepo.ListByGroupAndPeriod(ctx, groupID, claims.SchoolID, from, to)
	if err != nil {
		return nil, models.InternalError("Не удалось загрузить журнал группы", err)
	}
	if lessons == nil {
		lessons = []models.GroupJournalLesson{}
	}

	lessonIDs := make([]string, 0, len(lessons))
	for _, lesson := range lessons {
		lessonIDs = append(lessonIDs, lesson.ID)
	}

	entries, err := s.attendanceRepo.ListEntriesByLessonIDs(ctx, lessonIDs, claims.SchoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось загрузить журнал группы", err)
	}
	if entries == nil {
		entries = []models.GroupJournalEntry{}
	}

	journalStudents := make([]models.GroupJournalStudent, 0, len(students))
	for _, student := range students {
		journalStudents = append(journalStudents, models.GroupJournalStudent{
			ID:   student.ID,
			Name: student.Name,
			Note: student.Note,
		})
	}

	return &models.GroupJournalResponse{
		Group: models.GroupJournalGroup{
			ID:   group.ID,
			Name: group.Name,
		},
		Period: models.GroupJournalPeriod{
			From: from.Format("2006-01-02"),
			To:   to.Format("2006-01-02"),
		},
		Students: journalStudents,
		Lessons:  lessons,
		Entries:  entries,
	}, nil
}
