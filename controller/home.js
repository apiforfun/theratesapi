const db = require('../config/db')
const { fetchRates } = require('./api')
const currencyNames = require('./currencies')
const { polyline } = require('./chart')

// The home page's rate sheet: a few well-known currencies plus two only Banca d'Italia publishes.
const SHEET_CODES = ['USD', 'GBP', 'JPY', 'CHF', 'CNY', 'INR', 'CAD', 'AUD', 'AED', 'NGN']
const TREND_DAYS = 30

// 50 calendar days always hold the last 30 working days.
const SERIES_SQL = `
SELECT currency, to_char(date, 'YYYY-MM-DD') AS date, rate::text AS rate, source FROM rates
WHERE currency = ANY($1) AND date <= $2 AND date > $2::date - 50
ORDER BY currency, date`

const SUMMARY_SQL = `
SELECT source, count(DISTINCT currency) FILTER (WHERE date = $1) AS currencies,
  to_char(min(date), 'YYYY-MM-DD') AS first, to_char(max(date), 'YYYY-MM-DD') AS latest,
  count(*) AS rates, count(DISTINCT date) AS days
FROM rates WHERE date <= $1 GROUP BY source`

// Rates per 1 EUR on the newest published day (the API's latest), with the change since the
// previous working day and the last 30 working days. Codes missing that day are left out.
async function rateSheet (codes = SHEET_CODES) {
  const latest = await fetchRates('EUR', null, [])
  if (!latest) return null
  const { rows } = await db.query(SERIES_SQL, [codes, latest.date])
  const sheetRows = []
  for (const code of codes) {
    const series = rows.filter(function (r) { return r.currency === code }).slice(-TREND_DAYS)
    const today = series[series.length - 1]
    if (!today || today.date !== latest.date) continue
    const rate = parseFloat(today.rate)
    const previous = series.length > 1 ? parseFloat(series[series.length - 2].rate) : null
    sheetRows.push({
      code,
      name: currencyNames[code] || code,
      rate,
      change: previous ? Math.round((rate / previous - 1) * 10000) / 100 : null,
      trend: polyline(series.map(function (r) { return parseFloat(r.rate) }), 100, 24, 2),
      source: today.source
    })
  }
  return { date: latest.date, rows: sheetRows }
}

// What each bank has published up to date: currencies that day, first and latest day, and
// totals. Scanning every row is slow, so the result is kept until the date changes.
let cached = { date: null, value: null }
async function sourceSummary (date) {
  if (cached.date === date) return cached.value
  const { rows } = await db.query(SUMMARY_SQL, [date])
  const { rows: [{ days }] } = await db.query('SELECT count(DISTINCT date) AS days FROM rates WHERE date <= $1', [date])
  const summary = { rates: 0, days: Number(days) }
  for (const row of rows) {
    summary[row.source] = { currencies: Number(row.currencies), first: row.first, latest: row.latest }
    summary.rates += Number(row.rates)
  }
  const ordered = { ecb: summary.ecb, bdi: summary.bdi, rates: summary.rates, days: summary.days }
  cached = { date, value: ordered }
  return ordered
}

// Plain text, so the same answers serve the page and the FAQ structured data.
const FAQ = [
  {
    question: 'Where do the rates come from?',
    answer: 'From two central banks. The European Central Bank publishes euro reference rates for about 30 currencies, and Banca d\'Italia publishes daily rates against the euro for about 120 more. Where both publish a currency, the ECB\'s figure is used. Rates for any other base are calculated from these and rounded to 6 decimal places.'
  },
  {
    question: 'How often are the rates updated?',
    answer: 'Once every working day. The ECB publishes around 16:00 CET and Banca d\'Italia publishes after it; a new day appears in the API once both have published. Weekends and holidays return the previous working day.'
  },
  {
    question: 'Do I need an API key?',
    answer: 'No. There is no signup and no key: send a plain HTTPS GET request and read the JSON. CORS is open, so it works from browser JavaScript too.'
  },
  {
    question: 'Can I use it in my project for free?',
    answer: 'Yes. The service is free. Please cache responses and don\'t request more often than you need. The rates are reference rates for information only, so read the terms of use before relying on them for payments.'
  },
  {
    question: 'Why is my bank\'s rate different?',
    answer: 'Banks and payment providers add a margin and quote separate buy and sell prices. These are central bank reference rates, close to the market middle rate when they were set, so they won\'t match a bank\'s rate exactly.'
  },
  {
    question: 'How far back does the history go?',
    answer: 'To 4 January 1999, the euro\'s first working day. Currencies that were later replaced, such as the Cypriot pound or the old Venezuelan bolivar, are available for the days they were published.'
  }
]

module.exports = { rateSheet, sourceSummary, SHEET_CODES, FAQ }
