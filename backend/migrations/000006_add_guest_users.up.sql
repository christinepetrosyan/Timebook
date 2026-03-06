-- Add is_guest column to users table for placeholder/guest accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(is_guest) WHERE is_guest = true;
