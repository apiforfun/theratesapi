import os
from decimal import Decimal

import psycopg
import requests

# Shared by bdi_daily.py and bdi_backfill.py: Banca d'Italia's API, which of its rows we keep,
# and how they are stored next to the ECB's.

# -- Configuration ----------------------------------------------------------
DATABASE_URL = os.environ['DATABASE_URL']
API_URL      = 'https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0'
HEADERS      = {'Accept': 'application/json', 'User-Agent': 'theratesapi (+https://theratesapi.com)'}

# The ECB's row wins when both publish a currency, so Banca d'Italia never overwrites.
INSERT_SQL = '''
    INSERT INTO rates (date, currency, rate, source) VALUES (%s, %s, %s, 'bdi')
    ON CONFLICT (date, currency) DO NOTHING
'''

UNAVAILABLE = {'N.A.', 'N.E.', ''}

# Banca d'Italia rows that are not rates: code -> inclusive (first, last) ISO dates, None = open.
SKIP = {
    # Euro legacy currencies: from euro adoption the figure is the fixed conversion rate.
    # ADP, the Andorran peseta, was the Spanish peseta at par.
    **{code: ('1999-01-01', None) for code in 'ADP ATS BEF DEM ESP FIM FRF IEP ITL LUF NLG PTE'.split()},
    'GRD': ('2001-01-01', None),
    'SIT': ('2007-01-01', None),
    'CYP': ('2008-01-01', None),
    'MTL': ('2008-01-01', None),
    'SKK': ('2009-01-01', None),
    'EEK': ('2011-01-01', None),
    'LVL': ('2014-01-01', None),
    'LTL': ('2015-01-01', None),
    'HRK': ('2023-01-01', None),
    'BGN': ('2026-01-01', None),
    # Redenominations: once the successor starts, the old code is a fixed multiple of it.
    'ROL': ('2005-07-01', None),
    'TRL': ('2005-01-01', None),
    'VEB': ('2008-01-02', None),
    'GHC': ('2007-07-02', None),
    'AZM': ('2006-01-02', None),
    'TMM': ('2009-01-02', None),
    'MZM': ('2006-07-03', None),
    'BYB': ('2000-02-07', None),
    'BYR': ('2016-07-01', None),
    'SDD': ('2007-04-02', None),
    'MGF': ('2005-01-03', None),
    'TJR': ('2001-01-02', None),
    'ZRN': ('1999-04-02', None),
    'BGL': ('1999-07-21', None),
    # Relabels: Banca d'Italia quotes another currency's units under the code.
    'AFN': (None, '2004-03-31'),          # old afghani
    'AOA': (None, '1999-12-31'),          # readjusted kwanza (AOR)
    'ZWD': ('2006-08-01', None),          # ZWN units from the 2006 redenomination
    'ZWL': ('2024-04-09', None),          # ZWG values
    # Frozen: the ECB's last ISK (290) repeated while no market rate existed.
    'ISK': ('2008-12-10', '2009-10-30'),
}

# Single rows that are not rates: lone XDR tables published on non-working days, and typos.
SKIP_ROWS = {
    ('XDR', '2000-03-18'), ('XDR', '2004-04-12'), ('XDR', '2016-03-28'),
    ('GEL', '2000-06-01'),
    ('LAK', '2022-09-22'), ('LAK', '2022-10-24'), ('LAK', '2023-04-12'), ('LAK', '2024-02-05'),
    ('LAK', '2025-05-22'),
}


# -- Which rows to keep -----------------------------------------------------
def rate(code, date, value):
    """The rate to store for code on date (ISO strings), or None when it is not a rate."""
    value = (value or '').strip()
    if value in UNAVAILABLE or Decimal(value) == 0 or (code, date) in SKIP_ROWS:
        return None
    first, last = SKIP.get(code, (None, None))
    if code in SKIP and (first is None or date >= first) and (last is None or date <= last):
        return None
    return Decimal(value)


# -- Fetching and storing ---------------------------------------------------
def get(path, **params):
    resp = requests.get(API_URL + path, params=params, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    return resp.json()


def store(rows):
    """Insert (date, currency, rate) rows in one transaction; returns how many were new."""
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.executemany(INSERT_SQL, rows)
            return cur.rowcount
