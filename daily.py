import requests
import xml.etree.ElementTree as ET
from pymongo import MongoClient
from decimal import Decimal, getcontext, ROUND_HALF_UP
from bson.decimal128 import Decimal128

# -- Configuration ----------------------------------------------------------
MONGO_URI    = 'mongodb://localhost:27017/'
DB_NAME      = 'theratesapi'
COLLECTION   = 'currency'
ECB_XML_URL  = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

# -- Step 1: Fetch and parse today’s rates from ECB -------------------------
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
    # include EUR base
    rates['EUR'] = Decimal('1.0')
    return date, rates

# -- Step 2: Compute cross-rates for each base and insert into MongoDB ------
def insert_rates_to_mongo(date, rates):
    client     = MongoClient(MONGO_URI)
    db         = client[DB_NAME]
    coll       = db[COLLECTION]

    getcontext().prec = 28  # high precision for intermediate calculations

    # for each currency as the base, compute all other rates
    for base_currency, base_rate in rates.items():
        doc = {
            'date': date,
            'base': base_currency,
            'rates': {}
        }
        # cross-rate for each target currency:
        # rate_target/base_rate
        for tgt_currency, tgt_rate in rates.items():
            # skip base→base (always 1.0)
            if tgt_currency == base_currency:
                continue
            cross_rate = (tgt_rate / base_rate).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
            doc['rates'][tgt_currency] = Decimal128(cross_rate)

        # Check for duplicate before insert
        if coll.find_one({'date': date, 'base': base_currency}):
            print(f"Skipped duplicate for {date} base {base_currency}", doc)
            continue

        coll.insert_one(doc)
        print(f"Inserted rates with base {base_currency}", doc)

if __name__ == '__main__':
    date, rates = fetch_ecb_rates()
    print(f"Fetched ECB rates for {date}")
    insert_rates_to_mongo(date, rates)
