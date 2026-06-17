ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS student_id UUID NULL REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'parent', 'student'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_unique
    ON users (student_id)
    WHERE student_id IS NOT NULL;
