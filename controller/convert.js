const currencyNames = require('./currencies')
const { currencyStatus, pairSeries, pairDay, changes, isIndexable, TOP_CURRENCIES, daysBefore } = require('./pairs')
const { lineChart } = require('./chart')
const { sig6, longDate, shortDate, changeText } = require('./format')

const PAIR = /^([a-z]{3})-to-([a-z]{3})$/i
const AMOUNTS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000]
const SOURCE_NAMES = { ecb: 'the European Central Bank', bdi: 'Banca d\'Italia' }
const SITE = 'https://theratesapi.com'

const nameOf = function (code) { return currencyNames[code] || code }
const pairPath = function (from, to) { return '/convert/' + from.toLowerCase() + '-to-' + to.toLowerCase() + '/' }

// A plain positive number up to a trillion; anything else (letters, signs, exponents, commas) is 1.
function parseAmount (value) {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return 1
  const amount = Number(value)
  return amount > 0 && amount <= 1e12 ? amount : 1
}

function direction (change) {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
}

// "Banca d'Italia and the European Central Bank" for a list of sources, each named once.
function publishedBy (sources) {
  return [...new Set(sources)].sort().map(function (s) { return SOURCE_NAMES[s] }).join(' and ')
}

// "Published by ..." for the euro's own rates, "Calculated from ..." for every other base.
function attribution (from, sources, day) {
  return (from === 'EUR' ? 'Published by ' : 'Calculated from the euro rates published by ') + publishedBy(sources) + ' on ' + longDate(day) + '.'
}

async function pairPage (req, res, next) {
  const match = PAIR.exec(req.params.pair)
  if (!match) return next()
  const lower = req.params.pair.toLowerCase()
  if (req.params.pair !== lower) {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''
    return res.redirect(301, '/convert/' + lower + '/' + query)
  }
  const from = match[1].toUpperCase()
  const to = match[2].toUpperCase()

  try {
    const status = await currencyStatus()
    const fromInfo = status.currencies.get(from)
    const toInfo = status.currencies.get(to)
    if (from === to || !fromInfo || !toInfo || !fromInfo.current || !toInfo.current) return next()
    const day = await pairDay(from, to, status.latest)
    if (!day) return next()

    const series = await pairSeries(from, to, daysBefore(day, 380), day)
    const rate = series[series.length - 1].rate
    const yearStart = daysBefore(day, 365)
    const year = series.filter(function (p) { return p.date > yearStart })
    const chart = lineChart(year)
    const change = changes(series, day)
    const amount = parseAmount(req.query.amount)

    const history = series.slice(-31).map(function (point, i, recent) {
      const previous = i > 0 ? recent[i - 1].rate : null
      const delta = previous ? Math.round((point.rate / previous - 1) * 10000) / 100 : null
      return { date: shortDate(point.date), rate: sig6(point.rate), change: changeText(delta), direction: direction(delta) }
    }).slice(1).reverse()

    const others = TOP_CURRENCIES.filter(function (code) {
      return code !== from && code !== to && status.currencies.get(code).current
    })

    res.set('Cache-Control', 'public, max-age=300')
    res.render('pages/pair.html', {
      active: 'convert',
      from,
      to,
      fromName: nameOf(from),
      toName: nameOf(to),
      rate,
      rateText: sig6(rate),
      inverseText: sig6(1 / rate),
      day,
      dayLong: longDate(day),
      // The euro has no rows of its own: only the other side's bank published anything.
      attribution: attribution(from, [[from, fromInfo], [to, toInfo]].filter(function ([code]) { return code !== 'EUR' }).map(function ([, info]) { return info.source }), day),
      amount,
      amountText: sig6(amount * rate),
      amounts: AMOUNTS.map(function (a) {
        return { amount: sig6(a), there: sig6(a * rate), back: sig6(a / rate) }
      }),
      chart: {
        ...chart,
        firstText: shortDate(chart.first),
        lastText: shortDate(chart.last),
        highText: sig6(chart.high.rate),
        highDate: shortDate(chart.high.date),
        lowText: sig6(chart.low.rate),
        lowDate: shortDate(chart.low.date)
      },
      changes: ['d30', 'd90', 'y1'].map(function (key, i) {
        return { label: ['30 days', '90 days', '1 year'][i], text: changeText(change[key]), direction: direction(change[key]) }
      }),
      history,
      inversePath: pairPath(to, from),
      related: others.map(function (code) { return { code, path: pairPath(from, code) } }),
      indexable: isIndexable(from, to),
      canonical: SITE + pairPath(from, to),
      apiLatest: SITE + '/api/latest?base=' + from + '&symbols=' + to,
      apiDate: SITE + '/api/' + day + '?base=' + from + '&symbols=' + to
    })
  } catch (err) {
    next(err)
  }
}

// The converter form. With both currencies chosen it sends you to their pair page (that is the
// no-JavaScript path; site.js shows the result in place); otherwise it shows the form.
async function converter (req, res, next) {
  const field = function (name) { return typeof req.query[name] === 'string' ? req.query[name].trim().toUpperCase() : '' }
  const from = field('from')
  const to = field('to')
  try {
    const status = await currencyStatus()
    const isCurrent = function (code) { const info = status.currencies.get(code); return Boolean(info && info.current) }
    let message = null
    if (from || to) {
      if (from !== to && isCurrent(from) && isCurrent(to)) {
        const amount = parseAmount(req.query.amount)
        return res.redirect(302, pairPath(from, to) + (amount !== 1 ? '?amount=' + amount : ''))
      }
      message = 'Choose two different currencies.'
    }
    const options = [...status.currencies].filter(function ([, info]) { return info.current })
      .map(function ([code]) { return { code, name: nameOf(code) } })
      .sort(function (a, b) { return a.code.localeCompare(b.code) })
    const popular = function (quote) {
      return TOP_CURRENCIES.filter(function (code) { return code !== quote })
        .map(function (code) { return { label: code + ' to ' + quote, path: pairPath(code, quote) } })
    }
    res.set('Cache-Control', 'public, max-age=300')
    res.render('pages/convert.html', {
      active: 'convert',
      options,
      from: isCurrent(from) ? from : 'USD',
      to: isCurrent(to) ? to : 'EUR',
      amount: parseAmount(req.query.amount),
      message,
      toUsd: popular('USD'),
      toEur: popular('EUR'),
      canonical: SITE + '/convert/'
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { pairPage, converter, pairPath, nameOf, publishedBy, SITE }
