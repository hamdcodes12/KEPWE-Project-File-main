CREATE TABLE IF NOT EXISTS credit_report_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  report_pdf BYTEA NOT NULL,
  normalized_data JSONB NOT NULL,
  score_result JSONB NOT NULL,
  extraction_method VARCHAR(10) NOT NULL CHECK (extraction_method IN ('TEXT', 'OCR')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_report_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_report_analyses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_report_analyses_user_isolation ON credit_report_analyses;
CREATE POLICY credit_report_analyses_user_isolation ON credit_report_analyses
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);