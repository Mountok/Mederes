package repository

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type GroupRepository interface {
	ListBySchool(ctx context.Context, schoolID string) ([]models.GroupListItem, error)
	GetListItemByID(ctx context.Context, id string, schoolID string) (*models.GroupListItem, error)
	Create(ctx context.Context, group *models.Group) error
	GetByID(ctx context.Context, id string, schoolID string) (*models.Group, error)
	DeleteCascade(ctx context.Context, id string, schoolID string) error
}

type groupRepository struct {
	db *sqlx.DB
}

func NewGroupRepository(db *sqlx.DB) GroupRepository {
	return &groupRepository{db: db}
}

func (r *groupRepository) ListBySchool(ctx context.Context, schoolID string) ([]models.GroupListItem, error) {
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
		FROM groups g
		LEFT JOIN students s ON s.group_id = g.id AND s.school_id = g.school_id
		LEFT JOIN lessons l ON l.group_id = g.id AND l.school_id = g.school_id
		WHERE g.school_id = $1
		GROUP BY g.id, g.name, g.description
		ORDER BY g.name ASC
	`, schoolID); err != nil {
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

func (r *groupRepository) GetListItemByID(ctx context.Context, id string, schoolID string) (*models.GroupListItem, error) {
	type groupListRow struct {
		ID               string         `db:"id"`
		Name             string         `db:"name"`
		Description      string         `db:"description"`
		StudentCount     int            `db:"student_count"`
		LessonCount      int            `db:"lesson_count"`
		LatestLessonDate sql.NullString `db:"latest_lesson_date"`
	}

	var row groupListRow
	if err := r.db.GetContext(ctx, &row, `
		SELECT
			g.id,
			g.name,
			g.description,
			COUNT(DISTINCT s.id) AS student_count,
			COUNT(DISTINCT l.id) AS lesson_count,
			TO_CHAR(MAX(l.date), 'YYYY-MM-DD') AS latest_lesson_date
		FROM groups g
		LEFT JOIN students s ON s.group_id = g.id AND s.school_id = g.school_id
		LEFT JOIN lessons l ON l.group_id = g.id AND l.school_id = g.school_id
		WHERE g.id = $1 AND g.school_id = $2
		GROUP BY g.id, g.name, g.description
	`, id, schoolID); err != nil {
		return nil, err
	}

	var latestDate *string
	if row.LatestLessonDate.Valid {
		value := row.LatestLessonDate.String
		latestDate = &value
	}

	return &models.GroupListItem{
		ID:               row.ID,
		Name:             row.Name,
		Description:      row.Description,
		StudentCount:     row.StudentCount,
		LessonCount:      row.LessonCount,
		LatestLessonDate: latestDate,
	}, nil
}

func (r *groupRepository) Create(ctx context.Context, group *models.Group) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO groups (id, school_id, name, description)
		VALUES ($1, $2, $3, $4)
	`, group.ID, group.SchoolID, group.Name, group.Description)
	return err
}

func (r *groupRepository) GetByID(ctx context.Context, id string, schoolID string) (*models.Group, error) {
	var group models.Group
	if err := r.db.GetContext(ctx, &group, `
		SELECT id, school_id, name, description, created_at, updated_at
		FROM groups
		WHERE id = $1 AND school_id = $2
	`, id, schoolID); err != nil {
		return nil, err
	}

	return &group, nil
}

func (r *groupRepository) DeleteCascade(ctx context.Context, id string, schoolID string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM attendance
		WHERE school_id = $2
		  AND lesson_id IN (SELECT id FROM lessons WHERE group_id = $1 AND school_id = $2)
	`, id, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM lessons
		WHERE group_id = $1 AND school_id = $2
	`, id, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM students
		WHERE group_id = $1 AND school_id = $2
	`, id, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	result, err := tx.ExecContext(ctx, `
		DELETE FROM groups
		WHERE id = $1 AND school_id = $2
	`, id, schoolID)
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
