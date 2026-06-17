DROP TABLE IF EXISTS staff_group_assignments;
DROP TABLE IF EXISTS staff_profiles;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'parent', 'student'));
