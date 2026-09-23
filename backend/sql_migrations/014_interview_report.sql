-- Stored interview report (D-056).
--
-- GET /interviews/:id/report used to call the LLM and insert score rows on every
-- page view, so each reload cost a model call and inflated analytics. The first
-- generation is now kept here and served from then on; the conditional write
-- (WHERE report_json IS NULL) also decides which of two concurrent first loads
-- records the scores.
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS report_json JSONB;
