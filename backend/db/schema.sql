-- ============================================================================
-- KEPWE — Complete PostgreSQL Schema
-- Backend integration for the existing KEPWE frontend (React + Vite SPA)
-- Target: PostgreSQL 13+
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive email

-- ============================================================================
-- ENUM TYPES
-- ============================================================================
CREATE TYPE user_role_type      AS ENUM ('customer', 'admin', 'sales_agent', 'accountant', 'cfo');
CREATE TYPE plan_type           AS ENUM ('Free Trial', 'Launch', 'Essential', 'Growth', 'Scale', 'Scale + CFO', 'Basic', 'Pro', 'Pro+', 'Premium');
CREATE TYPE checklist_status    AS ENUM ('Pending', 'Uploaded', 'Verified', 'Action Required');
CREATE TYPE checklist_category  AS ENUM ('Company Information', 'Accounting', 'Payroll');
CREATE TYPE lead_score_type     AS ENUM ('HOT', 'WARM', 'COLD');
CREATE TYPE lead_status_type    AS ENUM ('New', 'Called', 'Connected', 'Interested', 'Converted', 'Lost');
CREATE TYPE lead_source_type    AS ENUM ('Free Compliance Check Form', 'Contact Page', 'New Incorporation Database', 'GST Filing Portal Inbound', 'MCA Incorporation Feed', 'Manual', 'Other');
CREATE TYPE task_status_type    AS ENUM ('Upcoming', 'In Progress', 'Completed', 'Action Required');
CREATE TYPE task_category_type  AS ENUM ('GST', 'TDS', 'MCA', 'Payroll', 'Income Tax');
CREATE TYPE document_status     AS ENUM ('Uploaded', 'Processing', 'Verified', 'Rejected');
CREATE TYPE document_category   AS ENUM ('Company Documents', 'GST', 'Bank Statements', 'Sales', 'Purchases', 'Payroll', 'Tax', 'Other');
CREATE TYPE followup_channel    AS ENUM ('WhatsApp/SMS', 'Email', 'WhatsApp', 'Offer', 'Follow-up', 'Campaign');
CREATE TYPE business_type_type  AS ENUM ('Private Limited', 'LLP', 'Partnership', 'Proprietorship', 'Other');
CREATE TYPE compliance_status   AS ENUM ('Good', 'Attention', 'Action Required');
CREATE TYPE billing_status      AS ENUM ('Paid', 'Pending', 'Failed', 'Refunded');
CREATE TYPE verdict_type        AS ENUM ('TRADE', 'CAUTION', 'NO_TRADE');
CREATE TYPE trade_status_type   AS ENUM ('Executed', 'Skipped', 'Paper Trade', 'Overridden');
CREATE TYPE risk_category_type  AS ENUM ('Conservative', 'Balanced', 'Aggressive');
CREATE TYPE experience_type     AS ENUM ('New', 'Intermediate', 'Experienced');
CREATE TYPE payment_method_type AS ENUM ('UPI', 'Card', 'Net Banking', 'Auto-debit', 'Other');
CREATE TYPE deletion_status     AS ENUM ('Requested', 'Processing', 'Completed', 'Cancelled');

-- ============================================================================
-- TABLE: users
-- Core auth + profile for every user (customer, admin, sales agent, etc.)
-- ============================================================================
CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              CITEXT NOT NULL UNIQUE,
    password_hash      TEXT NOT NULL,
    full_name          VARCHAR(255) NOT NULL,
    mobile             VARCHAR(20),
    role               user_role_type NOT NULL DEFAULT 'customer',
    email_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    plan               plan_type NOT NULL DEFAULT 'Free Trial',
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email        ON users (email);
CREATE INDEX idx_users_role         ON users (role);
CREATE INDEX idx_users_is_active    ON users (is_active) WHERE is_active = TRUE;

-- ============================================================================
-- TABLE: user_sessions
-- Refresh-token / session persistence (auth/session data)
-- ============================================================================
CREATE TABLE user_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    user_agent    TEXT,
    ip_address    INET,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    remember_me   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id        ON user_sessions (user_id);
CREATE INDEX idx_sessions_refresh_token  ON user_sessions (refresh_token);
CREATE INDEX idx_sessions_expires        ON user_sessions (expires_at) WHERE revoked_at IS NULL;

