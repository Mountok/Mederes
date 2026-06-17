package repository

import (
	"context"

	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type AdminRepository interface {
	CreateSchoolWithUsers(ctx context.Context, school *models.School, teacher *models.User, parent *models.User) error
}

type adminRepository struct {
	db *sqlx.DB
}

func NewAdminRepository(db *sqlx.DB) AdminRepository {
	return &adminRepository{db: db}
}

func (r *adminRepository) CreateSchoolWithUsers(ctx context.Context, school *models.School, teacher *models.User, parent *models.User) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO schools (id, name)
		VALUES ($1, $2)
	`, school.ID, school.Name); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, school_id, login, password_hash, role, label)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, teacher.ID, teacher.SchoolID, teacher.Login, teacher.PasswordHash, teacher.Role, teacher.Label); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, school_id, login, password_hash, role, label)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, parent.ID, parent.SchoolID, parent.Login, parent.PasswordHash, parent.Role, parent.Label); err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}
