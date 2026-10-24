-- First step of a rollback, before redeploying the previous code: undoes the finish step so the
-- previous app and daily.py work again through the ecb_rates view.
BEGIN;

ALTER TABLE rates ALTER COLUMN source SET DEFAULT 'ecb';
CREATE VIEW ecb_rates AS SELECT date, currency, rate FROM rates WHERE source = 'ecb';

COMMIT;
