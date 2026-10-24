const express = require('express')
const router = express.Router()
const { index, documentation, tryIt, privacy, terms } = require('../controller/common')
const { pairPage, converter } = require('../controller/convert')
const { currencyPage, currencyIndex } = require('../controller/currency-pages')
const { sitemap } = require('../controller/sitemap')

// Express matches these with or without a trailing slash. Anything else falls to the 404 handler.
router.get('/', index)
router.get('/documentation', documentation)
router.get('/try', tryIt)
router.get('/privacy-policy', privacy)
router.get('/terms-and-conditions', terms)
router.get('/convert', converter)
router.get('/convert/:pair', pairPage)
router.get('/currencies', currencyIndex)
router.get('/currencies/:code', currencyPage)
router.get('/sitemap.xml', sitemap)

module.exports = router
