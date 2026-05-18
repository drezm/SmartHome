ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hub_id TEXT;

UPDATE users
SET hub_id = CONCAT('home-', id)
WHERE hub_id IS NULL OR hub_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hub_id ON users(hub_id);
