-- Step 3 of the 2026-10-24 rollout, once the new code is live: nothing uses ecb_rates any more,
-- and every insert must now name its source.
BEGIN;

DROP VIEW ecb_rates;
ALTER TABLE rates ALTER COLUMN source DROP DEFAULT;

COMMIT;
