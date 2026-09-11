-- Phase 5: resume-grounded interviews.
--
-- Postgres holds only the *metadata* about a resume: who uploaded it, when, and
-- what parsing produced. The extracted text and its vectors live in the user's
-- own Chroma namespace, so a deletion has to succeed in both stores -- the row
-- is deleted only after the vectors are purged.
--
-- One active resume per user (UNIQUE on user_id): a second upload replaces the
-- first. Keeping both would ground questions in whichever chunks happened to
-- rank higher, mixing an old resume's projects into a new one's interview.

CREATE TABLE IF NOT EXISTS resumes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  page_count    INTEGER NOT NULL DEFAULT 0,
  char_count    INTEGER NOT NULL DEFAULT 0,
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  sections      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Whether a session was personalised, recorded per session rather than read
-- from the user's current resume state: a report generated after the resume is
-- deleted must still say truthfully how that interview was conducted.
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS resume_grounded BOOLEAN NOT NULL DEFAULT FALSE;
