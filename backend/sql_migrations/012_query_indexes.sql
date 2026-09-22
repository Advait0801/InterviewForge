-- Indexes for the access paths the routes actually use.
--
-- Postgres does not index foreign keys automatically, and until now only six
-- secondary indexes existed, so every per-user lookup on submissions, interviews
-- and assessments was a sequential scan. Each index below names the query it serves.

-- Submission history and analytics: WHERE s.user_id = $1 ORDER BY s.created_at DESC
CREATE INDEX IF NOT EXISTS idx_submissions_user_created
  ON submissions (user_id, created_at DESC);

-- "Has this user solved this problem?" -- the solved flag on the problem list, the
-- solved/unsolved filter, recommendations and learning-path progress all run
--   EXISTS (SELECT 1 FROM submissions s
--           WHERE s.user_id = $1 AND s.problem_id = p.id AND s.status = 'passed')
-- once per problem row. Partial, because only passed rows answer it.
CREATE INDEX IF NOT EXISTS idx_submissions_user_problem_passed
  ON submissions (user_id, problem_id) WHERE status = 'passed';

-- Per-problem stats, and the ON DELETE CASCADE from problems.
CREATE INDEX IF NOT EXISTS idx_submissions_problem
  ON submissions (problem_id);

-- Interview transcript: WHERE session_id = $1 [AND role/stage] ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_interview_messages_session_created
  ON interview_messages (session_id, created_at);

-- Interview history: WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_created
  ON interview_sessions (user_id, created_at DESC);

-- Assessment history: WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_assessments_user_created
  ON assessments (user_id, created_at DESC);

-- Score history per user.
CREATE INDEX IF NOT EXISTS idx_scores_user_created
  ON scores (user_id, created_at DESC);

-- Token lookups in /auth/reset-password and /auth/verify-email scan users by token.
-- Partial: nearly every row has these NULL.
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token) WHERE email_verification_token IS NOT NULL;
