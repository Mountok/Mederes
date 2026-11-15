CREATE TABLE reader_payments (
    id UUID PRIMARY KEY,
    reader_id UUID NOT NULL REFERENCES readers(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('month', 'half-year', 'year')),
    amount TEXT NOT NULL,
    months INTEGER NOT NULL CHECK (months IN (1,6,12)),
    provider_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','canceled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
