const express = require('express')
const router = express.Router()
const { index, documentation, tryIt, privacy, terms } = require('../controller/common')

// Express matches these with or without a trailing slash. Anything else falls to the 404 handler.
router.get('/', index)
router.get('/documentation', documentation)
router.get('/try', tryIt)
router.get('/privacy-policy', privacy)
router.get('/terms-and-conditions', terms)

module.exports = router
