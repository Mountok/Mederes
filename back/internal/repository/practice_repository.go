package repository

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/jmoiron/sqlx"
	"medrese-back/internal/models"
)

type PracticeRepository struct{ db *sqlx.DB }

func NewPracticeRepository(db *sqlx.DB) *PracticeRepository { return &PracticeRepository{db: db} }

const practiceAccessSQL = `SELECT trial_used,subscription_until,
	COALESCE(subscription_until > statement_timestamp(),false) AS subscribed FROM readers WHERE id=$1`

func readerAccess(ctx context.Context, db sqlx.QueryerContext, readerID string, lock bool) (models.ReaderAccess, error) {
	var access models.ReaderAccess
	query := practiceAccessSQL
	if lock {
		query += " FOR UPDATE"
	}
	err := sqlx.GetContext(ctx, db, &access, query, readerID)
	if errors.Is(err, sql.ErrNoRows) {
		return access, models.UnauthorizedError("Аккаунт не найден")
	}
	access.TrialLimit = models.ReaderTrialLimit
	access.Remaining = access.TrialLimit - access.Used
	return access, err
}

func (r *PracticeRepository) Access(ctx context.Context, readerID string) (models.ReaderAccess, error) {
	return readerAccess(ctx, r.db, readerID, false)
}

type ReadingAttempt struct {
	ID        string
	Selection string
	// Set only for a final/file request. Includes the reader ID and submitted audio.
	FinalFingerprint []byte
}

type practiceReceipt struct {
	Selection    string `db:"selection"`
	Active       bool   `db:"active"`
	FinalAllowed bool   `db:"final_allowed"`
	Final        []byte `db:"final_fingerprint"`
}

func (receipt practiceReceipt) accepts(attempt ReadingAttempt) error {
	if receipt.Selection != attempt.Selection {
		return models.ConflictError("Для другого диапазона начните новую запись")
	}
	if len(receipt.Final) > 0 {
		if !bytes.Equal(receipt.Final, attempt.FinalFingerprint) {
			return models.ConflictError("Эта запись уже завершена")
		}
		return nil
	}
	if !receipt.Active && !(len(attempt.FinalFingerprint) > 0 && receipt.FinalAllowed) {
		return models.ConflictError("Время записи истекло. Начните новую проверку")
	}
	return nil
}

// Check before recognition, then settle only a usable result before returning it.
// Settlement serializes on the reader row, including admin resets and extensions.
// No database lock is held while the model is running.
func (r *PracticeRepository) CheckAttempt(ctx context.Context, readerID string, attempt ReadingAttempt, settle bool) error {
	tx, err := r.db.BeginTxx(ctx, &sql.TxOptions{ReadOnly: !settle})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	access, err := readerAccess(ctx, tx, readerID, settle)
	if err != nil {
		return err
	}

	var receipt practiceReceipt
	err = tx.GetContext(ctx, &receipt, `SELECT selection,final_fingerprint,
		started_at >= statement_timestamp() - interval '2 minutes' AS active,
        started_at >= statement_timestamp() - interval '10 minutes' AS final_allowed
		FROM reader_practice_attempts WHERE reader_id=$1 AND attempt_id=$2`, readerID, attempt.ID)
	fresh := errors.Is(err, sql.ErrNoRows)
	if err != nil && !fresh {
		return err
	}
	if fresh {
		if !access.Subscribed && access.Remaining == 0 {
			return &models.AppError{Code: "trial_exhausted", HTTPStatus: http.StatusPaymentRequired,
				Message: "Бесплатные проверки закончились. Для продолжения нужна подписка."}
		}
	} else if err := receipt.accepts(attempt); err != nil {
		return err
	}
	if !settle {
		return nil
	}

	if fresh {
		_, err = tx.ExecContext(ctx, `INSERT INTO reader_practice_attempts(reader_id,attempt_id,selection,final_fingerprint)
			VALUES($1,$2,$3,$4)`, readerID, attempt.ID, attempt.Selection, attempt.FinalFingerprint)
		if err != nil {
			return err
		}
		if !access.Subscribed {
			if _, err = tx.ExecContext(ctx, `UPDATE readers SET trial_used=trial_used+1 WHERE id=$1`, readerID); err != nil {
				return err
			}
		}
	} else if len(attempt.FinalFingerprint) > 0 && len(receipt.Final) == 0 {
		_, err = tx.ExecContext(ctx, `UPDATE reader_practice_attempts SET final_fingerprint=$3 WHERE reader_id=$1 AND attempt_id=$2`, readerID, attempt.ID, attempt.FinalFingerprint)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
