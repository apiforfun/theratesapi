-- Last step of a rollback, once the previous code and cron are back: drops every non-ECB row
-- and restores ecb_rates exactly. Run 2026-10-24-rates-table-rollback-prepare.sql first.
BEGIN;

DROP VIEW IF EXISTS ecb_rates;
DELETE FROM rates WHERE source <> 'ecb';
ALTER TABLE rates DROP COLUMN source;

ALTER INDEX rates_currency_date RENAME TO ecb_rates_currency_date;
ALTER TABLE rates RENAME CONSTRAINT rates_pkey TO ecb_rates_pkey;
ALTER TABLE rates RENAME TO ecb_rates;

COMMIT;
