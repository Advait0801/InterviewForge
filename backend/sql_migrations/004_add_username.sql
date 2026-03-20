ALTER TABLE users ADD COLUMN username TEXT UNIQUE;

-- For existing rows, backfill username from the local part of email so NOT NULL can be applied
UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1)) WHERE username IS NULL;

-- Now enforce NOT NULL
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Case-insensitive lookup index
CREATE INDEX idx_users_username_lower ON users (LOWER(username));