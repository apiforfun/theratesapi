const { test, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

// The hold-back rule depends on today's date, so these tests run in a throwaway schema and
// never touch the shared rows.
const BASE_URL = process.env.DATABASE_URL
const SCHEMA = 'rates_test_' + process.pid
const isoDay = function (offset) { return new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10) }
const today = isoDay(0)
const yesterday = isoDay(-1)
const past = '2020-01-15'

let admin
let fetchRates
before(async function () {
  assert.ok(BASE_URL, 'set DATABASE_URL to the local verification database')
  admin = new Client({ connectionString: BASE_URL })
  await admin.connect()
  await admin.query('CREATE SCHEMA ' + SCHEMA)
  await admin.query('SET search_path TO ' + SCHEMA)
  await admin.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'))
  await admin.query(`INSERT INTO rates VALUES
    ($1, 'USD', 1.1, 'ecb'), ($1, 'KES', 145, 'bdi'),
    ($2, 'USD', 1.2, 'ecb'),
    ($3, 'USD', 1.3, 'ecb')`, [yesterday, today, past])
  const sep = BASE_URL.includes('?') ? '&' : '?'
  process.env.DATABASE_URL = BASE_URL + sep + 'options=' + encodeURIComponent('-c search_path=' + SCHEMA)
  fetchRates = require('../controller/api').fetchRates
})

after(async function () {
  await require('../config/db').end()
  await admin.query('DROP SCHEMA ' + SCHEMA + ' CASCADE')
  await admin.end()
})

test('latest waits for Banca d\'Italia on the current UTC day', async function () {
  const result = await fetchRates('EUR', null)
  assert.strictEqual(result.date, yesterday)
  assert.deepStrictEqual(result.rates, { KES: 145, USD: 1.1 })
})

test('a Banca d\'Italia-only base skips the unpublished day', async function () {
  const result = await fetchRates('KES', null)
  assert.strictEqual(result.date, yesterday)
})

test('latest shows the new day once Banca d\'Italia has published', async function () {
  await admin.query("INSERT INTO rates VALUES ($1, 'KES', 146, 'bdi')", [today])
  const result = await fetchRates('EUR', null)
  assert.strictEqual(result.date, today)
  assert.deepStrictEqual(result.rates, { KES: 146, USD: 1.2 })
  assert.strictEqual((await fetchRates('EUR', today)).date, today)
})

test('a past day without Banca d\'Italia rows returns the ECB currencies', async function () {
  assert.deepStrictEqual(await fetchRates('EUR', past), { date: past, base: 'EUR', rates: { USD: 1.3 } })
})

test('the docs list a currency without a known name under its code', async function () {
  await admin.query("INSERT INTO rates VALUES ($1, 'QQQ', 2, 'bdi')", [today])
  const { documentation } = require('../controller/common')
  let rendered
  await documentation({}, { render: function (view, locals) { rendered = locals } })
  assert.deepStrictEqual(rendered.currencies.find(function (c) { return c.code === 'QQQ' }), { code: 'QQQ', name: 'QQQ' })
})

test('the rate sheet shows each currency with its change and publisher', async function () {
  const { rateSheet } = require('../controller/home')
  const sheet = await rateSheet(['USD', 'KES', 'GBP'])
  assert.strictEqual(sheet.date, today)
  assert.deepStrictEqual(sheet.rows.map(function (r) { return [r.code, r.rate, r.change, r.source] }), [
    ['USD', 1.2, 9.09, 'ecb'],
    ['KES', 146, 0.69, 'bdi']
  ])
  assert.strictEqual(sheet.rows[0].name, 'US dollar')
  assert.match(sheet.rows[0].trend, /^0\.0,\d+\.\d (100\.0),\d+\.\d$/)
})

test('the source summary counts what each bank published', async function () {
  const { sourceSummary } = require('../controller/home')
  assert.deepStrictEqual(await sourceSummary(today), {
    ecb: { currencies: 1, first: past, latest: today },
    bdi: { currencies: 2, first: yesterday, latest: today },
    rates: 6,
    days: 3
  })
})
