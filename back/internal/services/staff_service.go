package services

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
)

const (
	maxStaffAccountAttempts = 5
	staffLoginAlphabet      = "abcdefghijklmnopqrstuvwxyz0123456789"
	staffPasswordAlphabet   = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
)

type StaffService struct {
	staffRepo repository.StaffRepository
	groupRepo repository.GroupRepository
}

func NewStaffService(staffRepo repository.StaffRepository, groupRepo repository.GroupRepository) *StaffService {
	return &StaffService{
		staffRepo: staffRepo,
		groupRepo: groupRepo,
	}
}

func (s *StaffService) Create(ctx context.Context, schoolID string, request models.CreateStaffRequest) (*models.CreateStaffResponse, error) {
	firstName, lastName, middleName, phone, note, err := validateStaffProfileInput(request.FirstName, request.LastName, request.MiddleName, request.Phone, request.Note)
	if err != nil {
		return nil, err
	}

	groupIDs, groups, err := s.validateStaffGroups(ctx, schoolID, request.GroupIDs)
	if err != nil {
		return nil, err
	}

	label := buildStaffLabel(firstName, lastName)
	profile := &models.StaffProfile{
		ID:         uuid.NewString(),
		SchoolID:   schoolID,
		FirstName:  firstName,
		LastName:   lastName,
		MiddleName: middleName,
		Phone:      phone,
		Note:       note,
	}

	for range maxStaffAccountAttempts {
		login, err := generateStaffLogin(lastName)
		if err != nil {
			return nil, models.InternalError("Не удалось сгенерировать логин преподавателя", err)
		}

		password, err := staffRandomString(staffPasswordAlphabet, 10)
		if err != nil {
			return nil, models.InternalError("Не удалось сгенерировать пароль преподавателя", err)
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, models.InternalError("Не удалось подготовить пароль преподавателя", err)
		}

		user := &models.User{
			ID:           uuid.NewString(),
			SchoolID:     schoolID,
			Login:        login,
			PasswordHash: string(passwordHash),
			Role:         "staff",
			Label:        label,
		}
		profile.UserID = user.ID

		if err := s.staffRepo.CreateWithAccount(ctx, user, profile, groupIDs); err != nil {
			if isStaffUniqueViolation(err) {
				continue
			}
			return nil, models.InternalError("Не удалось создать преподавателя", err)
		}

		return &models.CreateStaffResponse{
			Staff: models.StaffDetails{
				ID:         profile.ID,
				UserID:     profile.UserID,
				FirstName:  profile.FirstName,
				LastName:   profile.LastName,
				MiddleName: profile.MiddleName,
				Phone:      profile.Phone,
				Note:       profile.Note,
				Groups:     groups,
			},
			Account: models.StudentAccountCredentials{
				Login:    user.Login,
				Password: password,
			},
		}, nil
	}

	return nil, models.ConflictError("Не удалось сгенерировать уникальный логин преподавателя, попробуйте ещё раз")
}

func (s *StaffService) List(ctx context.Context, schoolID string) ([]models.StaffDetails, error) {
	profiles, err := s.staffRepo.ListBySchool(ctx, schoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить список преподавателей", err)
	}
	if profiles == nil {
		return []models.StaffDetails{}, nil
	}

	items := make([]models.StaffDetails, 0, len(profiles))
	for _, profile := range profiles {
		groups, err := s.staffRepo.GetGroupsByStaffID(ctx, profile.ID, schoolID)
		if err != nil {
			return nil, models.InternalError("Не удалось получить список преподавателей", err)
		}

		items = append(items, models.StaffDetails{
			ID:         profile.ID,
			UserID:     profile.UserID,
			FirstName:  profile.FirstName,
			LastName:   profile.LastName,
			MiddleName: profile.MiddleName,
			Phone:      profile.Phone,
			Note:       profile.Note,
			Groups:     groups,
		})
	}

	return items, nil
}

func (s *StaffService) Update(ctx context.Context, schoolID string, staffID string, request models.UpdateStaffRequest) (*models.StaffDetails, error) {
	profile, err := s.staffRepo.GetByID(ctx, staffID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Преподаватель не найден")
		}
		return nil, models.InternalError("Не удалось получить преподавателя", err)
	}

	firstName, lastName, middleName, phone, note, validationErr := validateStaffProfileInput(request.FirstName, request.LastName, request.MiddleName, request.Phone, request.Note)
	if validationErr != nil {
		return nil, validationErr
	}

	profile.FirstName = firstName
	profile.LastName = lastName
	profile.MiddleName = middleName
	profile.Phone = phone
	profile.Note = note

	if err := s.staffRepo.Update(ctx, profile, buildStaffLabel(firstName, lastName)); err != nil {
		return nil, models.InternalError("Не удалось обновить преподавателя", err)
	}

	groups, err := s.staffRepo.GetGroupsByStaffID(ctx, staffID, schoolID)
	if err != nil {
		return nil, models.InternalError("Не удалось получить преподавателя", err)
	}

	return &models.StaffDetails{
		ID:         profile.ID,
		UserID:     profile.UserID,
		FirstName:  profile.FirstName,
		LastName:   profile.LastName,
		MiddleName: profile.MiddleName,
		Phone:      profile.Phone,
		Note:       profile.Note,
		Groups:     groups,
	}, nil
}

