-- Group D, Phase 12: Elo-rated adaptive difficulty (backend/src/services/elo.ts).

-- A user's rating per topic, plus '__overall__' across every game.
CREATE TABLE IF NOT EXISTS user_topic_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    rating DOUBLE PRECISION NOT NULL,
    games INTEGER NOT NULL CHECK (games >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, topic)
);

-- A problem's rating once it has been played; before that, its difficulty label's.
CREATE TABLE IF NOT EXISTS problem_ratings (
    problem_id UUID PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
    rating DOUBLE PRECISION NOT NULL,
    games INTEGER NOT NULL CHECK (games >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One rated game per user and problem: their first Submit of it. The primary key is what
-- makes "first" hold when two submissions race.
CREATE TABLE IF NOT EXISTS rated_games (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    score REAL NOT NULL CHECK (score IN (0, 0.5, 1)),
    expected DOUBLE PRECISION NOT NULL,
    user_rating_before DOUBLE PRECISION NOT NULL,
    problem_rating_before DOUBLE PRECISION NOT NULL,
    delta DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, problem_id)
);
