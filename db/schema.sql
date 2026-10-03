CREATE TABLE IF NOT EXISTS ecb_rates (
  date     date    NOT NULL,
  currency char(3) NOT NULL,
  rate     numeric NOT NULL,  -- units of currency per 1 EUR, as published by ECB
  PRIMARY KEY (date, currency)
);

-- Serves the per-base "newest day on or before" lookup in controller/api.js.
CREATE INDEX IF NOT EXISTS ecb_rates_currency_date ON ecb_rates (currency, date);
