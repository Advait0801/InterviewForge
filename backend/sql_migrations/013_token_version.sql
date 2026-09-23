-- Token revocation (D-055).
--
-- Every access token carries the user's token_version as its `tv` claim, and auth
-- rejects a token whose tv no longer matches. Bumping the column therefore revokes
-- every token issued before the bump: password reset, password change and
-- "sign out everywhere" all do exactly that.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
