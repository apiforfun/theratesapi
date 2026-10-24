const { test } = require('node:test')
const assert = require('node:assert')
const { Client } = require('pg')
const currencyNames = require('../controller/currencies')

test('every currency in rates has a name', async function () {
  assert.ok(process.env.DATABASE_URL, 'set DATABASE_URL to the local verification database')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query('SELECT DISTINCT currency FROM rates')
    const codes = ['EUR', ...rows.map(function (row) { return row.currency })]
    const missing = codes.filter(function (code) {
      return typeof currencyNames[code] !== 'string' || currencyNames[code] === ''
    })
    assert.deepStrictEqual(missing.sort(), [], 'no name for ' + missing.join(' '))
  } finally {
    await client.end()
  }
})
