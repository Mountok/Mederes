package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type StaffRepository interface {
	CreateWithAccount(ctx context.Context, user *models.User, profile *models.StaffProfile, groupIDs []string) error
	ListBySchool(ctx context.Context, schoolID string) ([]models.StaffProfile, error)
	GetByID(ctx context.Context, staffID string, schoolID string) (*models.StaffProfile, error)
	GetByUserID(ctx context.Context, userID string, schoolID string) (*models.StaffProfile, error)
	GetGroupsByStaffID(ctx context.Context, staffID string, schoolID string) ([]models.StaffGroupInfo, error)
	ListGroupItemsByUserID(ctx context.Context, userID string, schoolID string) ([]models.GroupListItem, error)
	HasGroupAccess(ctx context.Context, userID string, schoolID string, groupID string) (bool, error)
	Update(ctx context.Context, profile *models.StaffProfile, label string) error
	ReplaceGroups(ctx context.Context, staffID string, schoolID string, groupIDs []string) error
	GetAccountByStaffID(ctx context.Context, staffID string, schoolID string) (*models.User, error)
	UpdateAccountPassword(ctx context.Context, staffID string, schoolID string, passwordHash string) error
	Delete(ctx context.Context, staffID string, schoolID string) error
}

type staffRepository struct {
	db *sqlx.DB
}

func NewStaffRepository(db *sqlx.DB) StaffRepository {
	return &staffRepository{db: db}
}

