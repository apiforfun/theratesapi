import os
import xml.etree.ElementTree as ET
from decimal import Decimal

import psycopg
import requests

# -- Configuration ----------------------------------------------------------
DATABASE_URL = os.environ['DATABASE_URL']
ECB_XML_URL  = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

INSERT_SQL = '''
    INSERT INTO ecb_rates (date, currency, rate) VALUES (%s, %s, %s)
    ON CONFLICT (date, currency) DO NOTHING
'''


# -- Step 1: Fetch and parse today's rates from ECB -------------------------
def fetch_ecb_rates():
    resp = requests.get(ECB_XML_URL)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    ns = {
        'gesmes':   'http://www.gesmes.org/xml/2002-08-01',
        'eurofxref':'http://www.ecb.int/vocabulary/2002-08-01/eurofxref'
    }
    cube = root.find('.//eurofxref:Cube[@time]', ns)
    date = cube.attrib['time']
    rates = { c.attrib['currency']: Decimal(c.attrib['rate'])
              for c in cube.findall('eurofxref:Cube', ns) }
    return date, rates


# -- Step 2: Store the EUR-based rates; cross-rates are computed by the API -
def store_rates(date, rates):
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.executemany(INSERT_SQL, [(date, currency, rate) for currency, rate in rates.items()])
            inserted = cur.rowcount
    print(f"Inserted {inserted} of {len(rates)} rates for {date}")


if __name__ == '__main__':
    date, rates = fetch_ecb_rates()
    print(f"Fetched ECB rates for {date}")
    store_rates(date, rates)
