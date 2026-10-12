-- Group D, Phase 12: empirical time complexity, and the AI review it is compared with.

-- The latest AI review of a submission. Kept so a measurement can be compared with what the
-- reviewer claimed without asking the model again (POST /submissions/{id}/review writes it).
CREATE TABLE IF NOT EXISTS submission_reviews (
    submission_id UUID PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
    review JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The latest measurement of a submission's running time on growing inputs: the raw points
-- and the fit (backend/src/services/complexity.ts). Measuring again replaces it.
CREATE TABLE IF NOT EXISTS complexity_analyses (
    submission_id UUID PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
    fit JSONB NOT NULL,
    stopped TEXT NOT NULL CHECK (stopped IN ('done', 'time_limit', 'error')),
    error TEXT,
    error_at_n INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
