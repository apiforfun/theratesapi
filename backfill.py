import csv
import io
import os
import zipfile
from decimal import Decimal
from pathlib import Path

import psycopg
import requests

# -- Configuration ----------------------------------------------------------
DATABASE_URL = os.environ['DATABASE_URL']
ECB_HIST_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip'
SCHEMA_PATH  = Path(__file__).parent / 'db' / 'schema.sql'

# The ECB's rate replaces any other source's row for the same day and currency, never the reverse.
INSERT_SQL = '''
    INSERT INTO rates (date, currency, rate, source) VALUES (%s, %s, %s, 'ecb')
    ON CONFLICT (date, currency) DO UPDATE SET rate = EXCLUDED.rate, source = 'ecb'
    WHERE rates.source <> 'ecb'
'''


# -- Step 1: Download ECB history and yield (date, currency, rate) ----------
def fetch_history():
    resp = requests.get(ECB_HIST_URL)
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as archive:
        text = archive.read('eurofxref-hist.csv').decode('utf-8')
    for row in csv.DictReader(io.StringIO(text)):
        date = row.pop('Date').strip()
        for currency, rate in row.items():
            # The header ends with a trailing comma, giving an empty column name.
            rate = (rate or '').strip()
            if currency and rate and rate != 'N/A':
                yield date, currency.strip(), Decimal(rate)


# -- Step 2: Create the table and insert everything in one transaction ------
def backfill():
    rows = list(fetch_history())
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(SCHEMA_PATH.read_text())
        with conn.cursor() as cur:
            cur.executemany(INSERT_SQL, rows)
            inserted = cur.rowcount
    print(f"Inserted {inserted} of {len(rows)} ECB rates")


if __name__ == '__main__':
    backfill()
