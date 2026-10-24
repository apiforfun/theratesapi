const { test } = require('node:test')
const assert = require('node:assert')
const { sig6 } = require('../controller/format')
const { polyline, lineChart } = require('../controller/chart')

test('sig6 shows at most 6 significant digits, grouped, never in exponent form', function () {
  assert.strictEqual(sig6(88.437612), '88.4376')
  assert.strictEqual(sig6(0.0000119734), '0.0000119734')
  assert.strictEqual(sig6(884376.12), '884,376')
  assert.strictEqual(sig6(1), '1')
  assert.strictEqual(sig6(1504.78694), '1,504.79')
})

test('polyline maps values into the box, oldest on the left', function () {
  assert.strictEqual(polyline([1, 2, 3], 100, 24, 2), '0.0,22.0 50.0,12.0 100.0,2.0')
  assert.strictEqual(polyline([5, 5], 100, 24, 2), '0.0,12.0 100.0,12.0')
})

test('lineChart marks the high, the low and the date range', function () {
  const chart = lineChart([
    { date: '2026-01-01', rate: 2 },
    { date: '2026-01-02', rate: 1 },
    { date: '2026-01-03', rate: 3 }
  ])
  assert.strictEqual(chart.width, 640)
  assert.strictEqual(chart.height, 200)
  assert.strictEqual(chart.high.date, '2026-01-03')
  assert.strictEqual(chart.high.rate, 3)
  assert.strictEqual(chart.low.date, '2026-01-02')
  assert.strictEqual(chart.first, '2026-01-01')
  assert.strictEqual(chart.last, '2026-01-03')
  assert.ok(chart.high.x > 600 && chart.high.x <= 632, 'markers stay clear of the right edge')
  assert.ok(chart.points.startsWith('8.0,'), 'and of the left edge')
  assert.strictEqual(chart.points.split(' ').length, 3)
})

test('a nearly flat series is not stretched into big swings', function () {
  const rates = [3.67246, 3.67254, 3.67248, 3.67252, 3.6725]
  const chart = lineChart(rates.map(function (rate, i) { return { date: '2026-01-0' + (i + 1), rate } }))
  const ys = chart.points.split(' ').map(function (p) { return Number(p.split(',')[1]) })
  assert.ok(Math.max(...ys) - Math.min(...ys) < 10, 'a 0.002% move spans ' + (Math.max(...ys) - Math.min(...ys)) + ' of 200')
})
