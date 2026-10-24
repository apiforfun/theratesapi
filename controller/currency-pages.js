const { fetchRates } = require('./api')
const { currencyStatus, pairSeries, TOP_CURRENCIES, daysBefore } = require('./pairs')
const { usedIn } = require('./countries')
const { lineChart } = require('./chart')
const { sig6, longDate, shortDate } = require('./format')
const { pairPath, nameOf, publishedBy, SITE } = require('./convert')

const PUBLISHERS = { ecb: 'the European Central Bank', bdi: 'Banca d\'Italia' }
const PUBLISHER_NAMES = { ecb: 'European Central Bank', bdi: 'Banca d\'Italia' }
const CODE = /^[a-z]{3}$/i

// The chart shows the currency against the US dollar; the dollar and the euro against each other.
function chartPair (code) {
  return code === 'USD' || code === 'EUR' ? ['EUR', 'USD'] : ['USD', code]
}

async function currencyPage (req, res, next) {
  if (!CODE.test(req.params.code)) return next()
  const lower = req.params.code.toLowerCase()
  if (req.params.code !== lower) return res.redirect(301, '/currencies/' + lower + '/')
  const code = lower.toUpperCase()

  try {
    const status = await currencyStatus()
    const info = status.currencies.get(code)
    if (!info) return next()
    const day = info.last
    const published = await fetchRates('EUR', day)
    const perEur = { ...published.rates, EUR: 1 }
    const own = perEur[code]
    const linkable = function (other) { return info.current && status.currencies.get(other).current }

    const rows = TOP_CURRENCIES.filter(function (other) { return other !== code && perEur[other] }).map(function (other) {
      return {
        code: other,
        name: nameOf(other),
        to: sig6(perEur[other] / own),
        from: sig6(own / perEur[other]),
        toPath: linkable(other) ? pairPath(code, other) : null,
        fromPath: linkable(other) ? pairPath(other, code) : null
      }
    })

    // Every euro rate on the page, the currency's own and each row's, comes from one of the banks.
    const rowSources = [code, ...rows.map(function (r) { return r.code })]
      .filter(function (c) { return c !== 'EUR' })
      .map(function (c) { return status.currencies.get(c).source })
    const titleFigure = code === 'EUR'
      ? '1 EUR = ' + sig6(perEur.USD) + ' USD'
      : code === 'USD' ? '1 USD = ' + sig6(1 / own) + ' EUR' : '1 ' + code + ' = ' + sig6(perEur.USD / own) + ' USD'

    const [chartBase, chartQuote] = chartPair(code)
    const series = await pairSeries(chartBase, chartQuote, daysBefore(day, 365), day)
    const chart = series.length > 1 ? lineChart(series) : null

    res.set('Cache-Control', 'public, max-age=300')
    res.render('pages/currency.html', {
      active: 'currencies',
      code,
      name: nameOf(code),
      usedIn: usedIn(code),
      publisher: PUBLISHERS[info.source],
      publisherName: PUBLISHER_NAMES[info.source],
      current: info.current,
      first: shortDate(info.first),
      last: shortDate(info.last),
      dayLong: longDate(day),
      calculatedFrom: publishedBy(rowSources),
      titleFigure,
      inEur: sig6(1 / own),
      inUsd: perEur.USD ? sig6(perEur.USD / own) : null,
      rows,
      chart: chart && {
        ...chart,
        firstText: shortDate(chart.first),
        lastText: shortDate(chart.last),
        highText: sig6(chart.high.rate),
        highDate: shortDate(chart.high.date),
        lowText: sig6(chart.low.rate),
        lowDate: shortDate(chart.low.date)
      },
      chartBase,
      chartQuote,
      canonical: SITE + '/currencies/' + lower + '/',
      apiLatest: SITE + '/api/latest?base=' + code,
      apiDate: SITE + '/api/' + day + '?base=' + code + '&symbols=' + (code === 'USD' ? 'EUR,GBP' : 'USD,EUR')
    })
  } catch (err) {
    next(err)
  }
}

async function currencyIndex (req, res, next) {
  try {
    const status = await currencyStatus()
    const latest = await fetchRates('EUR', null)
    const perEur = latest ? { ...latest.rates, EUR: 1 } : {}
    const current = []
    const stopped = []
    for (const [code, info] of status.currencies) {
      const row = { code, path: '/currencies/' + code.toLowerCase() + '/', name: nameOf(code), first: shortDate(info.first), last: shortDate(info.last) }
      if (info.current) {
        current.push({ ...row, usedIn: usedIn(code), publisher: PUBLISHER_NAMES[info.source], rate: perEur[code] ? sig6(perEur[code]) : null })
      } else {
        stopped.push(row)
      }
    }
    const byCode = function (a, b) { return a.code.localeCompare(b.code) }
    res.set('Cache-Control', 'public, max-age=300')
    res.render('pages/currencies.html', {
      active: 'currencies',
      current: current.sort(byCode),
      stopped: stopped.sort(byCode),
      dayLong: latest ? longDate(latest.date) : null,
      canonical: SITE + '/currencies/'
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { currencyPage, currencyIndex }
