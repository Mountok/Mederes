DROP INDEX IF EXISTS idx_users_student_id_unique;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'parent'));

ALTER TABLE users
    DROP COLUMN IF EXISTS student_id;
