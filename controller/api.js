const mongoose = require('mongoose')

async function latestData(req, res, next) {
  const db = mongoose.connection.db
  const collection = db.collection('currency')
  let fields = { base: 1, date: 1, _id: 0, rates: 1 }
  let query = { base: 'EUR' }

  if (req.query.base) {
    query = { base: req.query.base.toUpperCase() }
  }
  if (req.query.symbols) {
    fields = { base: 1, date: 1, _id: 0 }
    const symbols = req.query.symbols.split(',')
    for (const symbol of symbols) {
      fields['rates.' + symbol.toUpperCase()] = 1
    }
  }

  try {
    const result = await collection.find(query, { projection: fields }).sort({ date: -1 }).limit(1).toArray()
    if (result[0]) {
      const keys = Object.keys(result[0].rates)
      for (const key of keys) {
        result[0].rates[key] = parseFloat(result[0].rates[key])
      }
      res.json(result[0])
    } else {
      res.status(400).json({ error: 'Invalid base or symbols' })
    }
  } catch (err) {
    next(err)
  }
}

async function dateData(req, res, next) {
  let dateParam = req.params.dateParam
  const parts = dateParam.split('-')
  if (parts[1].length === 1) parts[1] = '0' + parts[1]
  if (parts[2].length === 1) parts[2] = '0' + parts[2]
  dateParam = parts.join('-')

  const db = mongoose.connection.db
  const collection = db.collection('currency')
  let fields = { base: 1, date: 1, _id: 0, rates: 1 }
  let query = { base: 'EUR', date: { $lte: dateParam } }

  if (req.query.base) {
    query.base = req.query.base.toUpperCase()
  }
  if (req.query.symbols) {
    fields = { base: 1, date: 1, _id: 0 }
    const symbols = req.query.symbols.split(',')
    for (const symbol of symbols) {
      fields['rates.' + symbol.toUpperCase()] = 1
    }
  }

  try {
    const result = await collection.find(query, { projection: fields }).sort({ date: -1 }).limit(1).toArray()
    if (result[0]) {
      const keys = Object.keys(result[0].rates)
      for (const key of keys) {
        result[0].rates[key] = parseFloat(result[0].rates[key])
      }
      res.json(result[0])
    } else {
      res.status(400).json({ error: 'Invalid base or symbols' })
    }
  } catch (err) {
    next(err)
  }
}

module.exports = { latestData, dateData }
