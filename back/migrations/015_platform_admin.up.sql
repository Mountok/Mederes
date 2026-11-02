ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('platform_admin', 'teacher', 'staff', 'parent', 'student'));

INSERT INTO schools (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Al-Qalam Platform')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    school_id UUID REFERENCES schools(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at ON platform_audit(created_at DESC);
