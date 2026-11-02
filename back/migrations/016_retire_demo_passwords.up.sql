-- Only replace the documented demo password when it is still unchanged.
UPDATE users
SET password_hash = crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf', 12)),
    updated_at = NOW()
WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
)
AND password_hash = crypt('12345678@', password_hash);
