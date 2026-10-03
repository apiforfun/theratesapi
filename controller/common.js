const { fetchRates } = require('./api')
const currencyNames = require('./currencies')

// Codes published on the latest day, EUR included, sorted.
async function latestCurrencies () {
  const all = await fetchRates('EUR', null)
  return all ? ['EUR', ...Object.keys(all.rates)].sort() : ['EUR']
}

// Pages still render when the database is down; the live examples are simply left out.
async function index (req, res) {
  let example = null
  let currencies = ['EUR']
  try {
    const [result, codes] = await Promise.all([
      fetchRates('EUR', null, ['USD', 'GBP', 'JPY']),
      latestCurrencies()
    ])
    example = result
    currencies = codes
  } catch (err) {
    console.error('Home page examples failed', err)
  }
  res.render('index.html', { active: 'home', example, currencies })
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
    currencies = codes.map(function (code) { return { code, name: currencyNames[code] } })
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