func (r *staffRepository) CreateWithAccount(ctx context.Context, user *models.User, profile *models.StaffProfile, groupIDs []string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, school_id, login, password_hash, role, label)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, user.ID, user.SchoolID, user.Login, user.PasswordHash, user.Role, user.Label); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO staff_profiles (id, school_id, user_id, first_name, last_name, middle_name, phone, note, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, profile.ID, profile.SchoolID, profile.UserID, profile.FirstName, profile.LastName, profile.MiddleName, profile.Phone, profile.Note, profile.CreatedAt, profile.UpdatedAt); err != nil {
		_ = tx.Rollback()
		return err
	}

	for _, groupID := range groupIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO staff_group_assignments (id, school_id, staff_id, group_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), profile.SchoolID, profile.ID, groupID); err != nil {
			_ = tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func (r *staffRepository) ListBySchool(ctx context.Context, schoolID string) ([]models.StaffProfile, error) {
	var profiles []models.StaffProfile
	if err := r.db.SelectContext(ctx, &profiles, `
		SELECT id, school_id, user_id, first_name, last_name, middle_name, phone, note, created_at, updated_at
		FROM staff_profiles
		WHERE school_id = $1
		ORDER BY last_name ASC, first_name ASC, middle_name ASC, created_at ASC
	`, schoolID); err != nil {
		return nil, err
	}

	return profiles, nil
}

func (r *staffRepository) GetByID(ctx context.Context, staffID string, schoolID string) (*models.StaffProfile, error) {
	var profile models.StaffProfile
	if err := r.db.GetContext(ctx, &profile, `
		SELECT id, school_id, user_id, first_name, last_name, middle_name, phone, note, created_at, updated_at
		FROM staff_profiles
		WHERE id = $1 AND school_id = $2
	`, staffID, schoolID); err != nil {
		return nil, err
	}

	return &profile, nil
}

func (r *staffRepository) GetByUserID(ctx context.Context, userID string, schoolID string) (*models.StaffProfile, error) {
	var profile models.StaffProfile
	if err := r.db.GetContext(ctx, &profile, `
		SELECT id, school_id, user_id, first_name, last_name, middle_name, phone, note, created_at, updated_at
		FROM staff_profiles
		WHERE user_id = $1 AND school_id = $2
	`, userID, schoolID); err != nil {
		return nil, err
	}

	return &profile, nil
}

func (r *staffRepository) GetGroupsByStaffID(ctx context.Context, staffID string, schoolID string) ([]models.StaffGroupInfo, error) {
	type groupRow struct {
		ID   string `db:"id"`
		Name string `db:"name"`
	}

	var rows []groupRow
	if err := r.db.SelectContext(ctx, &rows, `
		SELECT g.id, g.name
		FROM staff_group_assignments sga
		JOIN groups g ON g.id = sga.group_id AND g.school_id = sga.school_id
		WHERE sga.staff_id = $1 AND sga.school_id = $2
		ORDER BY g.name ASC
	`, staffID, schoolID); err != nil {
		return nil, err
	}

	groups := make([]models.StaffGroupInfo, 0, len(rows))
	for _, row := range rows {
		groups = append(groups, models.StaffGroupInfo{
			ID:   row.ID,
			Name: row.Name,
		})
	}

	return groups, nil
}

func (r *staffRepository) ListGroupItemsByUserID(ctx context.Context, userID string, schoolID string) ([]models.GroupListItem, error) {
	type groupListRow struct {
		ID               string         `db:"id"`
		Name             string         `db:"name"`
		Description      string         `db:"description"`
		StudentCount     int            `db:"student_count"`
		LessonCount      int            `db:"lesson_count"`
		LatestLessonDate sql.NullString `db:"latest_lesson_date"`
	}

	var rows []groupListRow
	if err := r.db.SelectContext(ctx, &rows, `
		SELECT
			g.id,
			g.name,
			g.description,
			COUNT(DISTINCT s.id) AS student_count,
			COUNT(DISTINCT l.id) AS lesson_count,
			TO_CHAR(MAX(l.date), 'YYYY-MM-DD') AS latest_lesson_date
		FROM staff_profiles sp
		JOIN staff_group_assignments sga ON sga.staff_id = sp.id AND sga.school_id = sp.school_id
		JOIN groups g ON g.id = sga.group_id AND g.school_id = sga.school_id
		LEFT JOIN students s ON s.group_id = g.id AND s.school_id = g.school_id
		LEFT JOIN lessons l ON l.group_id = g.id AND l.school_id = g.school_id
		WHERE sp.user_id = $1 AND sp.school_id = $2
		GROUP BY g.id, g.name, g.description
		ORDER BY g.name ASC
	`, userID, schoolID); err != nil {
		return nil, err
	}

	items := make([]models.GroupListItem, 0, len(rows))
	for _, row := range rows {
		var latestDate *string
		if row.LatestLessonDate.Valid {
			value := row.LatestLessonDate.String
			latestDate = &value
		}

		items = append(items, models.GroupListItem{
			ID:               row.ID,
			Name:             row.Name,
			Description:      row.Description,
			StudentCount:     row.StudentCount,
			LessonCount:      row.LessonCount,
			LatestLessonDate: latestDate,
		})
	}

	return items, nil
}

func (r *staffRepository) HasGroupAccess(ctx context.Context, userID string, schoolID string, groupID string) (bool, error) {
	var exists bool
	if err := r.db.GetContext(ctx, &exists, `
		SELECT EXISTS(
			SELECT 1
			FROM staff_profiles sp
			JOIN staff_group_assignments sga ON sga.staff_id = sp.id AND sga.school_id = sp.school_id
			WHERE sp.user_id = $1
			  AND sp.school_id = $2
			  AND sga.group_id = $3
		)
	`, userID, schoolID, groupID); err != nil {
		return false, err
	}

	return exists, nil
}

func (r *staffRepository) Update(ctx context.Context, profile *models.StaffProfile, label string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE staff_profiles
		SET first_name = $1,
			last_name = $2,
			middle_name = $3,
			phone = $4,
			note = $5,
			updated_at = NOW()
		WHERE id = $6 AND school_id = $7
	`, profile.FirstName, profile.LastName, profile.MiddleName, profile.Phone, profile.Note, profile.ID, profile.SchoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET label = $1,
			updated_at = NOW()
		WHERE id = $2 AND school_id = $3
	`, label, profile.UserID, profile.SchoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}

func (r *staffRepository) ReplaceGroups(ctx context.Context, staffID string, schoolID string, groupIDs []string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM staff_group_assignments
		WHERE staff_id = $1 AND school_id = $2
	`, staffID, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	for _, groupID := range groupIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO staff_group_assignments (id, school_id, staff_id, group_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), schoolID, staffID, groupID); err != nil {
			_ = tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func (r *staffRepository) GetAccountByStaffID(ctx context.Context, staffID string, schoolID string) (*models.User, error) {
	var user models.User
	if err := r.db.GetContext(ctx, &user, `
		SELECT u.id, u.school_id, u.student_id, u.login, u.password_hash, u.role, u.label, u.created_at, u.updated_at
		FROM users u
		JOIN staff_profiles sp ON sp.user_id = u.id AND sp.school_id = u.school_id
		WHERE sp.id = $1 AND sp.school_id = $2
		LIMIT 1
	`, staffID, schoolID); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *staffRepository) UpdateAccountPassword(ctx context.Context, staffID string, schoolID string, passwordHash string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET password_hash = $1,
			updated_at = NOW()
		WHERE id = (
			SELECT user_id
			FROM staff_profiles
			WHERE id = $2 AND school_id = $3
		)
	`, passwordHash, staffID, schoolID)
	return err
}

func (r *staffRepository) Delete(ctx context.Context, staffID string, schoolID string) error {
	result, err := r.db.ExecContext(ctx, `
		DELETE FROM users
		WHERE id = (
			SELECT user_id
			FROM staff_profiles
			WHERE id = $1 AND school_id = $2
		)
		  AND school_id = $2
	`, staffID, schoolID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}
