package services

import (
	"context"
	"database/sql"
	"errors"
	"net/mail"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"medrese-back/internal/models"
	"medrese-back/pkg/auth"
)

type readerStore interface {
	Create(context.Context, models.Reader) error
	ByEmail(context.Context, string) (*models.Reader, error)
	ByID(context.Context, string) (*models.Reader, error)
}

type ReaderService struct {
	repo readerStore
	jwt  *auth.JWTManager
}

func NewReaderService(repo readerStore, jwt *auth.JWTManager) *ReaderService {
	return &ReaderService{repo: repo, jwt: jwt}
}

func readerEmail(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func validReaderEmail(value string) bool {
	address, err := mail.ParseAddress(value)
	return err == nil && address.Address == value && len(value) <= 254
}

func (s *ReaderService) Register(ctx context.Context, request models.ReaderAuthRequest) (*models.ReaderAuthResponse, error) {
	email := readerEmail(request.Email)
	name := strings.TrimSpace(request.Name)
	if !validReaderEmail(email) || name == "" || len([]rune(name)) > 80 || len(request.Password) < 12 || len(request.Password) > 72 {
		return nil, models.ValidationError("Укажите имя, действительный email и пароль от 12 до 72 символов")
	}
	if !request.PrivacyConsent || !request.TermsAccepted {
		return nil, models.ValidationError("Подтвердите согласие на обработку данных и условия использования")
	}
	if !request.AdultConfirmed {
		return nil, models.ValidationError("Личная регистрация доступна с 18 лет. Для ребёнка используйте доступ через школу")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.InternalError("Не удалось создать аккаунт", err)
	}
	reader := models.Reader{ID: uuid.NewString(), Email: email, PasswordHash: string(hash), Name: name}
	if err := s.repo.Create(ctx, reader); err != nil {
		var pgErr *pq.Error
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, models.ConflictError("Этот email уже зарегистрирован")
		}
		return nil, models.InternalError("Не удалось создать аккаунт", err)
	}
	return s.issue(reader)
}

func (s *ReaderService) Login(ctx context.Context, request models.ReaderAuthRequest) (*models.ReaderAuthResponse, error) {
	reader, err := s.repo.ByEmail(ctx, readerEmail(request.Email))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.UnauthorizedError("Неверный email или пароль")
		}
		return nil, models.InternalError("Не удалось выполнить вход", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(reader.PasswordHash), []byte(request.Password)) != nil {
		return nil, models.UnauthorizedError("Неверный email или пароль")
	}
	return s.issue(*reader)
}

func (s *ReaderService) Me(ctx context.Context, id string) (*models.ReaderAuthResponse, error) {
	reader, err := s.repo.ByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.UnauthorizedError("Пользователь не найден")
		}
		return nil, models.InternalError("Не удалось загрузить аккаунт", err)
	}
	return &models.ReaderAuthResponse{User: readerInfo(*reader)}, nil
}

func (s *ReaderService) issue(reader models.Reader) (*models.ReaderAuthResponse, error) {
	token, err := s.jwt.GenerateToken(reader.ID, "", "reader", "")
	if err != nil {
		return nil, models.InternalError("Не удалось создать токен", err)
	}
	return &models.ReaderAuthResponse{Token: token, User: readerInfo(reader)}, nil
}

func readerInfo(reader models.Reader) models.UserInfo {
	return models.UserInfo{ID: reader.ID, Login: reader.Email, Role: "reader", Label: reader.Name}
}
