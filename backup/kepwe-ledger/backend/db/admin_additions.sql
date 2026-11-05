-- ============================================================================
-- KEPWE — Admin Panel additive schema changes
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Does NOT touch or re-create any table from schema.sql.
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: admin_users
-- Separate admin accounts (independent from the normal `users` table).
-- Keeps admin authentication fully separate from customer authentication.
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        CITEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'admin',   -- admin | super_admin
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users (username);
CREATE INDEX IF NOT EXISTS idx_admin_users_active   ON admin_users (is_active) WHERE is_active = TRUE;

-- ============================================================================
-- TABLE: admin_sessions
-- Refresh-token / session persistence for admin accounts (separate from
-- user_sessions so admin auth is fully isolated from customer auth).
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id      UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    user_agent    TEXT,
    ip_address    INET,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token   ON admin_sessions (refresh_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at) WHERE revoked_at IS NULL;

-- ============================================================================
-- TABLE: website_sections
-- Admin-controlled visibility + display settings for the IndexPilot app
-- sections (Pulse, Chain, Strategy, Shield, Desk, Alerts, Reports, Account).
-- ============================================================================
CREATE TABLE IF NOT EXISTS website_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(50) NOT NULL UNIQUE,          -- e.g. 'pulse', 'chain', 'strategy'
    label           VARCHAR(100) NOT NULL,
    route           VARCHAR(100) NOT NULL,                -- e.g. '/app/dashboard'
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    display_title   VARCHAR(255),
    display_subtitle TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    updated_by      UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_sections_key ON website_sections (key);

-- Seed the 8 IndexPilot app sections (idempotent).
INSERT INTO website_sections (key, label, route, is_enabled, display_title, display_subtitle, sort_order) VALUES
('pulse',    'Pulse',    '/app/dashboard', TRUE, 'Market Pulse',    'Live index regime & market overview', 10),
('chain',    'Chain',    '/app/chain',      TRUE, 'Option Chain',    'NIFTY & Bank NIFTY option chain',     20),
('strategy', 'Strategy', '/app/setups',     TRUE, 'Strategy Setups', 'Matching strategy setups',            30),
('shield',   'Shield',   '/app/shield',     TRUE, 'Risk Shield',     'Risk management & position sizing',   40),
('desk',     'Desk',     '/app/desk',       TRUE, 'Trading Desk',    'Paper trading & trade journal',       50),
('alerts',   'Alerts',   '/app/alerts',     TRUE, 'Alerts',          'Notification rules & preferences',    60),
('reports',  'Reports',  '/app/reports',    TRUE, 'Reports',         'Research reports & analysis',         70),
('account',  'Account',  '/app/account',    TRUE, 'Account',         'Subscription, billing & profile',     80)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TABLE: announcements
-- Popup / announcement messages shown on the frontend.
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(255) NOT NULL,
    message       TEXT NOT NULL,
    button_text   VARCHAR(100),
    button_link   VARCHAR(500),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    placement     VARCHAR(20) NOT NULL DEFAULT 'popup',   -- popup | banner | toast
    start_at      TIMESTAMPTZ,
    end_at        TIMESTAMPTZ,
    created_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_announcements_window ON announcements (start_at, end_at);

-- ============================================================================
-- ROW LEVEL SECURITY for admin tables
-- Admin tables are only accessible via the admin API (which uses the
-- `app.current_admin_id` setting). Normal users can never read them.
-- ============================================================================

-- Helper: is the current admin context set and active?
CREATE OR REPLACE FUNCTION is_admin_context()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = current_setting('app.current_admin_id', true)::uuid
          AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements    ENABLE ROW LEVEL SECURITY;

-- admin_users — only admin context can read; self-update allowed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'p_admin_users_select') THEN
        CREATE POLICY p_admin_users_select ON admin_users
            FOR SELECT USING (is_admin_context());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'p_admin_users_update') THEN
        CREATE POLICY p_admin_users_update ON admin_users
            FOR UPDATE USING (is_admin_context());
    END IF;
END $$;

-- admin_sessions — admin context only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_sessions' AND policyname = 'p_admin_sessions_all') THEN
        CREATE POLICY p_admin_sessions_all ON admin_sessions
            FOR ALL USING (is_admin_context());
    END IF;
END $$;

-- website_sections — admin context can read/write; public can read enabled sections
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'website_sections' AND policyname = 'p_ws_admin_all') THEN
        CREATE POLICY p_ws_admin_all ON website_sections
            FOR ALL USING (is_admin_context());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'website_sections' AND policyname = 'p_ws_public_select') THEN
        CREATE POLICY p_ws_public_select ON website_sections
            FOR SELECT USING (is_enabled = TRUE);
    END IF;
END $$;

-- announcements — admin context can read/write; public can read active announcements
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'p_ann_admin_all') THEN
        CREATE POLICY p_ann_admin_all ON announcements
            FOR ALL USING (is_admin_context());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'p_ann_public_select') THEN
        CREATE POLICY p_ann_public_select ON announcements
            FOR SELECT USING (
                is_active = TRUE
                AND (start_at IS NULL OR start_at <= NOW())
                AND (end_at IS NULL OR end_at >= NOW())
            );
    END IF;
END $$;

COMMIT;
