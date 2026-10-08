-- Persistent KEPWE Credit applications, review events, and private documents.
BEGIN;

CREATE TABLE IF NOT EXISTS credit_loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number VARCHAR(40) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_name VARCHAR(255) NOT NULL,
  applicant_email VARCHAR(320) NOT NULL,
  applicant_mobile VARCHAR(32),
  loan_type VARCHAR(40) NOT NULL CHECK (loan_type IN ('working_capital', 'term_loan', 'invoice_discounting', 'equipment_finance', 'other')),
  requested_amount NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),
  purpose TEXT NOT NULL,
  business_name VARCHAR(255),
  annual_turnover NUMERIC(14,2) CHECK (annual_turnover IS NULL OR annual_turnover >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  decision_remarks TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_applications_user_submitted
  ON credit_loan_applications (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_applications_status_submitted
  ON credit_loan_applications (status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS credit_loan_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES credit_loan_applications(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  file_content BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_application_documents_application
  ON credit_loan_application_documents (application_id, uploaded_at);

CREATE TABLE IF NOT EXISTS credit_loan_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES credit_loan_applications(id) ON DELETE CASCADE,
  from_status VARCHAR(20) CHECK (from_status IS NULL OR from_status IN ('pending', 'approved', 'rejected')),
  to_status VARCHAR(20) NOT NULL CHECK (to_status IN ('pending', 'approved', 'rejected')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((actor_user_id IS NOT NULL) <> (actor_admin_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_credit_application_events_timeline
  ON credit_loan_application_events (application_id, created_at, id);

ALTER TABLE credit_loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_loan_applications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_loan_applications_owner ON credit_loan_applications;
CREATE POLICY credit_loan_applications_owner ON credit_loan_applications
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_admin_id', true) IS NOT NULL
  )
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_admin_id', true) IS NOT NULL
  );

ALTER TABLE credit_loan_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_loan_application_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_loan_application_documents_owner ON credit_loan_application_documents;
CREATE POLICY credit_loan_application_documents_owner ON credit_loan_application_documents
  USING (EXISTS (
    SELECT 1 FROM credit_loan_applications a
    WHERE a.id = application_id
      AND (a.user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_admin_id', true) IS NOT NULL)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM credit_loan_applications a
    WHERE a.id = application_id
      AND (a.user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_admin_id', true) IS NOT NULL)
  ));

ALTER TABLE credit_loan_application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_loan_application_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_loan_application_events_owner ON credit_loan_application_events;
CREATE POLICY credit_loan_application_events_owner ON credit_loan_application_events
  USING (EXISTS (
    SELECT 1 FROM credit_loan_applications a
    WHERE a.id = application_id
      AND (a.user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_admin_id', true) IS NOT NULL)
  ))
  WITH CHECK (
    (
      actor_user_id = current_setting('app.current_user_id', true)::uuid
      AND actor_admin_id IS NULL
      AND EXISTS (
        SELECT 1 FROM credit_loan_applications a
        WHERE a.id = application_id
          AND a.user_id = current_setting('app.current_user_id', true)::uuid
      )
    ) OR (
      actor_user_id IS NULL
      AND actor_admin_id = current_setting('app.current_admin_id', true)::uuid
      AND current_setting('app.current_admin_id', true) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM credit_loan_applications a
        WHERE a.id = application_id
          AND current_setting('app.current_admin_id', true) IS NOT NULL
      )
    )
  );

COMMIT;
