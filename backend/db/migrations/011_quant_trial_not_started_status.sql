-- Add NOT_STARTED before the subscription migration uses it on databases that
-- already have the older enum. Fresh databases create the complete enum in
-- quant_subscription_system.sql, so this migration must also be safe before
-- that type exists. Keep this file separate so PostgreSQL commits the enum
-- value before a later migration casts to it.
DO $$
DECLARE
  has_trial_label BOOLEAN;
BEGIN
  IF to_regtype('public.quant_subscription_status') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'quant_subscription_status'
      AND e.enumlabel = 'not_started'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'quant_subscription_status'
      AND e.enumlabel = 'trial'
  ) INTO has_trial_label;

  IF has_trial_label THEN
    EXECUTE 'ALTER TYPE public.quant_subscription_status ADD VALUE ''not_started'' BEFORE ''trial''';
  ELSE
    EXECUTE 'ALTER TYPE public.quant_subscription_status ADD VALUE ''not_started''';
  END IF;
END $$;
