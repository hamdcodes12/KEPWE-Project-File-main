BEGIN;

ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS remaining_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE algo_orders DROP CONSTRAINT IF EXISTS algo_orders_price_check;
ALTER TABLE algo_orders ADD CONSTRAINT algo_orders_price_check CHECK (price >= 0);

COMMIT;