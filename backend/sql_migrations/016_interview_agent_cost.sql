-- Agentic interviewer and per-interview model cost (D-067).
--
-- mode: 'fixed' is the original behavioral -> coding -> system_design -> core_cs loop with
-- at most one follow-up per stage; 'agent' lets the interviewer agent probe, pivot or move
-- on within guardrails. Chosen when the interview starts.
-- llm_calls / llm_cost_usd: every model call made on the interview's behalf, as reported by
-- the ai-service. Estimated cost, not billing; it is what the per-interview cap checks.
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed', 'agent')),
  ADD COLUMN IF NOT EXISTS llm_calls INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0;
