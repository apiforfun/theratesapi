const { test, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

// Runs in a throwaway schema; the dates are relative to today, like the hold-back tests.
const BASE_URL = process.env.DATABASE_URL
const SCHEMA = 'pairs_test_' + process.pid
const D = function (daysAgo) { return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10) }

let admin
let pairs
before(async function () {
  assert.ok(BASE_URL, 'set DATABASE_URL to the local verification database')
  admin = new Client({ connectionString: BASE_URL })
  await admin.connect()
  await admin.query('CREATE SCHEMA ' + SCHEMA)
  await admin.query('SET search_path TO ' + SCHEMA)
  await admin.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'))
  // The latest day is yesterday with ECB rows only, as after a Banca d'Italia miss at midnight UTC:
  // AED and KES stop the day before, and CYP stopped a month earlier.
  await admin.query(`INSERT INTO rates VALUES
    ($1, 'USD', 1.0, 'ecb'), ($2, 'USD', 1.1, 'ecb'), ($3, 'USD', 1.2, 'ecb'), ($4, 'USD', 1.25, 'ecb'),
    ($3, 'AED', 4.0, 'bdi'), ($3, 'KES', 145, 'bdi'), ($5, 'CYP', 0.58, 'ecb')`,
  [D(401), D(41), D(2), D(1), D(31)])
  const sep = BASE_URL.includes('?') ? '&' : '?'
  process.env.DATABASE_URL = BASE_URL + sep + 'options=' + encodeURIComponent('-c search_path=' + SCHEMA)
  pairs = require('../controller/pairs')
})

after(async function () {
  await require('../config/db').end()
  await admin.query('DROP SCHEMA ' + SCHEMA + ' CASCADE')
  await admin.end()
})

test('a pair uses the newest day both currencies were published', async function () {
  assert.strictEqual(await pairs.pairDay('USD', 'AED', D(1)), D(2))
  assert.strictEqual(await pairs.pairDay('EUR', 'USD', D(1)), D(1))
})

test('pair series are unrounded and treat the euro as 1', async function () {
  assert.deepStrictEqual(await pairs.pairSeries('USD', 'AED', D(10), D(1)), [{ date: D(2), rate: 4.0 / 1.2 }])
  const eurUsd = await pairs.pairSeries('EUR', 'USD', D(500), D(1))
  assert.strictEqual(eurUsd.length, 4)
  assert.strictEqual((await pairs.pairSeries('USD', 'EUR', D(500), D(1)))[0].rate, 1 / 1.0)
})

test('currency status separates current currencies from ones no longer published', async function () {
  const status = await pairs.currencyStatus()
  assert.strictEqual(status.latest, D(1))
  for (const code of ['USD', 'AED', 'KES', 'EUR']) assert.strictEqual(status.currencies.get(code).current, true, code)
  assert.deepStrictEqual(status.currencies.get('CYP'), { first: D(31), last: D(31), source: 'ecb', current: false })
  assert.strictEqual(status.currencies.get('AED').source, 'bdi')
})

test('changes compare with the last day on or before 30, 90 and 365 days earlier', async function () {
  const series = await pairs.pairSeries('EUR', 'USD', D(500), D(1))
  const pct = function (now, then) { return Math.round((now / then - 1) * 10000) / 100 }
  assert.deepStrictEqual(pairs.changes(series, D(1)), { d30: pct(1.25, 1.1), d90: pct(1.25, 1.0), y1: pct(1.25, 1.0) })
})

test('a pair is indexable when either side is a top-30 currency', function () {
  assert.strictEqual(pairs.TOP_CURRENCIES.length, 30)
  assert.strictEqual(pairs.isIndexable('KES', 'USD'), true)
  assert.strictEqual(pairs.isIndexable('KES', 'UGX'), false)
})

test('where a currency is used reads as plain names', function () {
  const { usedIn } = require('../controller/countries')
  assert.strictEqual(usedIn('INR'), 'India')
  assert.strictEqual(usedIn('EUR'), 'the euro area')
  assert.strictEqual(usedIn('XDR'), 'International Monetary Fund')
  assert.strictEqual(usedIn('AED'), 'United Arab Emirates')
  assert.match(usedIn('XOF'), /Senegal/)
  assert.strictEqual(usedIn('CYP'), null)
})
