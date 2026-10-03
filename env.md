DATABASE_URL="postgresql://localhost:5432/theratesapi"

daily.py and backfill.py read DATABASE_URL from the environment (they do not load .env), so the cron entry must set it.