-- ============================================================================
-- TABLE: companies
-- Business entities (used by CRM leads, customer portal, compliance, onboarding)
-- A company can have multiple members (users) with different roles.
-- ============================================================================
CREATE TABLE companies (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(255) NOT NULL,
    cin                VARCHAR(21),
    gstin              VARCHAR(15),
    pan                VARCHAR(10),
    business_type      business_type_type,
    industry           VARCHAR(100),
    state              VARCHAR(100),
    city               VARCHAR(100),
    address            TEXT,
    avg_monthly_turnover VARCHAR(20),         -- e.g. '<₹5L', '₹5–25L', '₹25–50L', '₹50L+'
    employee_count     INTEGER,
    incorporation_date DATE,
    gst_status         VARCHAR(20) DEFAULT 'Pending',  -- Active | Pending | Inactive
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cin)       -- NULL cin values allowed (multiple NULLs)
);

CREATE INDEX idx_companies_name      ON companies (name);
CREATE INDEX idx_companies_gstin     ON companies (gstin);
CREATE INDEX idx_companies_industry  ON companies (industry);
CREATE INDEX idx_companies_state     ON companies (state);

-- ============================================================================
-- TABLE: company_members
-- Many-to-many user ↔ company ownership/sharing with per-user role
-- ============================================================================
CREATE TABLE company_members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role           user_role_type NOT NULL DEFAULT 'customer',
    is_owner       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_members_company  ON company_members (company_id);
CREATE INDEX idx_company_members_user     ON company_members (user_id);

-- ============================================================================
-- TABLE: plans
-- Reference data for all subscription plans shown in PricingPage / AppAccountPage
-- ============================================================================
CREATE TABLE plans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          plan_type NOT NULL UNIQUE,
    display_name  VARCHAR(255) NOT NULL,
    price_inr     NUMERIC(10,2) NOT NULL DEFAULT 0,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    is_indexpilot BOOLEAN NOT NULL DEFAULT TRUE,
    features      JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: subscriptions
-- User's current subscription + renewal metadata
-- ============================================================================
CREATE TABLE subscriptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id          UUID NOT NULL REFERENCES plans(id),
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    price_at_signup  NUMERIC(10,2) NOT NULL,
    renews_on        DATE,
    payment_method   payment_method_type DEFAULT 'UPI',
    auto_renew       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)  -- one active subscription per user
);

CREATE INDEX idx_subscriptions_user      ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_plan      ON subscriptions (plan_id);
CREATE INDEX idx_subscriptions_renews    ON subscriptions (renews_on) WHERE status = 'active';

-- ============================================================================
-- TABLE: billing_history
-- Invoice history shown in AppAccountPage
-- ============================================================================
CREATE TABLE billing_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount           NUMERIC(10,2) NOT NULL,
    status           billing_status NOT NULL DEFAULT 'Paid',
    plan_name        VARCHAR(100) NOT NULL,
    invoice_number   VARCHAR(50) NOT NULL UNIQUE,
    billing_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_history_user     ON billing_history (user_id);
CREATE INDEX idx_billing_history_sub      ON billing_history (subscription_id);

-- ============================================================================
-- TABLE: onboarding_checklist_items
-- System template — the canonical list of onboarding requirements
-- (Company Information / Accounting / Payroll categories)
-- ============================================================================
CREATE TABLE onboarding_checklist_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category      checklist_category NOT NULL,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    is_required   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category, title)
);

CREATE INDEX idx_checklist_cat ON onboarding_checklist_items (category);

-- ============================================================================
-- TABLE: company_checklist_items
-- Per-company status tracking of the onboarding checklist (owned by company)
-- ============================================================================
CREATE TABLE company_checklist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES onboarding_checklist_items(id) ON DELETE CASCADE,
    status          checklist_status NOT NULL DEFAULT 'Pending',
    note            TEXT,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, checklist_item_id)
);

CREATE INDEX idx_company_checklist_company     ON company_checklist_items (company_id);
CREATE INDEX idx_company_checklist_status      ON company_checklist_items (status);
CREATE INDEX idx_company_checklist_cat         ON company_checklist_items (checklist_item_id);

