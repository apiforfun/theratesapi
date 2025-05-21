const MongoClient = require('mongodb').MongoClient
const { ApiToken, Code, User } = require('./../models/User')
const db = require('../config/keys').MongoURI

async function latestData(req, res, next) {
  MongoClient.connect(db, { useUnifiedTopology: true }, async function (err, dbo) {
    const db = dbo.db('theratesapi')
    const collection = db.collection('currency')
    fields = { base: 1, date: 1, _id: 0, rates: 1 }
    query = { base: 'EUR' }

    if (req.query.base) {
      query = { base: req.query.base.toUpperCase() }
    }
    if (req.query.symbols) {
      fields = { base: 1, date: 1, _id: 0 }
      symbols = req.query.symbols.split(',')
      for (each in symbols) {
        symbol = 'rates.' + symbols[each].toUpperCase()
        fields[symbol] = 1
      }
    }
    const cursor = await collection.find(query, { fields: fields }).sort({ date: -1 }).limit(1).toArray(function (err, result) {
      if (err) throw err
      dbo.close()
      if (result[0]) {
        currency_keys = Object.keys(result[0]['rates'])
        for (let key of currency_keys) {
          result[0]['rates'][key] = parseFloat(result[0]['rates'][key])
        }
        res.writeHead(200, { 'Content-Type': 'text/json' })
        res.write(JSON.stringify(result[0]))
      } else {
        res.writeHead(400, { 'Content-Type': 'text/json' })
        res.write(JSON.stringify({ error: 'Invalid base or symbols' }))
      }
      res.end()
    })
  })
}

async function dateData(req, res, next) {
  dateParam = req.params.dateParam
  dateParmsSplit = dateParam.split('-')
  if(dateParmsSplit[1].length === 1) {
    dateParmsSplit[1] = '0'+dateParmsSplit[1]
  } 
  if(dateParmsSplit[2].length === 1) {
    dateParmsSplit[2] = '0'+dateParmsSplit[2]
  }
  dateParam = dateParmsSplit.join("-")
  MongoClient.connect(db, async function (err, dbo) {
    const db = dbo.db('theratesapi')
    const collection = db.collection('currency')
    fields = { base: 1, date: 1, _id: 0, rates: 1 }
    query = { base: 'EUR', 'date': { $lte: dateParam } }
    if (req.query.base) {
      query.base = req.query.base.toUpperCase()
    }
    if (req.query.symbols) {
      fields = { base: 1, date: 1, _id: 0 }
      symbols = req.query.symbols.split(',')
      for (each in symbols) {
        symbol = 'rates.' + symbols[each].toUpperCase()
        fields[symbol] = 1
      }
    }
    const cursor = await collection.find(query, { fields: fields }).sort({ date: -1 }).toArray(async function (err, result) {
      if (err) {
        throw err
      }
      if (result[0]) {
        currency_keys = Object.keys(result[0]['rates'])
        for (let key of currency_keys) {
          result[0]['rates'][key] = parseFloat(result[0]['rates'][key])
        }
        res.writeHead(200, { 'Content-Type': 'text/json' })
        res.write(JSON.stringify(result[0]))
      } else {
        res.writeHead(400, { 'Content-Type': 'text/json' })
        res.write(JSON.stringify({ error: 'Invalid base or symbols' }))
      }
      res.end()
    })
  })

}



module.exports = { latestData, dateData }
