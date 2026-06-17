package repository

import (
	"context"

	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type AuthRepository interface {
	GetByLogin(ctx context.Context, login string) (*models.User, error)
	GetByID(ctx context.Context, userID string, schoolID string) (*models.User, error)
}

type authRepository struct {
	db *sqlx.DB
}

func NewAuthRepository(db *sqlx.DB) AuthRepository {
	return &authRepository{db: db}
}

func (r *authRepository) GetByLogin(ctx context.Context, login string) (*models.User, error) {
	var user models.User
	if err := r.db.GetContext(ctx, &user, `
		SELECT u.id, u.school_id, s.name AS school_name, u.student_id, u.login, u.password_hash, u.role, u.label, u.created_at, u.updated_at
		FROM users u
		JOIN schools s ON s.id = u.school_id
		WHERE login = $1
		LIMIT 1
	`, login); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *authRepository) GetByID(ctx context.Context, userID string, schoolID string) (*models.User, error) {
	var user models.User
	if err := r.db.GetContext(ctx, &user, `
		SELECT u.id, u.school_id, s.name AS school_name, u.student_id, u.login, u.password_hash, u.role, u.label, u.created_at, u.updated_at
		FROM users u
		JOIN schools s ON s.id = u.school_id
		WHERE u.id = $1 AND u.school_id = $2
		LIMIT 1
	`, userID, schoolID); err != nil {
		return nil, err
	}

	return &user, nil
}
