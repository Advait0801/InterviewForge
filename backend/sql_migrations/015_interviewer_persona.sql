-- Interviewer persona (D-066).
--
-- Chosen when an interview starts and used for every question, follow-up, hint and
-- challenge in it. Tone only: retrieval and grading never see it. 'neutral' is the
-- interviewer as it was before personas existed, so existing sessions keep behaving
-- exactly as they did.
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS persona TEXT NOT NULL DEFAULT 'neutral'
  CHECK (persona IN ('neutral', 'friendly', 'terse', 'adversarial'));
