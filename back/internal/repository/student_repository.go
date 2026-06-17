package repository

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type StudentRepository interface {
	ListByGroup(ctx context.Context, groupID string, schoolID string) ([]models.Student, error)
	CreateWithAccount(ctx context.Context, student *models.Student, user *models.User) error
	GetByID(ctx context.Context, id string, schoolID string) (*models.Student, error)
	GetAccountByStudentID(ctx context.Context, studentID string, schoolID string) (*models.User, error)
	UpdateAccountPassword(ctx context.Context, studentID string, schoolID string, passwordHash string) error
	DeleteCascade(ctx context.Context, studentID string, schoolID string) error
	Update(ctx context.Context, student *models.Student) error
}

type studentRepository struct {
	db *sqlx.DB
}

func NewStudentRepository(db *sqlx.DB) StudentRepository {
	return &studentRepository{db: db}
}

func (r *studentRepository) ListByGroup(ctx context.Context, groupID string, schoolID string) ([]models.Student, error) {
	var students []models.Student
	if err := r.db.SelectContext(ctx, &students, `
		SELECT id, school_id, group_id, name, note, created_at, updated_at
		FROM students
		WHERE group_id = $1 AND school_id = $2
		ORDER BY name ASC
	`, groupID, schoolID); err != nil {
		return nil, err
	}

	return students, nil
}

func (r *studentRepository) CreateWithAccount(ctx context.Context, student *models.Student, user *models.User) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO students (id, school_id, group_id, name, note)
		VALUES ($1, $2, $3, $4, $5)
	`, student.ID, student.SchoolID, student.GroupID, student.Name, student.Note); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, school_id, student_id, login, password_hash, role, label)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, user.ID, user.SchoolID, user.StudentID, user.Login, user.PasswordHash, user.Role, user.Label); err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}

func (r *studentRepository) GetByID(ctx context.Context, id string, schoolID string) (*models.Student, error) {
	var student models.Student
	if err := r.db.GetContext(ctx, &student, `
		SELECT id, school_id, group_id, name, note, created_at, updated_at
		FROM students
		WHERE id = $1 AND school_id = $2
	`, id, schoolID); err != nil {
		return nil, err
	}

	return &student, nil
}

func (r *studentRepository) GetAccountByStudentID(ctx context.Context, studentID string, schoolID string) (*models.User, error) {
	var user models.User
	if err := r.db.GetContext(ctx, &user, `
		SELECT id, school_id, student_id, login, password_hash, role, label, created_at, updated_at
		FROM users
		WHERE student_id = $1 AND school_id = $2 AND role = 'student'
		LIMIT 1
	`, studentID, schoolID); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *studentRepository) UpdateAccountPassword(ctx context.Context, studentID string, schoolID string, passwordHash string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET password_hash = $1,
			updated_at = NOW()
		WHERE student_id = $2 AND school_id = $3 AND role = 'student'
	`, passwordHash, studentID, schoolID)
	return err
}

func (r *studentRepository) DeleteCascade(ctx context.Context, studentID string, schoolID string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM attendance
		WHERE student_id = $1 AND school_id = $2
	`, studentID, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM users
		WHERE student_id = $1 AND school_id = $2
	`, studentID, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	result, err := tx.ExecContext(ctx, `
		DELETE FROM students
		WHERE id = $1 AND school_id = $2
	`, studentID, schoolID)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	if rowsAffected == 0 {
		_ = tx.Rollback()
		return sql.ErrNoRows
	}

	return tx.Commit()
}

func (r *studentRepository) Update(ctx context.Context, student *models.Student) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE students
		SET name = $1,
			note = $2,
			updated_at = NOW()
		WHERE id = $3 AND school_id = $4
	`, student.Name, student.Note, student.ID, student.SchoolID)
	return err
}
