// Number and date formatting shared by the pages. Rates and amounts use en-GB grouping.

const SIG6 = new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 6 })
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// At most 6 significant digits and never exponent form, so tiny cross-rates keep their movement.
function sig6 (value) {
  return SIG6.format(value)
}

function longDate (iso) {
  return LONG_DATE.format(new Date(iso))
}

function shortDate (iso) {
  return SHORT_DATE.format(new Date(iso))
}

// "+0.21%" or "−0.15%", with a real minus sign; empty when there is nothing to compare with.
function changeText (change) {
  if (change === null) return ''
  return (change > 0 ? '+' : change < 0 ? '−' : '') + Math.abs(change).toFixed(2) + '%'
}

module.exports = { sig6, longDate, shortDate, changeText }
