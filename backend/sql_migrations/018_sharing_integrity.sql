-- Sharing and integrity (Group C, Phase 9): public interview links and assessment proctoring.

-- A link anyone can open, without signing in, to one completed interview's replay and report.
-- Only a SHA-256 of the token is stored: the token itself is shown once, to its owner, so a
-- database leak doesn't hand out working links. token_hint is the token's last 4 characters, so
-- the owner can tell their links apart.
CREATE TABLE IF NOT EXISTS interview_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint TEXT NOT NULL CHECK (char_length(token_hint) = 4),
  display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 60),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_session ON interview_share_links(session_id);

-- What the browser saw during a timed assessment: the tab hidden, the window blurred, a paste.
-- A paste or copy records how many characters, never what they were.
CREATE TABLE IF NOT EXISTS assessment_events (
  id BIGSERIAL PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'tab_hidden', 'tab_visible', 'window_blur', 'window_focus',
    'paste', 'copy', 'fullscreen_exit', 'fullscreen_enter'
  )),
  client_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chars INTEGER CHECK (chars IS NULL OR chars >= 0)
);

CREATE INDEX IF NOT EXISTS idx_assessment_events ON assessment_events(assessment_id, client_at, id);
