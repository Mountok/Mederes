package services

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"medrese-back/internal/models"
	"medrese-back/internal/repository"
)

var platformLoginPattern = regexp.MustCompile(`^[a-z0-9._-]{4,40}$`)

type PlatformService struct{ repo repository.PlatformRepository }

func NewPlatformService(repo repository.PlatformRepository) *PlatformService {
	return &PlatformService{repo: repo}
}

func (s *PlatformService) List(ctx context.Context) ([]models.PlatformSchool, error) {
	items, err := s.repo.ListSchools(ctx)
	if err != nil {
		return nil, models.InternalError("Не удалось загрузить школы", err)
	}
	return items, nil
}

func (s *PlatformService) Detail(ctx context.Context, schoolID string) (*models.PlatformSchool, []models.PlatformUser, error) {
	if _, err := uuid.Parse(schoolID); err != nil || schoolID == models.PlatformSchoolID {
		return nil, nil, models.NotFoundError("Школа не найдена")
	}
	school, err := s.repo.GetSchool(ctx, schoolID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, models.NotFoundError("Школа не найдена")
	}
	if err != nil {
		return nil, nil, models.InternalError("Не удалось загрузить школу", err)
	}
	users, err := s.repo.ListSchoolUsers(ctx, schoolID)
	if err != nil {
		return nil, nil, models.InternalError("Не удалось загрузить пользователей", err)
	}
	return school, users, nil
}

func (s *PlatformService) Create(ctx context.Context, actorID string, req models.CreatePlatformSchoolRequest) (*models.PlatformSchool, models.PlatformAccountResponse, error) {
	name := strings.TrimSpace(req.Name)
	login := strings.ToLower(strings.TrimSpace(req.AdminLogin))
	label := strings.TrimSpace(req.AdminLabel)
	if name == "" || utf8.RuneCountInString(name) > 120 {
		return nil, models.PlatformAccountResponse{}, models.ValidationError("Название школы: от 1 до 120 символов")
	}
	if !platformLoginPattern.MatchString(login) {
		return nil, models.PlatformAccountResponse{}, models.ValidationError("Логин: 4–40 латинских букв, цифр, точек, дефисов или подчёркиваний")
	}
	if label == "" {
		label = "Администратор школы"
	}
	if utf8.RuneCountInString(label) > 80 {
		return nil, models.PlatformAccountResponse{}, models.ValidationError("Имя администратора слишком длинное")
	}
	password, err := randomString(passwordAlphabet, 24)
	if err != nil {
		return nil, models.PlatformAccountResponse{}, models.InternalError("Не удалось создать пароль", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.PlatformAccountResponse{}, models.InternalError("Не удалось сохранить пароль", err)
	}
	school := &models.School{ID: uuid.NewString(), Name: name}
	admin := &models.User{ID: uuid.NewString(), SchoolID: school.ID, Login: login, PasswordHash: string(hash), Role: "teacher", Label: label}
	if err := s.repo.CreateSchool(ctx, actorID, school, admin); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, models.PlatformAccountResponse{}, models.ConflictError("Такой логин уже используется")
		}
		return nil, models.PlatformAccountResponse{}, models.InternalError("Не удалось создать школу", err)
	}
	created, err := s.repo.GetSchool(ctx, school.ID)
	if err != nil {
		return nil, models.PlatformAccountResponse{}, models.InternalError("Школа создана, но не удалось загрузить её", err)
	}
	return created, models.PlatformAccountResponse{Login: login, Password: password}, nil
}

func (s *PlatformService) Rename(ctx context.Context, actorID, schoolID, name string) (*models.PlatformSchool, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 120 {
		return nil, models.ValidationError("Название школы: от 1 до 120 символов")
	}
	if _, err := uuid.Parse(schoolID); err != nil || schoolID == models.PlatformSchoolID {
		return nil, models.NotFoundError("Школа не найдена")
	}
	if err := s.repo.RenameSchool(ctx, actorID, schoolID, name); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Школа не найдена")
		}
		return nil, models.InternalError("Не удалось обновить школу", err)
	}
	school, err := s.repo.GetSchool(ctx, schoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось загрузить школу", err)
	}
	return school, nil
}

func (s *PlatformService) ResetAccess(ctx context.Context, actorID, schoolID, userID string) (*models.PlatformAccountResponse, error) {
	if _, err := uuid.Parse(schoolID); err != nil || schoolID == models.PlatformSchoolID {
		return nil, models.NotFoundError("Школа не найдена")
	}
	if _, err := uuid.Parse(userID); err != nil {
		return nil, models.NotFoundError("Пользователь не найден")
	}
	users, err := s.repo.ListSchoolUsers(ctx, schoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось загрузить пользователей", err)
	}
	var login string
	for _, user := range users {
		if user.ID == userID {
			login = user.Login
			break
		}
	}
	if login == "" {
		return nil, models.NotFoundError("Пользователь не найден")
	}
	password, err := randomString(passwordAlphabet, 24)
	if err != nil {
		return nil, models.InternalError("Не удалось создать пароль", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.InternalError("Не удалось сохранить пароль", err)
	}
	if err := s.repo.ResetUserPassword(ctx, actorID, schoolID, userID, string(hash)); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Пользователь не найден")
		}
		return nil, models.InternalError("Не удалось сбросить пароль", err)
	}
	return &models.PlatformAccountResponse{Login: login, Password: password}, nil
}
