package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type LessonRepository interface {
	Create(ctx context.Context, lesson *models.Lesson) error
	GetByID(ctx context.Context, id string, schoolID string) (*models.Lesson, error)
	ListByGroup(ctx context.Context, groupID string, schoolID string) ([]models.LessonPreview, error)
	ListByGroupAndPeriod(ctx context.Context, groupID string, schoolID string, from time.Time, to time.Time) ([]models.GroupJournalLesson, error)
	Update(ctx context.Context, lessonID string, schoolID string, topic string, homework string) error
	DeleteCascade(ctx context.Context, lessonID string, schoolID string) error
}

type lessonRepository struct {
	db *sqlx.DB
}

func NewLessonRepository(db *sqlx.DB) LessonRepository {
	return &lessonRepository{db: db}
}

func (r *lessonRepository) Create(ctx context.Context, lesson *models.Lesson) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO lessons (id, school_id, group_id, topic, date, homework)
		VALUES ($1, $2, $3, $4, $5::date, $6)
	`, lesson.ID, lesson.SchoolID, lesson.GroupID, lesson.Topic, lesson.Date, lesson.Homework)
	return err
}

func (r *lessonRepository) GetByID(ctx context.Context, id string, schoolID string) (*models.Lesson, error) {
	var lesson models.Lesson
	if err := r.db.GetContext(ctx, &lesson, `
		SELECT id, school_id, group_id, topic, TO_CHAR(date, 'YYYY-MM-DD') AS date, homework, created_at, updated_at
		FROM lessons
		WHERE id = $1 AND school_id = $2
	`, id, schoolID); err != nil {
		return nil, err
	}

	return &lesson, nil
}

func (r *lessonRepository) ListByGroup(ctx context.Context, groupID string, schoolID string) ([]models.LessonPreview, error) {
	var lessons []models.LessonPreview
	if err := r.db.SelectContext(ctx, &lessons, `
		SELECT
			l.id,
			l.group_id,
			TO_CHAR(l.date, 'YYYY-MM-DD') AS date,
			l.topic,
			l.homework,
			COUNT(a.id) FILTER (WHERE a.attended = TRUE) AS present_count
		FROM lessons l
		LEFT JOIN attendance a ON a.lesson_id = l.id AND a.school_id = l.school_id
		WHERE l.group_id = $1 AND l.school_id = $2
		GROUP BY l.id, l.group_id, l.date, l.topic, l.homework
		ORDER BY l.date DESC
	`, groupID, schoolID); err != nil {
		return nil, err
	}

	return lessons, nil
}

func (r *lessonRepository) ListByGroupAndPeriod(ctx context.Context, groupID string, schoolID string, from time.Time, to time.Time) ([]models.GroupJournalLesson, error) {
	var lessons []models.GroupJournalLesson
	if err := r.db.SelectContext(ctx, &lessons, `
		SELECT
			id,
			TO_CHAR(date, 'YYYY-MM-DD') AS date,
			topic,
			homework
		FROM lessons
		WHERE group_id = $1
		  AND school_id = $2
		  AND date >= $3::date
		  AND date <= $4::date
		ORDER BY date ASC, created_at ASC
	`, groupID, schoolID, from.Format("2006-01-02"), to.Format("2006-01-02")); err != nil {
		return nil, err
	}

	return lessons, nil
}

func (r *lessonRepository) Update(ctx context.Context, lessonID string, schoolID string, topic string, homework string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE lessons
		SET topic = $1,
			homework = $2,
			updated_at = NOW()
		WHERE id = $3 AND school_id = $4
	`, topic, homework, lessonID, schoolID)
	return err
}

func (r *lessonRepository) DeleteCascade(ctx context.Context, lessonID string, schoolID string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM attendance
		WHERE lesson_id = $1 AND school_id = $2
	`, lessonID, schoolID); err != nil {
		_ = tx.Rollback()
		return err
	}

	result, err := tx.ExecContext(ctx, `
		DELETE FROM lessons
		WHERE id = $1 AND school_id = $2
	`, lessonID, schoolID)
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
