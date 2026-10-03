const express = require('express')
const router = express.Router()
const { latestData, dateData } = require('../controller/api')

// Public, read-only and keyless, so any site may call it from browser JavaScript.
router.use(function (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*')
  next()
})

router.get('/latest', latestData)
router.get('/:dateParam', dateData)

module.exports = router
