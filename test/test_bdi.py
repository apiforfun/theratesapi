import os
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATABASE_URL = os.environ.get('DATABASE_URL')


class RateTest(unittest.TestCase):
    def setUp(self):
        # bdi reads DATABASE_URL at import, like the other scripts.
        os.environ.setdefault('DATABASE_URL', 'postgresql://unused')
        import bdi
        self.rate = bdi.rate

    def test_rate_skips_unavailable_values(self):
        for value in ['N.A.', 'N.E.', '', '0']:
            self.assertIsNone(self.rate('KES', '2026-10-23', value), value)
        self.assertEqual(self.rate('KES', '2026-10-23', '145.3361'), Decimal('145.3361'))

    def test_rate_skips_euro_conversions(self):
        self.assertIsNone(self.rate('DEM', '1999-01-04', '1.95583'))
        self.assertIsNone(self.rate('ADP', '2001-06-01', '166.386'))
        self.assertEqual(self.rate('GRD', '2000-12-29', '340.75'), Decimal('340.75'))
        self.assertIsNone(self.rate('GRD', '2001-01-02', '340.75'))

    def test_rate_skips_replaced_currencies(self):
        self.assertIsNotNone(self.rate('ROL', '2005-06-30', '36055'))
        self.assertIsNone(self.rate('ROL', '2005-07-01', '36055'))
        self.assertIsNotNone(self.rate('ZWD', '2006-07-31', '129196'))
        self.assertIsNone(self.rate('ZWD', '2006-08-01', '318.975'))
        self.assertIsNone(self.rate('AOA', '1999-12-30', '5536623'))
        self.assertIsNotNone(self.rate('AOA', '2000-01-03', '5.70132'))
        self.assertIsNotNone(self.rate('ZWL', '2024-04-08', '33198.8171'))
        self.assertIsNone(self.rate('ZWL', '2024-04-09', '14.7083'))
        self.assertIsNone(self.rate('AFN', '2004-03-31', '5806.4'))
        self.assertIsNotNone(self.rate('AFN', '2004-04-01', '58.52'))

    def test_rate_skips_frozen_isk(self):
        for date in ['2008-12-10', '2009-10-30']:
            self.assertIsNone(self.rate('ISK', date, '290'), date)
        self.assertEqual(self.rate('ISK', '2009-11-02', '184.595'), Decimal('184.595'))


    def test_rate_skips_stray_and_mistyped_rows(self):
        # Lone XDR tables published on non-working days, and one-day typos.
        self.assertIsNone(self.rate('XDR', '2004-04-12', '0.82236'))
        self.assertIsNotNone(self.rate('XDR', '2004-04-13', '0.82236'))
        self.assertIsNone(self.rate('LAK', '2022-09-22', '16'))
        self.assertIsNotNone(self.rate('LAK', '2022-09-23', '15574'))
        self.assertIsNone(self.rate('GEL', '2000-06-01', '1847.34'))


class DailyTableTest(unittest.TestCase):
    def setUp(self):
        os.environ.setdefault('DATABASE_URL', 'postgresql://unused')
        import bdi_daily
        self.published_rows = bdi_daily.published_rows

    def table(self, codes):
        rates = [{'isoCode': c, 'referenceDate': '2026-10-23', 'avgRate': '1.5'} for c in codes]
        return {'resultsInfo': {'totalRecords': len(rates)}, 'rates': rates}

    def test_full_table_is_kept(self):
        codes = [f'Q{i:02d}' for i in range(120)]
        rows = self.published_rows(self.table(codes))
        self.assertEqual(len(rows), 120)
        self.assertEqual(rows[0], ('2026-10-23', 'Q00', Decimal('1.5')))

    def test_thin_or_empty_table_counts_as_not_published(self):
        self.assertEqual(self.published_rows(self.table(['XDR'])), [])
        self.assertEqual(self.published_rows({'resultsInfo': {'totalRecords': 0}}), [])


@unittest.skipUnless(DATABASE_URL, 'set DATABASE_URL to a scratch database')
class PrecedenceTest(unittest.TestCase):
    # Runs in a throwaway schema so the shared rows are never touched.
    def setUp(self):
        import psycopg
        self.schema = f'bdi_test_{os.getpid()}'
        self.admin = psycopg.connect(DATABASE_URL, autocommit=True)
        self.admin.execute(f'CREATE SCHEMA {self.schema}')
        # Cleanups run even when setUp fails part-way, unlike tearDown.
        self.addCleanup(self.admin.close)
        self.addCleanup(self.admin.execute, f'DROP SCHEMA {self.schema} CASCADE')
        self.addCleanup(os.environ.__setitem__, 'DATABASE_URL', DATABASE_URL)
        self.admin.execute(f'SET search_path TO {self.schema}')
        self.admin.execute((ROOT / 'db' / 'schema.sql').read_text())
        sep = '&' if '?' in DATABASE_URL else '?'
        os.environ['DATABASE_URL'] = f'{DATABASE_URL}{sep}options=-csearch_path%3D{self.schema}'
        import importlib
        import bdi
        import daily
        self.bdi = importlib.reload(bdi)
        self.daily = importlib.reload(daily)

    def ecb_insert(self, date, currency, rate):
        import psycopg
        with psycopg.connect(os.environ['DATABASE_URL']) as conn:
            return conn.execute(self.daily.INSERT_SQL, (date, currency, rate)).rowcount

    def row(self, date, currency):
        return self.admin.execute(
            'SELECT rate, source FROM rates WHERE date = %s AND currency = %s', (date, currency)
        ).fetchone()

    def test_ecb_wins_in_either_order(self):
        # Order A: Banca d'Italia first, then the ECB.
        self.bdi.store([('2026-10-23', 'USD', Decimal('1.1193')), ('2026-10-23', 'KES', Decimal('145.3361'))])
        self.ecb_insert('2026-10-23', 'USD', Decimal('1.1193'))
        # Order B: the ECB first, then Banca d'Italia.
        self.ecb_insert('2026-10-22', 'USD', Decimal('1.1210'))
        self.bdi.store([('2026-10-22', 'USD', Decimal('9.9999'))])

        self.assertEqual(self.row('2026-10-23', 'USD'), (Decimal('1.1193'), 'ecb'))
        self.assertEqual(self.row('2026-10-22', 'USD'), (Decimal('1.1210'), 'ecb'))
        self.assertEqual(self.row('2026-10-23', 'KES'), (Decimal('145.3361'), 'bdi'))
        self.assertEqual(self.ecb_insert('2026-10-23', 'USD', Decimal('1.1193')), 0)


if __name__ == '__main__':
    unittest.main()
