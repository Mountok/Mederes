package repository

import (
	"context"

	"github.com/jmoiron/sqlx"
	"medrese-back/internal/models"
)

type ReaderRepository struct{ db *sqlx.DB }

func NewReaderRepository(db *sqlx.DB) *ReaderRepository { return &ReaderRepository{db: db} }

func (r *ReaderRepository) Create(ctx context.Context, reader models.Reader) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO readers (id, email, password_hash, name, privacy_consent_at, terms_accepted_at, adult_confirmed_at, legal_version) VALUES ($1,$2,$3,$4,NOW(),NOW(),NOW(),'2026-11-15')`, reader.ID, reader.Email, reader.PasswordHash, reader.Name)
	return err
}

func (r *ReaderRepository) ByEmail(ctx context.Context, email string) (*models.Reader, error) {
	var reader models.Reader
	err := r.db.GetContext(ctx, &reader, `SELECT id, email, password_hash, name FROM readers WHERE email=$1`, email)
	return &reader, err
}

func (r *ReaderRepository) ByID(ctx context.Context, id string) (*models.Reader, error) {
	var reader models.Reader
	err := r.db.GetContext(ctx, &reader, `SELECT id, email, password_hash, name FROM readers WHERE id=$1`, id)
	return &reader, err
}
