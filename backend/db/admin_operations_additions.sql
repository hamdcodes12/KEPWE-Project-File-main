-- KEPWE — Admin operations audit trail (additive and idempotent).
BEGIN;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id     UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(80) NOT NULL,
    entity_id    UUID,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address   INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user ON admin_user_notes (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag VARCHAR(40) NOT NULL,
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_tags_user ON admin_user_tags (user_id);

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(80),
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications (is_read, created_at DESC);

COMMIT;