-- ============================================================================
-- TABLE: customer_documents
-- Document vault (CustomerPortalPage) + checklist uploads
-- ============================================================================
CREATE TABLE customer_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    category      document_category NOT NULL DEFAULT 'Other',
    file_path     TEXT,                       -- S3-like object key or local path
    file_size_bytes BIGINT,
    mime_type     VARCHAR(100),
    status        document_status NOT NULL DEFAULT 'Uploaded',
    checklist_item_id UUID REFERENCES company_checklist_items(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_company    ON customer_documents (company_id);
CREATE INDEX idx_documents_uploader   ON customer_documents (uploaded_by);
CREATE INDEX idx_documents_category   ON customer_documents (category);
CREATE INDEX idx_documents_status     ON customer_documents (status);

-- ============================================================================
-- TABLE: crm_leads
-- Sales CRM lead pipeline (SalesCRMPage)
-- ============================================================================
CREATE TABLE crm_leads (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name       VARCHAR(255) NOT NULL,
    contact_name       VARCHAR(255) NOT NULL,
    mobile             VARCHAR(20) NOT NULL,
    email              CITEXT,
    cin                VARCHAR(21),
    gstin              VARCHAR(15),
    incorporation_date DATE,
    industry           VARCHAR(100),
    state              VARCHAR(100),
    gst_status         VARCHAR(20) DEFAULT 'Pending',
    lead_score         lead_score_type NOT NULL DEFAULT 'WARM',
    lead_source        lead_source_type NOT NULL DEFAULT 'Other',
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    assigned_executive UUID REFERENCES users(id) ON DELETE SET NULL,   -- sales agent
    status             lead_status_type NOT NULL DEFAULT 'New',
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_email        ON crm_leads (email);
CREATE INDEX idx_leads_company      ON crm_leads (company_name);
CREATE INDEX idx_leads_score        ON crm_leads (lead_score);
CREATE INDEX idx_leads_status       ON crm_leads (status);
CREATE INDEX idx_leads_source       ON crm_leads (lead_source);
CREATE INDEX idx_leads_assigned     ON crm_leads (assigned_executive);
CREATE INDEX idx_leads_created      ON crm_leads (created_at DESC);

-- ============================================================================
-- TABLE: lead_activities
-- Sales activity log per lead (salesActivity array in CRMLead type)
-- ============================================================================
CREATE TABLE lead_activities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    activity    TEXT NOT NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_activities_lead ON lead_activities (lead_id);
CREATE INDEX idx_lead_activities_by   ON lead_activities (performed_by);

-- ============================================================================
-- TABLE: lead_followup_cadences
-- System-wide automated follow-up workflow steps (SalesCRMPage workflow tab)
-- ============================================================================
CREATE TABLE lead_followup_cadences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_label   VARCHAR(20) NOT NULL,          -- 'Day 0', 'Day 1', ...
    day_offset  INTEGER NOT NULL DEFAULT 0,    -- 0, 1, 3, 7, 15, 30
    channel     followup_channel NOT NULL,
    message     TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (day_offset, channel)
);

-- ============================================================================
-- TABLE: compliance_checks
-- Free Compliance Check wizard submissions + generated health snapshot
-- ============================================================================
CREATE TABLE compliance_checks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID REFERENCES users(id) ON DELETE SET NULL,   -- NULL for anonymous
    company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
    lead_id               UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
    company_name          VARCHAR(255) NOT NULL,
    cin                   VARCHAR(21),
    gstin                 VARCHAR(15),
    business_type         business_type_type,
    industry              VARCHAR(100),
    state                 VARCHAR(100),
    avg_monthly_turnover  VARCHAR(20),
    contact_name          VARCHAR(255),
    contact_mobile        VARCHAR(20),
    contact_email         CITEXT,
    overall_score         INTEGER NOT NULL DEFAULT 0,     -- 0–100
    gst_status            compliance_status NOT NULL DEFAULT 'Good',
    tds_status            compliance_status NOT NULL DEFAULT 'Good',
    mca_status            compliance_status NOT NULL DEFAULT 'Good',
    payroll_status        compliance_status NOT NULL DEFAULT 'Good',
    issues_found          INTEGER NOT NULL DEFAULT 0,
    recommendations       JSONB NOT NULL DEFAULT '[]'::jsonb,
    report_generated_at   TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_user      ON compliance_checks (user_id);
CREATE INDEX idx_compliance_company   ON compliance_checks (company_id);
CREATE INDEX idx_compliance_lead      ON compliance_checks (lead_id);
CREATE INDEX idx_compliance_created   ON compliance_checks (created_at DESC);
CREATE INDEX idx_compliance_email     ON compliance_checks (contact_email);

-- ============================================================================
-- TABLE: contact_submissions
-- Contact page ("Request Free CA Callback") submissions
-- ============================================================================
CREATE TABLE contact_submissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    company      VARCHAR(255),
    email        CITEXT NOT NULL,
    phone        VARCHAR(20) NOT NULL,
    requirement  VARCHAR(100) NOT NULL DEFAULT 'GST & Accounting',
    lead_id      UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'New',    -- New | Contacted | Closed
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_email     ON contact_submissions (email);
CREATE INDEX idx_contact_status    ON contact_submissions (status);
CREATE INDEX idx_contact_created   ON contact_submissions (created_at DESC);

-- ============================================================================
-- TABLE: customer_tasks
-- Compliance calendar / task list shown in CustomerPortalPage
-- ============================================================================
CREATE TABLE customer_tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category      task_category_type NOT NULL,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    due_date      DATE NOT NULL,
    status        task_status_type NOT NULL DEFAULT 'Upcoming',
    completed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at  TIMESTAMPTZ,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_company   ON customer_tasks (company_id);
CREATE INDEX idx_tasks_due       ON customer_tasks (due_date);
CREATE INDEX idx_tasks_status    ON customer_tasks (status);
CREATE INDEX idx_tasks_category  ON customer_tasks (category);

-- ============================================================================
-- TABLE: risk_profiles
-- IndexPilot user risk profile (userRiskProfile in AppContext)
-- ============================================================================
CREATE TABLE risk_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    experience          experience_type NOT NULL DEFAULT 'New',
    capital_range       VARCHAR(20) NOT NULL DEFAULT '₹25k–1L',
    capital_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_acceptable_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
    indices             JSONB NOT NULL DEFAULT '["NIFTY"]'::jsonb,
    risk_category       risk_category_type NOT NULL DEFAULT 'Balanced',
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: trade_journals
-- IndexPilot trade journal / override log (AppDeskPage)
-- ============================================================================
CREATE TABLE trade_journals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    index_symbol    VARCHAR(20) NOT NULL,
    strategy        VARCHAR(100) NOT NULL,
    verdict         verdict_type NOT NULL,
    is_override     BOOLEAN NOT NULL DEFAULT FALSE,
    override_reason TEXT,
    status          trade_status_type NOT NULL DEFAULT 'Paper Trade',
    pnl             NUMERIC(12,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_user      ON trade_journals (user_id);
CREATE INDEX idx_journal_date      ON trade_journals (user_id, trade_date DESC);
CREATE INDEX idx_journal_verdict   ON trade_journals (verdict);

-- ============================================================================
-- TABLE: alert_configs
-- IndexPilot notification preferences (AppAlertsPage)
-- ============================================================================
CREATE TABLE alert_configs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    verdict_changes       BOOLEAN NOT NULL DEFAULT TRUE,
    risk_limit_breach     BOOLEAN NOT NULL DEFAULT TRUE,
    event_risk            BOOLEAN NOT NULL DEFAULT TRUE,
    new_matching_setup    BOOLEAN NOT NULL DEFAULT TRUE,
    volatility_spike      BOOLEAN NOT NULL DEFAULT TRUE,
    minute_by_minute_price BOOLEAN NOT NULL DEFAULT FALSE,
    promotional           BOOLEAN NOT NULL DEFAULT FALSE,
    channel_push          BOOLEAN NOT NULL DEFAULT TRUE,
    channel_email         BOOLEAN NOT NULL DEFAULT TRUE,
    channel_sms           BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start     TIME NOT NULL DEFAULT '22:00',
    quiet_hours_end       TIME NOT NULL DEFAULT '08:00',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: notifications
-- In-app / push notification records (if/when needed by the IndexPilot app)
-- ============================================================================
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,             -- verdict_change | risk_breach | event | setup | volatility | system
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    data       JSONB,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user  ON notifications (user_id, is_read, created_at DESC);

-- ============================================================================
-- TABLE: data_deletion_requests
-- DPDP Act account deletion requests (AppAccountPage)
-- ============================================================================
CREATE TABLE data_deletion_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        deletion_status NOT NULL DEFAULT 'Requested',
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ,
    notes         TEXT
);

CREATE INDEX idx_deletion_user   ON data_deletion_requests (user_id);
CREATE INDEX idx_deletion_status ON data_deletion_requests (status);

-- ============================================================================
-- TABLE: paper_trade_settings
-- IndexPilot paper/live trade mode preference + simulated capital
-- ============================================================================
CREATE TABLE paper_trade_settings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    paper_trade_mode   BOOLEAN NOT NULL DEFAULT TRUE,
    simulated_capital  NUMERIC(12,2) NOT NULL DEFAULT 100000,
    sessions_completed INTEGER NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: business_onboardings
-- BusinessOnboardingPage wizard answers + recommended plan
-- ============================================================================
CREATE TABLE business_onboardings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
    business_type     business_type_type NOT NULL,
    business_age      VARCHAR(30) NOT NULL,
    avg_monthly_turnover VARCHAR(20) NOT NULL,
    needs             JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    completed         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_biz_onboarding_user  ON business_onboardings (user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Guarantees one logged-in user cannot access another user's private data.
-- ============================================================================

-- Helper: is the current user a member/owner of the given company?
CREATE OR REPLACE FUNCTION is_company_member(c_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM company_members
        WHERE company_id = c_id
          AND user_id = current_setting('app.current_user_id', true)::uuid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: is the current user an admin or sales agent?
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users
        WHERE id = current_setting('app.current_user_id', true)::uuid
          AND role IN ('admin', 'sales_agent', 'accountant', 'cfo')
          AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── user-owned tables ───────────────────────────────────────────────────────
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_journals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trade_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_onboardings     ENABLE ROW LEVEL SECURITY;

-- users — self-service read/update; staff can read all
CREATE POLICY p_users_select_self ON users
    FOR SELECT USING (id = current_setting('app.current_user_id', true)::uuid OR is_staff());
CREATE POLICY p_users_update_self ON users
    FOR UPDATE USING (id = current_setting('app.current_user_id', true)::uuid);

-- sessions — owner only
CREATE POLICY p_sessions_owner ON user_sessions
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- subscriptions / billing_history / risk_profiles / trade_journals / alert_configs —
-- owner only
CREATE POLICY p_subscriptions_owner ON subscriptions
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_billing_owner ON billing_history
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_risk_profiles_owner ON risk_profiles
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_trade_journals_owner ON trade_journals
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_alert_configs_owner ON alert_configs
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_paper_trade_owner ON paper_trade_settings
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_notifications_owner ON notifications
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_deletion_owner ON data_deletion_requests
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_biz_onboarding_owner ON business_onboardings
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- ── company-scoped tables ────────────────────────────────────────────────────
ALTER TABLE companies                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities              ENABLE ROW LEVEL SECURITY;

-- companies — members + staff can read; owner/staff can write
CREATE POLICY p_companies_member_select ON companies
    FOR SELECT USING (is_company_member(id) OR is_staff());
CREATE POLICY p_companies_owner_insert ON companies
    FOR INSERT WITH CHECK (is_staff() OR current_setting('app.current_user_id', true)::uuid IS NOT NULL);
CREATE POLICY p_companies_owner_update ON companies
    FOR UPDATE USING (is_company_member(id) OR is_staff());

-- company_members — members + staff
CREATE POLICY p_cm_select ON company_members
    FOR SELECT USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_cm_insert ON company_members
    FOR INSERT WITH CHECK (is_company_member(company_id) OR is_staff());
CREATE POLICY p_cm_update ON company_members
    FOR UPDATE USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_cm_delete ON company_members
    FOR DELETE USING (is_company_member(company_id) OR is_staff());

-- company_checklist_items — members + staff
CREATE POLICY p_cci_select ON company_checklist_items
    FOR SELECT USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_cci_insert ON company_checklist_items
    FOR INSERT WITH CHECK (is_company_member(company_id) OR is_staff());
CREATE POLICY p_cci_update ON company_checklist_items
    FOR UPDATE USING (is_company_member(company_id) OR is_staff());

-- customer_documents — members + staff
CREATE POLICY p_docs_select ON customer_documents
    FOR SELECT USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_docs_insert ON customer_documents
    FOR INSERT WITH CHECK (is_company_member(company_id) OR is_staff());
CREATE POLICY p_docs_update ON customer_documents
    FOR UPDATE USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_docs_delete ON customer_documents
    FOR DELETE USING (is_company_member(company_id) OR is_staff());

-- customer_tasks — members + staff
CREATE POLICY p_tasks_select ON customer_tasks
    FOR SELECT USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_tasks_insert ON customer_tasks
    FOR INSERT WITH CHECK (is_company_member(company_id) OR is_staff());
CREATE POLICY p_tasks_update ON customer_tasks
    FOR UPDATE USING (is_company_member(company_id) OR is_staff());
CREATE POLICY p_tasks_delete ON customer_tasks
    FOR DELETE USING (is_company_member(company_id) OR is_staff());

-- compliance_checks — creator + staff + linked company members
CREATE POLICY p_compliance_select ON compliance_checks
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR is_company_member(company_id)
        OR is_staff()
    );
CREATE POLICY p_compliance_insert ON compliance_checks
    FOR INSERT WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_id', true)::uuid IS NULL
        OR is_staff()
    );
CREATE POLICY p_compliance_update ON compliance_checks
    FOR UPDATE USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR is_staff()
    );

