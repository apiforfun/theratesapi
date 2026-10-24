-- One-off migration: ecb_rates becomes rates, shared by every source. Existing rows are the
-- ECB's and keep their values.
--
-- Rollout, outside 15:00 to 21:00 UTC (when the daily jobs run):
--   1. This file. The previous app and daily.py keep working through the ecb_rates view, and
--      the default marks their inserts 'ecb'.
--   2. bdi_backfill.py. The previous app is unaffected: the view only shows ECB rows.
--   3. Deploy the new code, then 2026-10-24-rates-table-finish.sql, then add the cron entries.
-- Rollback: 2026-10-24-rates-table-rollback-prepare.sql, redeploy the previous code and cron,
-- then 2026-10-24-rates-table-rollback.sql.
BEGIN;

ALTER TABLE ecb_rates RENAME TO rates;
ALTER TABLE rates RENAME CONSTRAINT ecb_rates_pkey TO rates_pkey;
ALTER INDEX ecb_rates_currency_date RENAME TO rates_currency_date;

-- A constant default only touches the catalog, so existing rows are not rewritten.
ALTER TABLE rates ADD COLUMN source text NOT NULL DEFAULT 'ecb';

CREATE VIEW ecb_rates AS SELECT date, currency, rate FROM rates WHERE source = 'ecb';

COMMIT;
