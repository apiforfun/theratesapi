// SVG line charts drawn on the server, so pages need no chart library.

const CHART_WIDTH = 640
const CHART_HEIGHT = 200
const CHART_PAD = 12
const CHART_X_PAD = 8 // keeps the high and low markers clear of the edges

function scaleY (value, min, max, height, pad) {
  return max === min ? height / 2 : height - pad - ((value - min) / (max - min)) * (height - 2 * pad)
}

function scaleX (i, count, width, xPad) {
  return count > 1 ? xPad + (i * (width - 2 * xPad)) / (count - 1) : xPad
}

// Points "x,y x,y" for a box of width x height, oldest value on the left; a flat series sits
// in the middle. pad keeps the line off the top and bottom edges, xPad off the sides. bounds
// sets the vertical range, which otherwise runs from the lowest value to the highest.
function polyline (values, width, height, pad, xPad = 0, bounds = null) {
  const min = bounds ? bounds.min : Math.min(...values)
  const max = bounds ? bounds.max : Math.max(...values)
  return values.map(function (v, i) {
    return scaleX(i, values.length, width, xPad).toFixed(1) + ',' + scaleY(v, min, max, height, pad).toFixed(1)
  }).join(' ')
}

// The vertical range covers at least 1% of the level, so a pegged pair that moves by 0.002% is
// drawn as the near-flat line it is rather than stretched edge to edge.
const MIN_SPAN = 0.01

// A daily series ({ date, rate }, ascending) as a 640 x 200 chart with its high and low marked.
function lineChart (series) {
  const values = series.map(function (p) { return p.rate })
  const high = Math.max(...values)
  const low = Math.min(...values)
  const mid = (high + low) / 2
  const half = Math.max(high - low, Math.abs(mid) * MIN_SPAN) / 2
  const bounds = { min: mid - half, max: mid + half }
  const at = function (i) {
    const x = scaleX(i, series.length, CHART_WIDTH, CHART_X_PAD)
    return { date: series[i].date, rate: series[i].rate, x, y: scaleY(series[i].rate, bounds.min, bounds.max, CHART_HEIGHT, CHART_PAD) }
  }
  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    points: polyline(values, CHART_WIDTH, CHART_HEIGHT, CHART_PAD, CHART_X_PAD, bounds),
    high: at(values.indexOf(high)),
    low: at(values.indexOf(low)),
    first: series[0].date,
    last: series[series.length - 1].date
  }
}

module.exports = { polyline, lineChart }
