package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
	"medrese-back/pkg/auth"
)

type AuthService struct {
	authRepo   repository.AuthRepository
	jwtManager *auth.JWTManager
}

func NewAuthService(authRepo repository.AuthRepository, jwtManager *auth.JWTManager) *AuthService {
	return &AuthService{
		authRepo:   authRepo,
		jwtManager: jwtManager,
	}
}

func (s *AuthService) Login(ctx context.Context, request models.LoginRequest) (*models.LoginResponse, error) {
	login := strings.TrimSpace(request.Login)
	password := strings.TrimSpace(request.Password)
	if login == "" || password == "" {
		return nil, models.ValidationError("Введите логин и пароль")
	}

	user, err := s.authRepo.GetByLogin(ctx, login)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.UnauthorizedError("Неверный логин или пароль")
		}
		return nil, models.InternalError("Не удалось выполнить вход", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, models.UnauthorizedError("Неверный логин или пароль")
	}

	token, err := s.jwtManager.GenerateToken(user.ID, user.SchoolID, user.Role, valueOrEmpty(user.StudentID))
	if err != nil {
		return nil, models.InternalError("Не удалось создать токен", err)
	}

	return &models.LoginResponse{
		Token: token,
		User: models.UserInfo{
			ID:        user.ID,
			Login:     user.Login,
			Role:      user.Role,
			Label:     user.Label,
			StudentID: user.StudentID,
		},
		School: models.SchoolInfo{
			ID:   user.SchoolID,
			Name: user.SchoolName,
		},
	}, nil
}

func (s *AuthService) Me(ctx context.Context, userID string, schoolID string) (*models.CurrentUserResponse, error) {
	user, err := s.authRepo.GetByID(ctx, userID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.UnauthorizedError("Пользователь не найден")
		}
		return nil, models.InternalError("Не удалось получить профиль пользователя", err)
	}

	return &models.CurrentUserResponse{
		User: models.UserInfo{
			ID:        user.ID,
			Login:     user.Login,
			Role:      user.Role,
			Label:     user.Label,
			StudentID: user.StudentID,
		},
		School: models.SchoolInfo{
			ID:   user.SchoolID,
			Name: user.SchoolName,
		},
	}, nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
