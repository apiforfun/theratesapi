const { currencyStatus, TOP_CURRENCIES } = require('./pairs')
const { pairPath } = require('./convert')
const { SITE } = require('../config/site')

// The pages worth finding: the main ones, every currency page, and every pair among the top 30.
// Other pairs work and are linked, but are left out so the list stays focused.
async function sitemap (req, res, next) {
  try {
    const status = await currencyStatus()
    const latest = status.latest
    const urls = ['/', '/documentation/', '/convert/', '/currencies/'].map(function (path) { return [path, latest] })
    for (const [code, info] of [...status.currencies].sort()) {
      urls.push(['/currencies/' + code.toLowerCase() + '/', info.last])
    }
    for (const from of TOP_CURRENCIES) {
      for (const to of TOP_CURRENCIES) if (from !== to) urls.push([pairPath(from, to), latest])
    }
    const body = urls.map(function ([path, lastmod]) {
      return '  <url><loc>' + SITE + path + '</loc><lastmod>' + lastmod + '</lastmod></url>'
    }).join('\n')
    res.set('Content-Type', 'application/xml; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n')
  } catch (err) {
    next(err)
  }
}

module.exports = { sitemap }
