-- ============================================================================
-- KEPWE — Production-grade additive schema changes
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: support_tickets
-- Customer Portal Support & Tickets section — real database persistence.
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    subject         VARCHAR(255) NOT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'General',
    priority        VARCHAR(20) NOT NULL DEFAULT 'Normal',
    status          VARCHAR(20) NOT NULL DEFAULT 'Open',
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user    ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_company ON support_tickets (company_id);

-- ============================================================================
-- TABLE: support_ticket_messages
-- Messages / replies within a support ticket.
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_type VARCHAR(20) NOT NULL DEFAULT 'user',   -- user | admin
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages (ticket_id);

-- ============================================================================
-- TABLE: announcement_targets
-- Target users for announcements (all | specific roles | specific users).
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcement_targets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    target_type     VARCHAR(20) NOT NULL DEFAULT 'all',   -- all | role | user
    target_value    VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_targets_ann ON announcement_targets (announcement_id);

-- ============================================================================
-- TABLE: crm_lead_notes
-- Notes attached to CRM leads (persistent).
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_lead_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    note        TEXT NOT NULL,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON crm_lead_notes (lead_id);

-- ============================================================================
-- TABLE: crm_lead_followups
-- Follow-up records for CRM leads.
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_lead_followups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    followup_date DATE NOT NULL,
    followup_type VARCHAR(50) NOT NULL DEFAULT 'Call',
    notes       TEXT,
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_followups_lead ON crm_lead_followups (lead_id);

-- ============================================================================
-- ROW LEVEL SECURITY for new tables
-- ============================================================================

-- support_tickets — owner + staff
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'p_st_select') THEN
        CREATE POLICY p_st_select ON support_tickets
            FOR SELECT USING (
                user_id = current_setting('app.current_user_id', true)::uuid
                OR is_staff()
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'p_st_insert') THEN
        CREATE POLICY p_st_insert ON support_tickets
            FOR INSERT WITH CHECK (
                user_id = current_setting('app.current_user_id', true)::uuid
                OR is_staff()
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'p_st_update') THEN
        CREATE POLICY p_st_update ON support_tickets
            FOR UPDATE USING (
                user_id = current_setting('app.current_user_id', true)::uuid
                OR is_staff()
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_ticket_messages' AND policyname = 'p_stm_select') THEN
        CREATE POLICY p_stm_select ON support_ticket_messages
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM support_tickets st
                    WHERE st.id = support_ticket_messages.ticket_id
                      AND (st.user_id = current_setting('app.current_user_id', true)::uuid OR is_staff())
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_ticket_messages' AND policyname = 'p_stm_insert') THEN
        CREATE POLICY p_stm_insert ON support_ticket_messages
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM support_tickets st
                    WHERE st.id = support_ticket_messages.ticket_id
                      AND (st.user_id = current_setting('app.current_user_id', true)::uuid OR is_staff())
                )
            );
    END IF;
END $$;

-- announcement_targets — admin context only
ALTER TABLE announcement_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcement_targets' AND policyname = 'p_at_admin_all') THEN
        CREATE POLICY p_at_admin_all ON announcement_targets
            FOR ALL USING (is_admin_context());
    END IF;
END $$;

-- crm_lead_notes — staff + lead owner
ALTER TABLE crm_lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_followups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_lead_notes' AND policyname = 'p_ln_select') THEN
        CREATE POLICY p_ln_select ON crm_lead_notes
            FOR SELECT USING (
                is_staff()
                OR EXISTS (
                    SELECT 1 FROM crm_leads
                    WHERE crm_leads.id = crm_lead_notes.lead_id
                      AND crm_leads.created_by = current_setting('app.current_user_id', true)::uuid
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_lead_notes' AND policyname = 'p_ln_insert') THEN
        CREATE POLICY p_ln_insert ON crm_lead_notes
            FOR INSERT WITH CHECK (
                is_staff()
                OR EXISTS (
                    SELECT 1 FROM crm_leads
                    WHERE crm_leads.id = crm_lead_notes.lead_id
                      AND crm_leads.created_by = current_setting('app.current_user_id', true)::uuid
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_lead_followups' AND policyname = 'p_lf_select') THEN
        CREATE POLICY p_lf_select ON crm_lead_followups
            FOR SELECT USING (
                is_staff()
                OR EXISTS (
                    SELECT 1 FROM crm_leads
                    WHERE crm_leads.id = crm_lead_followups.lead_id
                      AND crm_leads.created_by = current_setting('app.current_user_id', true)::uuid
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_lead_followups' AND policyname = 'p_lf_insert') THEN
        CREATE POLICY p_lf_insert ON crm_lead_followups
            FOR INSERT WITH CHECK (
                is_staff()
                OR EXISTS (
                    SELECT 1 FROM crm_leads
                    WHERE crm_leads.id = crm_lead_followups.lead_id
                      AND crm_leads.created_by = current_setting('app.current_user_id', true)::uuid
                )
            );
    END IF;
END $$;

-- ============================================================================
-- Add target_users column to announcements (JSONB for flexible targeting)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'target_users') THEN
        ALTER TABLE announcements ADD COLUMN target_users JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- Add onboarding_completed_at to users for tracking onboarding status
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_completed_at') THEN
        ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- Add last_activity_at to crm_leads for tracking
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'last_activity_at') THEN
        ALTER TABLE crm_leads ADD COLUMN last_activity_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- Add notes column to crm_leads
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'notes') THEN
        ALTER TABLE crm_leads ADD COLUMN notes TEXT;
    END IF;
END $$;

-- ============================================================================
-- Add followup_date to crm_leads
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'next_followup_date') THEN
        ALTER TABLE crm_leads ADD COLUMN next_followup_date DATE;
    END IF;
END $$;

-- ============================================================================
-- Add content column to website_sections for full content control
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'website_sections' AND column_name = 'content') THEN
        ALTER TABLE website_sections ADD COLUMN content TEXT;
    END IF;
END $$;

-- ============================================================================
-- Add visibility column to website_sections
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'website_sections' AND column_name = 'visibility') THEN
        ALTER TABLE website_sections ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public';
    END IF;
END $$;

-- ============================================================================
-- Store uploaded document bytes for the authenticated Ledger document vault
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_documents' AND column_name = 'file_content') THEN
        ALTER TABLE customer_documents ADD COLUMN file_content BYTEA;
    END IF;
END $$;

COMMIT;