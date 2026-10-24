import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg

import bdi

SCHEMA_PATH = Path(__file__).parent / 'db' / 'schema.sql'
START_DATE  = '1999-01-01'


# -- Step 1: Every code Banca d'Italia has ever quoted, current and retired --
def currency_codes():
    return [c['isoCode'] for c in bdi.get('/currencies', lang='en')['currencies']]


# -- Step 2: One request per currency returns its whole series against EUR --
def fetch_history(code, end_date):
    data = bdi.get('/dailyTimeSeries', startDate=START_DATE, endDate=end_date,
                   baseCurrencyIsoCode=code, currencyIsoCode='EUR', lang='en')
    series = data.get('rates', [])
    rows = []
    for r in series:
        value = bdi.rate(code, r['referenceDate'], r['avgRate'])
        if value is not None:
            rows.append((r['referenceDate'], code, value))
    return rows, len(series)


def backfill():
    with psycopg.connect(bdi.DATABASE_URL) as conn:
        conn.execute(SCHEMA_PATH.read_text())
    end_date = datetime.now(timezone.utc).date().isoformat()
    total = 0
    for i, code in enumerate(currency_codes()):
        if i:
            time.sleep(1)
        rows, published = fetch_history(code, end_date)
        inserted = bdi.store(rows) if rows else 0
        total += inserted
        print(f"{code}: inserted {inserted} of {published}")
    print(f"Inserted {total} Banca d'Italia rates")


if __name__ == '__main__':
    backfill()
