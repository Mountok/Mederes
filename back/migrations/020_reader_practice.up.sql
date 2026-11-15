ALTER TABLE readers
    ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0 CHECK (trial_used BETWEEN 0 AND 3),
    ADD COLUMN subscription_until TIMESTAMPTZ;

-- Keep only accounting metadata; audio and transcripts are never written here.
CREATE TABLE reader_practice_attempts (
    reader_id UUID NOT NULL REFERENCES readers(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL,
    selection TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    final_fingerprint BYTEA,
    PRIMARY KEY (reader_id, attempt_id)
);
