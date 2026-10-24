const express = require('express')
const { index, documentation, tryIt, privacy, terms, llmsText } = require('../controller/common')
const { pairPage, converter } = require('../controller/convert')
const { currencyPage, currencyIndex } = require('../controller/currency-pages')
const { sitemap } = require('../controller/sitemap')
const { SITE } = require('../config/site')

// Strict, so each page has one address: the one ending in a slash. Anything else falls to the 404 handler.
const router = express.Router({ strict: true })

// A page's canonical address is the one it was served from, without the query. The 404 handler clears it.
router.use(function (req, res, next) {
  res.locals.canonical = SITE + req.path
  next()
})

// Without its trailing slash, a page redirects to it, keeping the query.
function addSlash (req, res) {
  const url = req.originalUrl
  const q = url.indexOf('?')
  res.redirect(301, q < 0 ? url + '/' : url.slice(0, q) + '/' + url.slice(q))
}

router.get('/', index)
router.get('/documentation/', documentation)
router.get('/try', tryIt)
router.get('/privacy-policy/', privacy)
router.get('/terms-and-conditions/', terms)
router.get('/convert/', converter)
router.get('/convert/:pair/', pairPage)
router.get('/currencies/', currencyIndex)
router.get('/currencies/:code/', currencyPage)
router.get(['/documentation', '/privacy-policy', '/terms-and-conditions', '/convert', '/convert/:pair', '/currencies', '/currencies/:code'], addSlash)
router.get('/sitemap.xml', sitemap)
router.get('/llms.txt', llmsText)

module.exports = router
