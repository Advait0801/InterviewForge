-- Group D, Phase 13: peer mock interviews (D-078). Two users, one interviewing the other,
-- connected peer to peer over WebRTC; the backend holds the session, relays signalling over
-- Socket.IO, and keeps the shared code and the feedback.

CREATE TABLE IF NOT EXISTS peer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- The host's role; the guest takes the other one.
    host_role TEXT NOT NULL CHECK (host_role IN ('interviewer', 'candidate')),
    problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 90),
    -- The invite is a bearer secret, so only its SHA-256 is stored (like share links, D-071).
    invite_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Set when both participants are first in the room; ends_at = started_at + duration.
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    ended_reason TEXT CHECK (ended_reason IN ('ended_by_participant', 'time_up', 'cancelled', 'expired')),
    -- The shared editor's latest state, kept for the feedback and the record.
    code TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'python3',
    CHECK (guest_id IS NULL OR guest_id <> host_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_sessions_host ON peer_sessions(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_guest ON peer_sessions(guest_id, created_at DESC);
-- The sweep that ends sessions whose time is up.
CREATE INDEX IF NOT EXISTS idx_peer_sessions_active_ends ON peer_sessions(ends_at) WHERE status = 'active';

-- After a session ends, each participant may leave feedback for the other once.
-- The interviewer rates the candidate (problem_solving, communication, code_quality); the
-- candidate rates the interviewer (clarity, helpfulness). 1-5 each.
CREATE TABLE IF NOT EXISTS peer_feedback (
    session_id UUID NOT NULL REFERENCES peer_sessions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ratings JSONB NOT NULL,
    notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, author_id)
);
