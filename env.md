DATABASE_URL="postgresql://localhost:5432/theratesapi"

daily.py, backfill.py, bdi_daily.py and bdi_backfill.py read DATABASE_URL from the environment (they do not load .env), so the cron entry must set it.

Cron entries (UTC, Monday to Friday):

```
30 15 * * 1-5  cd /path/to/theratesapi && env/bin/python daily.py
30 17 * * 1-5  cd /path/to/theratesapi && env/bin/python daily.py
0 17 * * 1-5   cd /path/to/theratesapi && env/bin/python bdi_daily.py
30 18 * * 1-5  cd /path/to/theratesapi && env/bin/python bdi_daily.py
0 20 * * 1-5   cd /path/to/theratesapi && env/bin/python bdi_daily.py
```

The bdi_daily.py times are a first guess, taken from when Frankfurter polls the same feed (16:00 to 18:30 UTC). Check when Banca d'Italia actually publishes on a weekday and adjust. bdi_daily.py fetches every day since the newest one stored, so a missed run catches up on the next.

bdi_backfill.py loads Banca d'Italia's history once (about 210 requests, roughly 10 minutes). Run it after backfill.py on a new database. On the existing database, follow the rollout order at the top of db/2026-10-24-rates-table.sql. bdi_daily.py refuses to run until the backfill has.
