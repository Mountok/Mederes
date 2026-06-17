package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"medrese-back/internal/models"
	"medrese-back/internal/repository"
	"medrese-back/pkg/auth"
)

type AccessService struct {
	groupRepo   repository.GroupRepository
	studentRepo repository.StudentRepository
	staffRepo   repository.StaffRepository
}

func NewAccessService(
	groupRepo repository.GroupRepository,
	studentRepo repository.StudentRepository,
	staffRepo repository.StaffRepository,
) *AccessService {
	return &AccessService{
		groupRepo:   groupRepo,
		studentRepo: studentRepo,
		staffRepo:   staffRepo,
	}
}

func (s *AccessService) CanManageGroup(ctx context.Context, claims *auth.Claims, groupID string) (bool, error) {
	if claims == nil {
		return false, nil
	}

	switch claims.Role {
	case "teacher":
		return true, nil
	case "staff":
		if strings.TrimSpace(claims.UserID) == "" {
			return false, nil
		}
		return s.staffRepo.HasGroupAccess(ctx, claims.UserID, claims.SchoolID, groupID)
	default:
		return false, nil
	}
}

func (s *AccessService) CanViewGroup(ctx context.Context, claims *auth.Claims, groupID string) (bool, error) {
	if claims == nil {
		return false, nil
	}

	switch claims.Role {
	case "teacher", "parent":
		return true, nil
	case "staff":
		if strings.TrimSpace(claims.UserID) == "" {
			return false, nil
		}
		return s.staffRepo.HasGroupAccess(ctx, claims.UserID, claims.SchoolID, groupID)
	case "student":
		if strings.TrimSpace(claims.StudentID) == "" {
			return false, nil
		}
		student, err := s.studentRepo.GetByID(ctx, claims.StudentID, claims.SchoolID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return false, nil
			}
			return false, err
		}
		return student.GroupID == groupID, nil
	default:
		return false, nil
	}
}

func (s *AccessService) EnsureGroupExists(ctx context.Context, schoolID string, groupID string) (*models.Group, error) {
	group, err := s.groupRepo.GetByID(ctx, groupID, schoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Группа не найдена")
		}
		return nil, models.InternalError("Не удалось получить группу", err)
	}

	return group, nil
}
