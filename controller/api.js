const db = require('../config/db')

// Rates for $1 (base) on the newest ECB publication day on or before $2 (null = latest)
// on which that base was published. ECB rates are units per 1 EUR, so EUR is added as 1
// and every cross-rate is target / base, rounded half-up to 6 decimals. $1 is compared as
// bpchar so the (currency, date) index applies; to_char keeps the date ISO whatever DateStyle is.
const RATES_SQL = `
WITH day AS (
  SELECT max(date) AS date FROM ecb_rates
  WHERE ($1::text = 'EUR' OR currency = $1::bpchar)
    AND date <= coalesce($2::date, 'infinity')
),
quotes AS (
  SELECT r.date, r.currency, r.rate FROM ecb_rates r JOIN day USING (date)
  UNION ALL
  SELECT date, 'EUR', 1 FROM day WHERE date IS NOT NULL
)
SELECT to_char(q.date, 'YYYY-MM-DD') AS date, q.currency, round(q.rate / b.rate, 6)::text AS rate
FROM quotes q JOIN quotes b ON b.currency = $1::bpchar
WHERE q.currency <> $1::bpchar
ORDER BY q.currency`

// Resolves to { date, base, rates } or null when the base has no rates on or before date.
// symbols (upper-case codes, or null for all) limits which rates are returned.
async function fetchRates (base, date, symbols = null) {
  const { rows } = await db.query(RATES_SQL, [base, date])
  if (rows.length === 0) return null
  const rates = {}
  for (const row of rows) {
    if (!symbols || symbols.includes(row.currency)) rates[row.currency] = parseFloat(row.rate)
  }
  return { date: rows[0].date, base, rates }
}

async function sendRates (req, res, next, date) {
  const base = req.query.base || 'EUR'
  const symbols = req.query.symbols
  // Repeated query params arrive as arrays.
  if (typeof base !== 'string' || (symbols && typeof symbols !== 'string')) {
    return res.status(400).json({ error: 'Invalid base or symbols' })
  }
  if (!/^[A-Z]{3}$/.test(base.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid base or symbols' })
  }
  const wanted = symbols ? symbols.toUpperCase().split(',') : null

  try {
    const result = await fetchRates(base.toUpperCase(), date, wanted)
    if (!result) {
      return res.status(400).json({ error: 'Invalid base or symbols' })
    }
    // ECB publishes at most once per weekday, so a short shared cache is safe.
    res.set('Cache-Control', 'public, max-age=300')
    res.json(result)
  } catch (err) {
    next(err)
  }
}

function latestData (req, res, next) {
  return sendRates(req, res, next, null)
}

function dateData (req, res, next) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(req.params.dateParam)
  const date = match && `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  // new Date rolls 2025-02-30 over to March, so the round trip must match exactly.
  // Year 0000 is valid in JS but not in Postgres.
  const parsed = new Date(date)
  if (!date || match[1] === '0000' || isNaN(parsed) || parsed.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Invalid date' })
  }
  return sendRates(req, res, next, date)
}

module.exports = { fetchRates, latestData, dateData }
