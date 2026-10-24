CREATE TABLE IF NOT EXISTS rates (
  date     date    NOT NULL,
  currency char(3) NOT NULL,
  rate     numeric NOT NULL,  -- units of currency per 1 EUR, as published
  source   text    NOT NULL,  -- 'ecb' or 'bdi': who published this row
  PRIMARY KEY (date, currency)
);

-- Serves the per-base "newest day on or before" lookup in controller/api.js.
CREATE INDEX IF NOT EXISTS rates_currency_date ON rates (currency, date);