func (s *StaffService) UpdateGroups(ctx context.Context, schoolID string, staffID string, request models.UpdateStaffGroupsRequest) error {
	if _, err := s.staffRepo.GetByID(ctx, staffID, schoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Преподаватель не найден")
		}
		return models.InternalError("Не удалось получить преподавателя", err)
	}

	groupIDs, _, err := s.validateStaffGroups(ctx, schoolID, request.GroupIDs)
	if err != nil {
		return err
	}

	if err := s.staffRepo.ReplaceGroups(ctx, staffID, schoolID, groupIDs); err != nil {
		return models.InternalError("Не удалось обновить группы преподавателя", err)
	}

	return nil
}

func (s *StaffService) ResetAccess(ctx context.Context, schoolID string, staffID string) (*models.ResetStaffAccessResponse, error) {
	if _, err := s.staffRepo.GetByID(ctx, staffID, schoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Преподаватель не найден")
		}
		return nil, models.InternalError("Не удалось получить преподавателя", err)
	}

	account, err := s.staffRepo.GetAccountByStaffID(ctx, staffID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Аккаунт преподавателя не найден")
		}
		return nil, models.InternalError("Не удалось получить доступ преподавателя", err)
	}

	password, err := staffRandomString(staffPasswordAlphabet, 10)
	if err != nil {
		return nil, models.InternalError("Не удалось сгенерировать пароль преподавателя", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, models.InternalError("Не удалось подготовить пароль преподавателя", err)
	}

	if err := s.staffRepo.UpdateAccountPassword(ctx, staffID, schoolID, string(passwordHash)); err != nil {
		return nil, models.InternalError("Не удалось обновить пароль преподавателя", err)
	}

	return &models.ResetStaffAccessResponse{
		StaffID: staffID,
		Account: models.StudentAccountCredentials{
			Login:    account.Login,
			Password: password,
		},
	}, nil
}

func (s *StaffService) Delete(ctx context.Context, schoolID string, staffID string) error {
	if err := s.staffRepo.Delete(ctx, staffID, schoolID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.NotFoundError("Преподаватель не найден")
		}
		return models.InternalError("Не удалось удалить преподавателя", err)
	}

	return nil
}

func validateStaffProfileInput(firstNameRaw string, lastNameRaw string, middleNameRaw string, phoneRaw string, noteRaw string) (string, string, string, string, string, error) {
	firstName := strings.TrimSpace(firstNameRaw)
	lastName := strings.TrimSpace(lastNameRaw)
	middleName := strings.TrimSpace(middleNameRaw)
	phone := strings.TrimSpace(phoneRaw)
	note := strings.TrimSpace(noteRaw)

	if len(firstName) < 2 || len(firstName) > 80 {
		return "", "", "", "", "", models.ValidationError("Имя преподавателя должно быть от 2 до 80 символов")
	}
	if len(lastName) < 2 || len(lastName) > 80 {
		return "", "", "", "", "", models.ValidationError("Фамилия преподавателя должна быть от 2 до 80 символов")
	}
	if len(middleName) > 80 {
		return "", "", "", "", "", models.ValidationError("Отчество преподавателя слишком длинное")
	}
	if len(phone) > 40 {
		return "", "", "", "", "", models.ValidationError("Телефон преподавателя слишком длинный")
	}
	if len(note) > 500 {
		return "", "", "", "", "", models.ValidationError("Заметка преподавателя слишком длинная")
	}

	return firstName, lastName, middleName, phone, note, nil
}

func (s *StaffService) validateStaffGroups(ctx context.Context, schoolID string, rawGroupIDs []string) ([]string, []models.StaffGroupInfo, error) {
	groupIDs := normalizeUniqueIDs(rawGroupIDs)
	if len(groupIDs) == 0 {
		return []string{}, []models.StaffGroupInfo{}, nil
	}

	groups := make([]models.StaffGroupInfo, 0, len(groupIDs))
	for _, groupID := range groupIDs {
		group, err := s.groupRepo.GetByID(ctx, groupID, schoolID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, nil, models.NotFoundError("Группа не найдена")
			}
			return nil, nil, models.InternalError("Не удалось проверить группы преподавателя", err)
		}

		groups = append(groups, models.StaffGroupInfo{
			ID:   group.ID,
			Name: group.Name,
		})
	}

	return groupIDs, groups, nil
}

func normalizeUniqueIDs(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))

	for _, value := range values {
		id := strings.TrimSpace(value)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}

	return result
}

func buildStaffLabel(firstName string, lastName string) string {
	return strings.TrimSpace(fmt.Sprintf("%s %s", firstName, lastName))
}

func generateStaffLogin(lastName string) (string, error) {
	base := slugLoginPart(lastName)
	if base == "" {
		base = "user"
	}

	suffix, err := staffRandomString("23456789", 4)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("staff_%s_%s", base, suffix), nil
}

func slugLoginPart(value string) string {
	var builder strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case unicode.IsSpace(r) || r == '-' || r == '_':
			if builder.Len() > 0 {
				builder.WriteRune('_')
			}
		}
	}

	result := strings.Trim(builder.String(), "_")
	if len(result) > 12 {
		result = result[:12]
	}

	return result
}

func staffRandomString(alphabet string, length int) (string, error) {
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

func isStaffUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
