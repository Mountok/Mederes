DROP TABLE IF EXISTS platform_audit;
DELETE FROM users WHERE role = 'platform_admin';
DELETE FROM schools WHERE id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'staff', 'parent', 'student'));