-- contact_submissions — staff only (public form insert allowed without auth)
CREATE POLICY p_contacts_select ON contact_submissions
    FOR SELECT USING (is_staff());
CREATE POLICY p_contacts_insert ON contact_submissions
    FOR INSERT WITH CHECK (
        is_staff()
        OR current_setting('app.current_user_id', true)::uuid IS NULL
    );

-- crm_leads — staff select/update; authenticated users can insert (public forms)
CREATE POLICY p_leads_select ON crm_leads
    FOR SELECT USING (is_staff() OR created_by = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY p_leads_insert ON crm_leads
    FOR INSERT WITH CHECK (
        is_staff()
        OR created_by = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_id', true)::uuid IS NULL
    );
CREATE POLICY p_leads_update ON crm_leads
    FOR UPDATE USING (is_staff() OR created_by = current_setting('app.current_user_id', true)::uuid);

-- lead_activities — staff + lead owner
CREATE POLICY p_la_select ON lead_activities
    FOR SELECT USING (
        is_staff()
        OR EXISTS (
            SELECT 1 FROM crm_leads
            WHERE crm_leads.id = lead_activities.lead_id
              AND crm_leads.created_by = current_setting('app.current_user_id', true)::uuid
        )
    );
CREATE POLICY p_la_insert ON lead_activities
    FOR INSERT WITH CHECK (
        is_staff()
        OR EXISTS (
            SELECT 1 FROM crm_leads
            WHERE crm_leads.id = lead_activities.lead_id
              AND crm_leads.created_by = current_setting('app.current_user_id', true)::uuid
        )
    );

-- ── reference tables (read-only for everyone authenticated) ─────────────────
ALTER TABLE plans                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_followup_cadences      ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_plans_select ON plans FOR SELECT USING (true);
CREATE POLICY p_checklist_template_select ON onboarding_checklist_items FOR SELECT USING (true);
CREATE POLICY p_followup_select ON lead_followup_cadences FOR SELECT USING (true);
CREATE POLICY p_followup_update ON lead_followup_cadences FOR UPDATE USING (is_staff());

-- ============================================================================
-- UPDATED_AT TRIGGER HELPER
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'users', 'companies', 'company_checklist_items', 'customer_documents',
        'crm_leads', 'subscriptions', 'customer_tasks', 'risk_profiles',
        'trade_journals', 'alert_configs', 'paper_trade_settings',
        'business_onboardings', 'contact_submissions', 'lead_followup_cadences'
    ])
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            t, t
        );
    END LOOP;
END $$;

COMMIT;