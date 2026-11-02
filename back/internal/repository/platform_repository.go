package repository

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"
	"medrese-back/internal/models"
)

type PlatformRepository interface {
	ListSchools(ctx context.Context) ([]models.PlatformSchool, error)
	ListSchoolUsers(ctx context.Context, schoolID string) ([]models.PlatformUser, error)
	GetSchool(ctx context.Context, schoolID string) (*models.PlatformSchool, error)
	CreateSchool(ctx context.Context, actorID string, school *models.School, admin *models.User) error
	RenameSchool(ctx context.Context, actorID string, schoolID string, name string) error
	ResetUserPassword(ctx context.Context, actorID string, schoolID string, userID string, hash string) error
}

type platformRepository struct{ db *sqlx.DB }

func NewPlatformRepository(db *sqlx.DB) PlatformRepository { return &platformRepository{db: db} }

const platformSchoolQuery = `
    SELECT s.id, s.name, s.created_at,
      (SELECT count(*) FROM groups g WHERE g.school_id = s.id) AS group_count,
      (SELECT count(*) FROM students st WHERE st.school_id = s.id) AS student_count,
      (SELECT count(*) FROM users u WHERE u.school_id = s.id AND u.role = 'staff') AS staff_count,
      (SELECT count(*) FROM users u WHERE u.school_id = s.id AND u.role = 'teacher') AS admin_count
    FROM schools s WHERE s.id <> '` + models.PlatformSchoolID + `'`

func (r *platformRepository) ListSchools(ctx context.Context) ([]models.PlatformSchool, error) {
	schools := make([]models.PlatformSchool, 0)
	err := r.db.SelectContext(ctx, &schools, platformSchoolQuery+` ORDER BY s.created_at DESC, s.name`)
	return schools, err
}

func (r *platformRepository) GetSchool(ctx context.Context, schoolID string) (*models.PlatformSchool, error) {
	var school models.PlatformSchool
	if err := r.db.GetContext(ctx, &school, platformSchoolQuery+` AND s.id = $1`, schoolID); err != nil {
		return nil, err
	}
	return &school, nil
}

func (r *platformRepository) ListSchoolUsers(ctx context.Context, schoolID string) ([]models.PlatformUser, error) {
	users := make([]models.PlatformUser, 0)
	err := r.db.SelectContext(ctx, &users, `SELECT id, login, role, label FROM users WHERE school_id = $1 AND role IN ('teacher','staff') ORDER BY role, label`, schoolID)
	return users, err
}

func (r *platformRepository) CreateSchool(ctx context.Context, actorID string, school *models.School, admin *models.User) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `INSERT INTO schools (id, name) VALUES ($1,$2)`, school.ID, school.Name); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO users (id, school_id, login, password_hash, role, label) VALUES ($1,$2,$3,$4,'teacher',$5)`, admin.ID, school.ID, admin.Login, admin.PasswordHash, admin.Label); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO platform_audit (actor_id, action, school_id) VALUES ($1,'school_created',$2)`, actorID, school.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *platformRepository) RenameSchool(ctx context.Context, actorID string, schoolID string, name string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `UPDATE schools SET name=$1, updated_at=NOW() WHERE id=$2 AND id<>$3`, name, schoolID, models.PlatformSchoolID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO platform_audit (actor_id, action, school_id) VALUES ($1,'school_renamed',$2)`, actorID, schoolID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *platformRepository) ResetUserPassword(ctx context.Context, actorID string, schoolID string, userID string, hash string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND school_id=$3 AND role IN ('teacher','staff') AND school_id<>$4`, hash, userID, schoolID, models.PlatformSchoolID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO platform_audit (actor_id, action, school_id) VALUES ($1,'access_reset',$2)`, actorID, schoolID); err != nil {
		return err
	}
	return tx.Commit()
}
