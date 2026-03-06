DROP INDEX IF EXISTS idx_users_is_guest;
ALTER TABLE users DROP COLUMN IF EXISTS is_guest;
