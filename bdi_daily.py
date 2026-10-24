import sys
import time
from datetime import datetime, timedelta, timezone

import psycopg

import bdi


# -- Step 1: Find the first working day Banca d'Italia rates are missing for -
def missing_days():
    with psycopg.connect(bdi.DATABASE_URL) as conn:
        newest = conn.execute("SELECT max(date) FROM rates WHERE source = 'bdi'").fetchone()[0]
    if newest is None:
        sys.exit("No Banca d'Italia rates yet: run bdi_backfill.py first")
    # Every day since the newest stored one, so a missed run or an outage catches up.
    today = datetime.now(timezone.utc).date()
    day = newest + timedelta(days=1)
    while day <= today:
        if day.weekday() < 5:
            yield day
        day += timedelta(days=1)


# A full table has about 150 rates. Banca d'Italia has published a lone XDR rate on holidays,
# so a thinner table is treated as not published rather than replacing the day.
MIN_RATES = 100


# -- Step 2: Fetch each day's table; an empty or thin one means not published -
def published_rows(data):
    if data['resultsInfo']['totalRecords'] < MIN_RATES:
        return []
    rows = []
    for r in data['rates']:
        value = bdi.rate(r['isoCode'], r['referenceDate'], r['avgRate'])
        if value is not None:
            rows.append((r['referenceDate'], r['isoCode'], value))
    return rows


def fetch_day(day):
    return published_rows(bdi.get('/dailyRates', referenceDate=day.isoformat(), currencyIsoCode='EUR', lang='en'))


if __name__ == '__main__':
    rows, published = [], []
    for i, day in enumerate(missing_days()):
        if i:
            time.sleep(0.3)
        day_rows = fetch_day(day)
        if day_rows:
            rows += day_rows
            published.append(day.isoformat())
    if rows:
        inserted = bdi.store(rows)
        print(f"Inserted {inserted} Banca d'Italia rates for {', '.join(published)}")
    else:
        print("No new Banca d'Italia rates")
