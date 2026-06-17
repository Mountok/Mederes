package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"

	"medrese-back/internal/models"
)

type AttendanceMutation struct {
	SchoolID    string
	LessonID    string
	StudentID   string
	AttendedSet bool
	Attended    *bool
	GradeSet    bool
	Grade       *int
}

type AttendanceRepository interface {
	ListRowsByLesson(ctx context.Context, lessonID string, schoolID string) ([]models.AttendanceRow, error)
	ListEntriesByLessonIDs(ctx context.Context, lessonIDs []string, schoolID string) ([]models.GroupJournalEntry, error)
	Upsert(ctx context.Context, input AttendanceMutation) error
	SetForAll(ctx context.Context, lessonID string, groupID string, schoolID string, attended bool) error
}

type attendanceRepository struct {
	db *sqlx.DB
}

func NewAttendanceRepository(db *sqlx.DB) AttendanceRepository {
	return &attendanceRepository{db: db}
}

func (r *attendanceRepository) ListRowsByLesson(ctx context.Context, lessonID string, schoolID string) ([]models.AttendanceRow, error) {
	var rows []models.AttendanceRow
	if err := r.db.SelectContext(ctx, &rows, `
		SELECT
			s.id AS student_id,
			s.name AS student_name,
			s.note AS note,
			a.attended,
			a.grade
		FROM lessons l
		JOIN students s ON s.group_id = l.group_id AND s.school_id = l.school_id
		LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = s.id AND a.school_id = l.school_id
		WHERE l.id = $1 AND l.school_id = $2
		ORDER BY s.name ASC
	`, lessonID, schoolID); err != nil {
		return nil, err
	}

	return rows, nil
}

func (r *attendanceRepository) ListEntriesByLessonIDs(ctx context.Context, lessonIDs []string, schoolID string) ([]models.GroupJournalEntry, error) {
	if len(lessonIDs) == 0 {
		return []models.GroupJournalEntry{}, nil
	}

	var entries []models.GroupJournalEntry
	if err := r.db.SelectContext(ctx, &entries, `
		SELECT
			student_id,
			lesson_id,
			attended,
			grade
		FROM attendance
		WHERE school_id = $1
		  AND lesson_id = ANY($2::uuid[])
	`, schoolID, pq.Array(lessonIDs)); err != nil {
		return nil, err
	}

	return entries, nil
}

func (r *attendanceRepository) Upsert(ctx context.Context, input AttendanceMutation) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO attendance (id, school_id, lesson_id, student_id, attended, grade)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (lesson_id, student_id)
		DO UPDATE SET
			attended = CASE WHEN $7 THEN EXCLUDED.attended ELSE attendance.attended END,
			grade = CASE WHEN $8 THEN EXCLUDED.grade ELSE attendance.grade END,
			updated_at = NOW()
	`, uuid.NewString(), input.SchoolID, input.LessonID, input.StudentID, input.Attended, input.Grade, input.AttendedSet, input.GradeSet)
	return err
}

func (r *attendanceRepository) SetForAll(ctx context.Context, lessonID string, groupID string, schoolID string, attended bool) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO attendance (id, school_id, lesson_id, student_id, attended, grade)
		SELECT gen_random_uuid(), s.school_id, $1, s.id, $2, NULL
		FROM students s
		WHERE s.group_id = $3 AND s.school_id = $4
		ON CONFLICT (lesson_id, student_id)
		DO UPDATE SET
			attended = EXCLUDED.attended,
			updated_at = NOW()
	`, lessonID, attended, groupID, schoolID)
	return err
}
