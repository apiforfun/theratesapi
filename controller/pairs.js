const db = require('../config/db')
const { fetchRates } = require('./api')

// The currencies people search for most, by search interest and remittance volume. Pairs among
// them go in the sitemap; a pair with at least one of them is worth indexing.
const TOP_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'AED', 'CAD', 'AUD', 'JPY', 'CNY', 'SAR',
  'PKR', 'PHP', 'NGN', 'MXN', 'BRL', 'CHF', 'SGD', 'MYR', 'ZAR', 'TRY',
  'KRW', 'BDT', 'EGP', 'KWD', 'QAR', 'NZD', 'HKD', 'THB', 'IDR', 'VND'
]
const TOP = new Set(TOP_CURRENCIES)

// Published within this many days of the latest day counts as current. It covers holidays,
// XDR's gaps, and Banca d'Italia's currencies while the newest day shows the ECB's alone.
const CURRENT_DAYS = 14

function daysBefore (iso, days) {
  return new Date(Date.parse(iso) - days * 864e5).toISOString().slice(0, 10)
}

function isIndexable (base, quote) {
  return TOP.has(base) || TOP.has(quote)
}

// Per-EUR rates of $1 and $2 on the days both were published between $3 and $4. EUR has no
// rows: it is 1 on every day that has any. Rates come back as text so nothing is rounded.
const SERIES_SQL = `
WITH b AS (
  SELECT date, rate FROM rates WHERE currency = $1::bpchar AND date BETWEEN $3 AND $4
  UNION ALL
  SELECT DISTINCT date, 1 FROM rates WHERE $1::text = 'EUR' AND date BETWEEN $3 AND $4
), q AS (
  SELECT date, rate FROM rates WHERE currency = $2::bpchar AND date BETWEEN $3 AND $4
  UNION ALL
  SELECT DISTINCT date, 1 FROM rates WHERE $2::text = 'EUR' AND date BETWEEN $3 AND $4
)
SELECT to_char(date, 'YYYY-MM-DD') AS date, b.rate::text AS base, q.rate::text AS quote
FROM b JOIN q USING (date) ORDER BY date`

// Units of quote per 1 base on each shared day from..to (ISO dates), oldest first, unrounded.
async function pairSeries (base, quote, from, to) {
  const { rows } = await db.query(SERIES_SQL, [base, quote, from, to])
  return rows.map(function (r) { return { date: r.date, rate: parseFloat(r.quote) / parseFloat(r.base) } })
}

// The newest day on or before latest on which both were published, or null.
async function pairDay (base, quote, latest) {
  const series = await pairSeries(base, quote, daysBefore(latest, 60), latest)
  return series.length ? series[series.length - 1].date : null
}

// Percent change, to 2 decimals, from the last point on or before day minus 30, 90 and 365 days
// to the series' last point.
function changes (series, day) {
  const now = series[series.length - 1]
  const since = function (days) {
    const cutoff = daysBefore(day, days)
    let then = null
    for (const point of series) if (point.date <= cutoff) then = point
    return then ? Math.round((now.rate / then.rate - 1) * 10000) / 100 : null
  }
  return { d30: since(30), d90: since(90), y1: since(365) }
}

const STATUS_SQL = `
WITH span AS (SELECT currency, min(date) AS first, max(date) AS last FROM rates WHERE date <= $1 GROUP BY currency)
SELECT s.currency, to_char(s.first, 'YYYY-MM-DD') AS first, to_char(s.last, 'YYYY-MM-DD') AS last, r.source
FROM span s JOIN rates r ON r.currency = s.currency AND r.date = s.last`

// Every code with its first and last day, the source of its newest row, and whether it is
// current. Scanning every row is slow, so the result is kept until the latest day changes.
let cached = { latest: undefined, value: null }
async function currencyStatus () {
  const newest = await fetchRates('EUR', null, [])
  const latest = newest ? newest.date : null
  if (cached.latest === latest) return cached.value
  const currencies = new Map()
  if (latest) {
    const cutoff = daysBefore(latest, CURRENT_DAYS)
    const { rows } = await db.query(STATUS_SQL, [latest])
    let first = latest
    for (const row of rows) {
      currencies.set(row.currency, { first: row.first, last: row.last, source: row.source, current: row.last >= cutoff })
      if (row.first < first) first = row.first
    }
    currencies.set('EUR', { first, last: latest, source: 'ecb', current: true })
  }
  cached = { latest, value: { latest, currencies } }
  return cached.value
}

module.exports = { TOP_CURRENCIES, isIndexable, pairSeries, pairDay, changes, currencyStatus, daysBefore }
