-- Learning features (Group C, Phase 8): Problem of the Day, an SM-2 review queue, hint
-- views, and personal learning paths generated from a user's weak topics.

-- Problem of the Day. The pick for a date is computed deterministically from the date
-- (services/daily.ts) and recorded here the first time anyone asks, so a past day's
-- problem never changes, even when the catalogue grows and the computation would differ.
-- Days are UTC.
CREATE TABLE IF NOT EXISTS daily_problems (
  day DATE PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spaced repetition (SM-2) over problems a user struggled with. One row per user and
-- problem: the scheduler's state plus why it entered the queue.
CREATE TABLE IF NOT EXISTS review_items (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  due_on DATE NOT NULL,
  last_quality SMALLINT CHECK (last_quality BETWEEN 0 AND 5),
  last_reviewed_at TIMESTAMPTZ,
  source TEXT NOT NULL CHECK (source IN ('failed', 'struggled', 'manual', 'backfill')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_review_items_due ON review_items(user_id, due_on);

-- Hints are sent with the problem and revealed in the browser, so the client reports how
-- many it has shown. A pass after a hint counts as a weaker recall in the review queue.
CREATE TABLE IF NOT EXISTS problem_hint_views (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  hints_viewed INTEGER NOT NULL CHECK (hints_viewed > 0),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id)
);

-- Personal paths live beside the curated ones, so progress tracking (user_path_progress,
-- completed on every passing submission) works for them unchanged. A curated path has no
-- owner; a personal one is visible only to its owner. One personal path per user:
-- regenerating replaces it.
ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS focus_json JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_paths_owner ON learning_paths(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Everything a user has failed before this migration starts in their queue, due today.
INSERT INTO review_items (user_id, problem_id, due_on, source)
  SELECT DISTINCT user_id, problem_id, CURRENT_DATE, 'backfill'
  FROM submissions
  WHERE status = 'failed'
ON CONFLICT (user_id, problem_id) DO NOTHING;
