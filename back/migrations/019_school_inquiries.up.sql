CREATE TABLE IF NOT EXISTS school_inquiries (
    id UUID PRIMARY KEY,
    school_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    consent_at TIMESTAMPTZ NOT NULL,
    consent_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_inquiries_created_at ON school_inquiries(created_at DESC);
