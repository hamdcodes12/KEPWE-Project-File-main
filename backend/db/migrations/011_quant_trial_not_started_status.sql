-- Keep the enum change in its own migration transaction. PostgreSQL requires
-- a newly added enum value to be committed before other statements use it.
ALTER TYPE quant_subscription_status ADD VALUE IF NOT EXISTS 'not_started' BEFORE 'trial';
