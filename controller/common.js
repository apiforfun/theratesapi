const { fetchRates } = require('./api')
const currencyNames = require('./currencies')
const { rateSheet, sourceSummary, FAQ } = require('./home')
const { longDate, shortDate, changeText } = require('./format')

// Codes published on the latest day, EUR included, sorted.
async function latestCurrencies () {
  const all = await fetchRates('EUR', null)
  return all ? ['EUR', ...Object.keys(all.rates)].sort() : ['EUR']
}

// A code a source adds before currencies.js knows it is listed under its code.
function named (codes) {
  return codes.map(function (code) { return { code, name: currencyNames[code] || code } })
}

function sheetView (sheet) {
  return {
    date: sheet.date,
    longDate: longDate(sheet.date),
    rows: sheet.rows.map(function (row) {
      const direction = row.change > 0 ? 'up' : row.change < 0 ? 'down' : 'flat'
      return { ...row, direction, changeText: changeText(row.change) }
    })
  }
}

function summaryView (summary) {
  const view = { rates: summary.rates.toLocaleString('en-GB'), days: summary.days.toLocaleString('en-GB') }
  for (const source of ['ecb', 'bdi']) {
    const s = summary[source]
    if (s) view[source] = { currencies: s.currencies, first: shortDate(s.first), latest: shortDate(s.latest) }
  }
  return view
}

// The FAQ as schema.org data; '<' is escaped so the JSON can't close its script tag.
const FAQ_JSON = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(function (item) {
    return { '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } }
  })
}).replace(/</g, '\\u003c')

// Pages still render when the database is down; the live examples and data sections are left out.
async function index (req, res) {
  let example = null
  let codes = ['EUR']
  let sheet = null
  let summary = null
  try {
    const [result, latestCodes, latestSheet] = await Promise.all([
      fetchRates('EUR', null, ['USD', 'GBP', 'JPY']),
      latestCurrencies(),
      rateSheet()
    ])
    example = result
    codes = latestCodes
    if (latestSheet) {
      sheet = sheetView(latestSheet)
      summary = summaryView(await sourceSummary(latestSheet.date))
    }
  } catch (err) {
    console.error('Home page examples failed', err)
  }
  const currencies = codes.length > 1 ? named(codes) : []
  res.render('index.html', { active: 'home', example, codes, currencies, sheet, summary, faq: FAQ, faqJson: FAQ_JSON })
}

async function documentation (req, res) {
  let latest = null
  let historical = null
  let currencies = []
  try {
    const [latestResult, historicalResult, codes] = await Promise.all([
      fetchRates('USD', null, ['GBP', 'JPY']),
      fetchRates('USD', '2025-06-02', ['GBP']),
      latestCurrencies()
    ])
    latest = latestResult
    historical = historicalResult
    currencies = named(codes)
  } catch (err) {
    console.error('Documentation examples failed', err)
  }
  res.render('pages/documentation.html', { active: 'docs', latest, historical, currencies })
}

// Without JS the home page try-it form lands here: tidy the inputs the way site.js does and
// redirect to the matching API URL, so the chosen date and symbols are honoured.
function tryIt (req, res) {
  const field = function (name) { return typeof req.query[name] === 'string' ? req.query[name] : '' }
  const base = field('base').trim().toUpperCase()
  const symbols = field('symbols').replace(/\s+/g, '').toUpperCase()
  const params = new URLSearchParams()
  if (base && base !== 'EUR') params.set('base', base)
  if (symbols) params.set('symbols', symbols)
  const query = params.toString().replace(/%2C/gi, ',')
  res.redirect('/api/' + encodeURIComponent(field('date') || 'latest') + (query ? '?' + query : ''))
}

function privacy (req, res) {
  res.render('pages/privacy-policy.html', { active: 'privacy' })
}

function terms (req, res) {
  res.render('pages/terms-and-conditions.html', { active: 'terms' })
}

module.exports = { index, documentation, tryIt, privacy, terms }
