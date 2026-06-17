package services

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
	"medrese-back/pkg/auth"
)

const (
	maxStudentAccountAttempts = 5
	loginAlphabet             = "abcdefghijklmnopqrstuvwxyz0123456789"
	passwordAlphabet          = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
)

type StudentService struct {
	studentRepo   repository.StudentRepository
	groupRepo     repository.GroupRepository
	accessService *AccessService
}

func NewStudentService(studentRepo repository.StudentRepository, groupRepo repository.GroupRepository, accessService *AccessService) *StudentService {
	return &StudentService{
		studentRepo:   studentRepo,
		groupRepo:     groupRepo,
		accessService: accessService,
	}
}

func (s *StudentService) Create(ctx context.Context, claims *auth.Claims, request models.CreateStudentRequest) (*models.CreateStudentResponse, error) {
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return nil, models.ValidationError("Введите имя ученика")
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

	student := &models.Student{
		ID:       uuid.NewString(),
		SchoolID: claims.SchoolID,
		GroupID:  request.GroupID,
		Name:     name,
		Note:     strings.TrimSpace(request.Note),
	}

	for range maxStudentAccountAttempts {
		login, err := randomString(loginAlphabet, 10)
		if err != nil {
			return nil, models.InternalError("Не удалось сгенерировать логин ученика", err)
		}

		password, err := randomString(passwordAlphabet, 10)
		if err != nil {
			return nil, models.InternalError("Не удалось сгенерировать пароль ученика", err)
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, models.InternalError("Не удалось подготовить пароль ученика", err)
		}

		studentID := student.ID
		account := &models.User{
			ID:           uuid.NewString(),
			SchoolID:     claims.SchoolID,
			StudentID:    &studentID,
			Login:        "student-" + login,
			PasswordHash: string(passwordHash),
			Role:         "student",
			Label:        "Ученик",
		}

		if err := s.studentRepo.CreateWithAccount(ctx, student, account); err != nil {
			if isUniqueViolation(err) {
				continue
			}
			return nil, models.InternalError("Не удалось создать ученика", err)
		}

		return &models.CreateStudentResponse{
			Student: *student,
			Account: models.StudentAccountCredentials{
				Login:    account.Login,
				Password: password,
			},
		}, nil
	}

	return nil, models.ConflictError("Не удалось сгенерировать уникальный логин ученика, попробуйте ещё раз")
}

func (s *StudentService) Update(ctx context.Context, claims *auth.Claims, studentID string, request models.UpdateStudentRequest) (*models.Student, error) {
	if request.Name == nil && request.Note == nil {
		return nil, models.ValidationError("Передайте хотя бы одно поле для обновления")
	}

	student, err := s.studentRepo.GetByID(ctx, studentID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Ученик не найден")
		}
		return nil, models.InternalError("Не удалось получить ученика", err)
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, student.GroupID)
	if err != nil {
		return nil, models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	if request.Name != nil {
		name := strings.TrimSpace(*request.Name)
		if name == "" {
			return nil, models.ValidationError("Введите имя ученика")
		}
		student.Name = name
	}

	if request.Note != nil {
		student.Note = strings.TrimSpace(*request.Note)
	}

	if err := s.studentRepo.Update(ctx, student); err != nil {
		return nil, models.InternalError("Не удалось обновить ученика", err)
	}

	return student, nil
}

func (s *StudentService) Delete(ctx context.Context, claims *auth.Claims, studentID string) error {
	student, err := s.studentRepo.GetByID(ctx, studentID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Ученик не найден")
		}
		return models.InternalError("Не удалось получить ученика", err)
	}

	allowed, err := s.accessService.CanManageGroup(ctx, claims, student.GroupID)
	if err != nil {
		return models.InternalError("Не удалось проверить доступ к группе", err)
	}
	if !allowed {
		return models.ForbiddenError("Недостаточно прав")
	}

	if err := s.studentRepo.DeleteCascade(ctx, studentID, claims.SchoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Ученик не найден")
		}
		return models.InternalError("Не удалось удалить ученика", err)
	}

	return nil
}

func (s *StudentService) ResetAccess(ctx context.Context, schoolID string, studentID string) (*models.StudentAccessResponse, error) {
	if _, err := s.studentRepo.GetByID(ctx, studentID, schoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Ученик не найден")
		}
		return nil, models.InternalError("Не удалось получить ученика", err)
	}

	account, err := s.studentRepo.GetAccountByStudentID(ctx, studentID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Аккаунт ученика не найден")
		}
		return nil, models.InternalError("Не удалось получить доступ ученика", err)
	}

	password, err := randomString(passwordAlphabet, 10)
	if err != nil {
		return nil, models.InternalError("Не удалось сгенерировать пароль ученика", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.InternalError("Не удалось подготовить пароль ученика", err)
	}

	if err := s.studentRepo.UpdateAccountPassword(ctx, studentID, schoolID, string(passwordHash)); err != nil {
		return nil, models.InternalError("Не удалось обновить пароль ученика", err)
	}

	return &models.StudentAccessResponse{
		StudentID: studentID,
		Account: models.StudentAccountCredentials{
			Login:    account.Login,
			Password: password,
		},
	}, nil
}

func randomString(alphabet string, length int) (string, error) {
	if length <= 0 {
		return "", nil
	}

	bytes := make([]byte, length)
	raw := make([]byte, length)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}

	for i := range raw {
		bytes[i] = alphabet[int(raw[i])%len(alphabet)]
	}

	return string(bytes), nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
