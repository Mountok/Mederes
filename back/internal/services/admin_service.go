package services

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
)

type AdminService struct {
	adminRepo repository.AdminRepository
}

func NewAdminService(adminRepo repository.AdminRepository) *AdminService {
	return &AdminService{adminRepo: adminRepo}
}

func (s *AdminService) CreateSchoolWithUsers(ctx context.Context, request models.CreateSchoolWithUsersRequest) (*models.CreateSchoolWithUsersResponse, error) {
	schoolName := strings.TrimSpace(request.SchoolName)
	if schoolName == "" {
		return nil, models.ValidationError("Введите название школы")
	}

	teacherLogin := strings.TrimSpace(request.Teacher.Login)
	parentLogin := strings.TrimSpace(request.Parent.Login)
	teacherPassword := strings.TrimSpace(request.Teacher.Password)
	parentPassword := strings.TrimSpace(request.Parent.Password)
	teacherLabel := strings.TrimSpace(request.Teacher.Label)
	parentLabel := strings.TrimSpace(request.Parent.Label)

	if teacherLogin == "" || parentLogin == "" {
		return nil, models.ValidationError("Укажите логины для teacher и parent")
	}

	if teacherLogin == parentLogin {
		return nil, models.ValidationError("Логины teacher и parent должны отличаться")
	}

	if len(teacherPassword) < 8 || len(parentPassword) < 8 {
		return nil, models.ValidationError("Пароли teacher и parent должны быть не короче 8 символов")
	}

	if teacherLabel == "" {
		teacherLabel = "Учитель"
	}
	if parentLabel == "" {
		parentLabel = "Родитель"
	}

	teacherHash, err := bcrypt.GenerateFromPassword([]byte(teacherPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.InternalError("Не удалось подготовить пароль teacher", err)
	}

	parentHash, err := bcrypt.GenerateFromPassword([]byte(parentPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.InternalError("Не удалось подготовить пароль parent", err)
	}

	school := &models.School{
		ID:   uuid.NewString(),
		Name: schoolName,
	}
	teacher := &models.User{
		ID:           uuid.NewString(),
		SchoolID:     school.ID,
		Login:        teacherLogin,
		PasswordHash: string(teacherHash),
		Role:         "teacher",
		Label:        teacherLabel,
	}
	parent := &models.User{
		ID:           uuid.NewString(),
		SchoolID:     school.ID,
		Login:        parentLogin,
		PasswordHash: string(parentHash),
		Role:         "parent",
		Label:        parentLabel,
	}

	if err := s.adminRepo.CreateSchoolWithUsers(ctx, school, teacher, parent); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, models.ConflictError("Школа или логин уже существуют")
		}
		return nil, models.InternalError("Не удалось создать школу и пользователей", err)
	}

	return &models.CreateSchoolWithUsersResponse{
		School: *school,
		Teacher: models.UserInfo{
			ID:    teacher.ID,
			Login: teacher.Login,
			Role:  teacher.Role,
			Label: teacher.Label,
		},
		Parent: models.UserInfo{
			ID:    parent.ID,
			Login: parent.Login,
			Role:  parent.Role,
			Label: parent.Label,
		},
	}, nil
}
