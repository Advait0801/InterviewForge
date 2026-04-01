ALTER TABLE problems
ADD COLUMN IF NOT EXISTS hints TEXT,
ADD COLUMN IF NOT EXISTS editorial TEXT,
ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS companies TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS problem_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_bookmarks_user_id ON problem_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_problem_bookmarks_problem_id ON problem_bookmarks(problem_id);
CREATE INDEX IF NOT EXISTS idx_problems_topics_gin ON problems USING GIN (topics);
