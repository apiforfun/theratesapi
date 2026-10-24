const { test, before, after } = require('node:test')
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const LIVE = 9081 // server with the verification database
const DOWN = 9082 // server whose database refuses connections
const STALL = 9083 // server whose database host never answers

// Starts server.js on port with the given DATABASE_URL; resolves once it is listening.
function startServer (port, databaseUrl) {
  return new Promise(function (resolve, reject) {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), DATABASE_URL: databaseUrl, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stdout.on('data', function (chunk) {
      if (chunk.toString().includes('listening')) resolve(child)
    })
    child.on('error', reject)
    child.on('exit', function (code) { reject(new Error('server exited with ' + code)) })
  })
}

async function get (port, urlPath) {
  const res = await fetch('http://127.0.0.1:' + port + urlPath)
  return { res, html: await res.text() }
}

const servers = []
before(async function () {
  assert.ok(process.env.DATABASE_URL, 'set DATABASE_URL to the local verification database')
  servers.push(await startServer(LIVE, process.env.DATABASE_URL))
  servers.push(await startServer(DOWN, 'postgresql://postgres:pg@127.0.0.1:1/none'))
  servers.push(await startServer(STALL, 'postgresql://postgres:pg@192.0.2.1:5432/none'))
})
after(function () {
  for (const server of servers) server.kill()
})

test('home renders the live example', async function () {
  const { res, html } = await get(LIVE, '/')
  assert.strictEqual(res.status, 200)
  assert.match(html, /<span class="j-key">"rates"<\/span>/)
})

test('content pages render with or without a trailing slash', async function () {
  for (const urlPath of ['/documentation/', '/documentation', '/privacy-policy/', '/terms-and-conditions/']) {
    const { res } = await get(LIVE, urlPath)
    assert.strictEqual(res.status, 200, urlPath)
  }
})

test('unknown and traversal paths return the 404 page', async function () {
  for (const urlPath of ['/nope', '/base', '/..%2Findex', '/pages%2Fbase']) {
    const { res, html } = await get(LIVE, urlPath)
    assert.strictEqual(res.status, 404, urlPath)
    assert.match(html, /Page not found/, urlPath)
  }
})

test('API allows any origin on success and error', async function () {
  const ok = await fetch('http://127.0.0.1:' + LIVE + '/api/latest')
  assert.strictEqual(ok.status, 200)
  assert.strictEqual(ok.headers.get('access-control-allow-origin'), '*')
  const bad = await fetch('http://127.0.0.1:' + LIVE + '/api/latest?base=XYZ')
  assert.strictEqual(bad.status, 400)
  assert.strictEqual(bad.headers.get('access-control-allow-origin'), '*')
  assert.deepStrictEqual(await bad.json(), { error: 'Invalid base or symbols' })
})

test('API JSON keeps its shape and filters symbols', async function () {
  const res = await fetch('http://127.0.0.1:' + LIVE + '/api/latest?base=usd&symbols=gbp,xyz')
  const body = await res.json()
  assert.deepStrictEqual(Object.keys(body), ['date', 'base', 'rates'])
  assert.strictEqual(body.base, 'USD')
  assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.deepStrictEqual(Object.keys(body.rates), ['GBP'])
})

test('pages render without the database', async function () {
  for (const urlPath of ['/', '/documentation/']) {
    const { res } = await get(DOWN, urlPath)
    assert.strictEqual(res.status, 200, urlPath)
  }
  const { res } = await get(DOWN, '/api/latest')
  assert.strictEqual(res.status, 500)
})

test('legal pages are the plain-language versions', async function () {
  for (const [urlPath, heading] of [['/privacy-policy/', 'Privacy policy'], ['/terms-and-conditions/', 'Terms of use']]) {
    const { html } = await get(LIVE, urlPath)
    assert.match(html, new RegExp('<h1>' + heading + '</h1>'), urlPath)
    assert.match(html, /Last updated 24 October 2026/, urlPath)
    assert.doesNotMatch(html, /DEVELOPER NAME|Mastercard/, urlPath)
  }
})

test('privacy policy discloses Google Analytics and its cookies', async function () {
  const { html } = await get(LIVE, '/privacy-policy/')
  assert.match(html, /Google Analytics/)
  assert.match(html, /cookies/)
  assert.doesNotMatch(html, /sets no cookies|no analytics|has no analytics/)
})

test('every page loads the Google tag', async function () {
  for (const urlPath of ['/', '/documentation/', '/privacy-policy/', '/terms-and-conditions/', '/nope', '/convert/', '/convert/usd-to-inr/', '/currencies/inr/', '/currencies/']) {
    const { html } = await get(LIVE, urlPath)
    assert.match(html, /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-BGQKLYTT79"><\/script>/, urlPath)
    assert.match(html, /gtag\('config', 'G-BGQKLYTT79'\)/, urlPath)
  }
})

test('no page loads third-party scripts, styles or fonts other than the Google tag', async function () {
  for (const urlPath of ['/', '/documentation/', '/privacy-policy/', '/terms-and-conditions/', '/nope', '/convert/usd-to-inr/', '/currencies/inr/', '/currencies/']) {
    const { html } = await get(LIVE, urlPath)
    // A canonical link names our own address; it loads nothing.
    assert.doesNotMatch(html, /<(script|link)\b(?![^>]*rel="canonical")(?![^>]*src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?)[^>]*\b(src|href)="(https?:)?\/\//, urlPath)
  }
})

test('shared layout has the menu button, nav and footer links', async function () {
  const { html } = await get(LIVE, '/privacy-policy/')
  assert.match(html, /<html lang="en">/)
  assert.match(html, /class="menu-toggle"[^>]*aria-controls="site-nav"/)
  assert.match(html, /href="https:\/\/github.com\/apiforfun\/theratesapi\/issues"/)
  assert.match(html, /<title>Privacy policy \| The Rates API<\/title>/)
})

test('footer credits both sources', async function () {
  const { html } = await get(LIVE, '/')
  const footer = html.slice(html.lastIndexOf('<footer'))
  assert.match(footer, /href="https:\/\/www\.ecb\.europa\.eu\//)
  assert.match(footer, /href="https:\/\/tassidicambio\.bancaditalia\.it\/"/)
})

test('home page has the try-it form, facts and code tabs', async function () {
  const { html } = await get(LIVE, '/')
  assert.match(html, /<form class="try" action="\/try" method="get" data-try>/)
  assert.match(html, /<option value="EUR" selected>EUR<\/option>/)
  assert.match(html, /<option value="USD">USD<\/option>/)
  assert.match(html, /role="tabpanel"/)
  assert.doesNotMatch(html, /role="tabpanel"[^>]*\bhidden\b/)
  assert.doesNotMatch(html, /Requests in last 7 days|Response Rate|Dialy/)
})

test('home shows the latest rate sheet with its publishers', async function () {
  const { html } = await get(LIVE, '/')
  const latest = await (await fetch('http://127.0.0.1:' + LIVE + '/api/latest?symbols=USD,AED')).json()
  const sheet = html.slice(html.indexOf('<table class="sheet"'), html.indexOf('</table>'))
  assert.match(sheet, new RegExp('<time datetime="' + latest.date + '">'))
  assert.match(sheet, new RegExp('USD</span>[\\s\\S]*?<td class="num">' + String(latest.rates.USD).replace('.', '\\.') + '</td>'))
  assert.match(sheet, new RegExp('AED</span>[\\s\\S]*?<td class="num">' + String(latest.rates.AED).replace('.', '\\.') + '</td>'))
  assert.match(sheet, /<abbr title="European Central Bank">ECB<\/abbr>/)
  assert.match(sheet, /<abbr title="Banca d'Italia">BdI<\/abbr>/)
})

test('home counts currencies and names both sources from the data', async function () {
  const { html } = await get(LIVE, '/')
  const latest = await (await fetch('http://127.0.0.1:' + LIVE + '/api/latest')).json()
  const count = Object.keys(latest.rates).length + 1
  assert.match(html, new RegExp('reference rates for ' + count + ' currencies'))
  assert.match(html, /<h2[^>]*>Where every number comes from<\/h2>/)
  assert.match(html, /id="currencies"/)
  assert.strictEqual((html.match(/<li class="currency">/g) || []).length, count)
})

test('home answers common questions, also as structured data', async function () {
  const { html } = await get(LIVE, '/')
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  assert.ok(json, 'FAQ structured data')
  const faq = JSON.parse(json[1])
  assert.strictEqual(faq['@type'], 'FAQPage')
  assert.ok(faq.mainEntity.length >= 5)
  for (const item of faq.mainEntity) {
    assert.ok(html.includes('<summary>' + item.name.replace(/'/g, '&#39;') + '</summary>'), item.name)
  }
})

test('home leaves out the data sections without the database', async function () {
  const { html } = await get(DOWN, '/')
  assert.doesNotMatch(html, /<table class="sheet"/)
  assert.match(html, /reference rates for about 150 currencies/)
})

test('home try-it explains itself without the database', async function () {
  const { res, html } = await get(DOWN, '/')
  assert.strictEqual(res.status, 200)
  assert.match(html, /Press Run to send a request\./)
})

test('docs show live examples, errors and currencies', async function () {
  const { html } = await get(LIVE, '/documentation/')
  assert.match(html, /<a href="\/documentation\/" aria-current="page">Docs<\/a>/)
  assert.match(html, /<span class="j-str">"2025-06-02"<\/span>/)
  assert.match(html, /<span class="j-str">"Invalid date"<\/span>/)
  assert.match(html, /<li><code>JPY<\/code> Japanese yen<\/li>/)
  for (const id of ['overview', 'latest', 'historical', 'parameters', 'errors', 'currencies', 'fair-use']) {
    assert.match(html, new RegExp('id="' + id + '"'), id)
  }
  assert.doesNotMatch(html, /HTTP\/2|avaliable|relibly|web\.archive\.org|40ms/)
})

test('docs render without the database', async function () {
  const { res, html } = await get(DOWN, '/documentation/')
  assert.strictEqual(res.status, 200)
  assert.match(html, /The currency list is unavailable right now\./)
  assert.doesNotMatch(html, /<span class="j-str">"2025-06-02"<\/span>/)
  assert.match(html, /<span class="j-str">"Invalid date"<\/span>/)
})

test('code tab lists contain only tabs', async function () {
  for (const urlPath of ['/', '/documentation/']) {
    const { html } = await get(LIVE, urlPath)
    const lists = html.split('role="tablist"').slice(1).map(function (rest) { return rest.slice(0, rest.indexOf('</div>')) })
    assert.ok(lists.length > 0, urlPath)
    for (const list of lists) assert.doesNotMatch(list, /class="copy"/, urlPath)
  }
})

test('CSS and JS URLs carry a content version, fonts do not', async function () {
  const { html } = await get(LIVE, '/')
  const versions = ['/css/style.css', '/js/highlight.js', '/js/site.js'].map(function (asset) {
    const match = html.match(new RegExp('"' + asset.replace(/\./g, '\\.') + '\\?v=([0-9a-f]{8})"'))
    assert.ok(match, asset)
    return match[1]
  })
  assert.strictEqual(new Set(versions).size, 1)
  assert.match(html, /href="\/fonts\/barlow-400\.woff2"/)
})

test('the no-JS try-it form redirects to the matching API URL', async function () {
  const cases = [
    ['/try?base=EUR&symbols=usd%2C+gbp+&date=2005-03-10', '/api/2005-03-10?symbols=USD,GBP'],
    ['/try?base=JPY&symbols=USD&date=', '/api/latest?base=JPY&symbols=USD'],
    ['/try?base=EUR&symbols=&date=', '/api/latest'],
    ['/try', '/api/latest']
  ]
  for (const [from, to] of cases) {
    const res = await fetch('http://127.0.0.1:' + LIVE + from, { redirect: 'manual' })
    assert.strictEqual(res.status, 302, from)
    assert.strictEqual(res.headers.get('location'), to, from)
  }
})

test('pages answer quickly when the database host never responds', async function () {
  for (const urlPath of ['/', '/documentation/']) {
    const res = await fetch('http://127.0.0.1:' + STALL + urlPath, { signal: AbortSignal.timeout(4000) })
    assert.strictEqual(res.status, 200, urlPath)
  }
})

// Pair pages

const { sig6 } = require('../controller/format')
const api = async function (query) { return (await fetch('http://127.0.0.1:' + LIVE + '/api/latest?' + query)).json() }
const pairFigure = function (html, from, to) {
  const m = html.match(new RegExp('<p class="pair-figure">1 ' + from + ' = <data value="([^"]+)">([^<]+)</data> ' + to))
  assert.ok(m, 'pair figure for ' + from + ' to ' + to)
  return { rate: Number(m[1]), text: m[2] }
}

test('pair page shows the API\'s rate, inverse, chart and history', async function () {
  const { res, html } = await get(LIVE, '/convert/usd-to-inr/')
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.headers.get('cache-control'), 'public, max-age=300')
  assert.match(html, /<h1>USD to INR exchange rate<\/h1>/)
  const figure = pairFigure(html, 'USD', 'INR')
  assert.strictEqual(figure.text, sig6(figure.rate))
  assert.strictEqual(Math.round(figure.rate * 1e6) / 1e6, (await api('base=USD&symbols=INR')).rates.INR)
  assert.match(html, /<link rel="canonical" href="https:\/\/theratesapi\.com\/convert\/usd-to-inr\/">/)
  assert.doesNotMatch(html, /name="robots"/)
  assert.strictEqual((html.match(/<svg class="chart"/g) || []).length, 1)
  const history = html.slice(html.indexOf('<table class="sheet history"'))
  const body = history.slice(history.indexOf('<tbody>'), history.indexOf('</tbody>'))
  assert.strictEqual((body.match(/<tr>/g) || []).length, 30)
})

test('pair page keeps a small rate\'s movement', async function () {
  const { html } = await get(LIVE, '/convert/vnd-to-kwd/')
  const points = html.match(/<svg class="chart"[\s\S]*?<polyline points="([^"]+)"/)[1].split(' ')
  assert.ok(new Set(points.map(function (p) { return p.split(',')[1] })).size > 10)
})

test('pair pages outside the top 30 are not indexed', async function () {
  assert.match((await get(LIVE, '/convert/kes-to-ugx/')).html, /<meta name="robots" content="noindex">/)
  assert.doesNotMatch((await get(LIVE, '/convert/kes-to-usd/')).html, /name="robots"/)
})

test('pair URLs are lowercase, real and different', async function () {
  const upper = await fetch('http://127.0.0.1:' + LIVE + '/convert/USD-to-INR/?amount=5', { redirect: 'manual' })
  assert.strictEqual(upper.status, 301)
  assert.strictEqual(upper.headers.get('location'), '/convert/usd-to-inr/?amount=5')
  for (const urlPath of ['/convert/usd-to-xyz/', '/convert/usd-to-usd/', '/convert/rub-to-usd/', '/convert/usd-inr/']) {
    assert.strictEqual((await get(LIVE, urlPath)).res.status, 404, urlPath)
  }
  assert.strictEqual((await get(LIVE, '/convert/usd-to-inr')).res.status, 200)
})

test('pair page reads the amount from the query and ignores nonsense', async function () {
  const { html } = await get(LIVE, '/convert/usd-to-inr/?amount=100')
  const rate = pairFigure(html, 'USD', 'INR').rate
  assert.match(html, /<input [^>]*name="amount"[^>]*value="100"/)
  assert.match(html, new RegExp('<output data-result>' + sig6(rate * 100) + '</output>'))
  for (const amount of ['abc', '-5', '0', '1e400', '100,5']) {
    const page = (await get(LIVE, '/convert/usd-to-inr/?amount=' + amount)).html
    assert.match(page, /<input [^>]*name="amount"[^>]*value="1"/, amount)
  }
})

test('the euro works on either side of a pair', async function () {
  const eurUsd = pairFigure((await get(LIVE, '/convert/eur-to-usd/')).html, 'EUR', 'USD')
  assert.strictEqual(eurUsd.rate, (await api('symbols=USD')).rates.USD)
  const usdEur = pairFigure((await get(LIVE, '/convert/usd-to-eur/')).html, 'USD', 'EUR')
  assert.strictEqual(Math.round(usdEur.rate * 1e6) / 1e6, (await api('base=USD&symbols=EUR')).rates.EUR)
})

// Currency pages

test('currency page names the currency, where it is used and who publishes it', async function () {
  const { res, html } = await get(LIVE, '/currencies/inr/')
  assert.strictEqual(res.status, 200)
  assert.match(html, /<h1>Indian rupee \(INR\)<\/h1>/)
  assert.match(html, /India/)
  assert.match(html, /European Central Bank/)
  assert.match(html, /href="\/convert\/inr-to-usd\/"/)
  assert.strictEqual((html.match(/<svg class="chart"/g) || []).length, 1)
  assert.match(html, /<link rel="canonical" href="https:\/\/theratesapi\.com\/currencies\/inr\/">/)
})

test('currency page for one only Banca d\'Italia publishes', async function () {
  const { html } = await get(LIVE, '/currencies/kes/')
  assert.match(html, /Banca d(&#39;|')Italia/)
  assert.match(html, /href="\/convert\/kes-to-usd\/"/)
})

test('currencies no longer published say when they stopped', async function () {
  const cyp = (await get(LIVE, '/currencies/cyp/')).html
  assert.match(cyp, /Last published on 31 December 2007/)
  const rub = (await get(LIVE, '/currencies/rub/')).html
  assert.match(rub, /Last published on 1 March 2022/)
  for (const html of [cyp, rub]) {
    assert.doesNotMatch(html, /retired/i)
    assert.doesNotMatch(html.slice(html.indexOf('<main'), html.indexOf('</main>')), /href="\/convert\//)
  }
})

test('the euro has its own page', async function () {
  const { res, html } = await get(LIVE, '/currencies/eur/')
  assert.strictEqual(res.status, 200)
  assert.match(html, /the euro area/)
  assert.match(html, /<svg class="chart"/)
})

test('currency URLs are lowercase and real', async function () {
  const upper = await fetch('http://127.0.0.1:' + LIVE + '/currencies/INR/', { redirect: 'manual' })
  assert.strictEqual(upper.status, 301)
  assert.strictEqual(upper.headers.get('location'), '/currencies/inr/')
  assert.strictEqual((await get(LIVE, '/currencies/xyz/')).res.status, 404)
})

test('currency index lists current currencies and the ones no longer published', async function () {
  const { html } = await get(LIVE, '/currencies/')
  const latest = await api('')
  const current = html.slice(html.indexOf('<table class="sheet currency-index"'))
  const body = current.slice(current.indexOf('<tbody>'), current.indexOf('</tbody>'))
  assert.strictEqual((body.match(/<tr>/g) || []).length, Object.keys(latest.rates).length + 1)
  const stopped = html.slice(html.indexOf('id="no-longer-published"'))
  assert.match(stopped, /CYP/)
  assert.match(stopped, /RUB/)
})

// Converter and navigation

test('the converter sends a choice to its pair page without JavaScript', async function () {
  const res = await fetch('http://127.0.0.1:' + LIVE + '/convert/?from=usd&to=inr&amount=100', { redirect: 'manual' })
  assert.strictEqual(res.status, 302)
  assert.strictEqual(res.headers.get('location'), '/convert/usd-to-inr/?amount=100')
})

test('the converter explains a pair it cannot convert', async function () {
  for (const query of ['?from=usd&to=usd', '?from=usd&to=xyz']) {
    const { res, html } = await get(LIVE, '/convert/' + query)
    assert.strictEqual(res.status, 200, query)
    assert.match(html, /Choose two different currencies\./, query)
  }
  const { res, html } = await get(LIVE, '/convert/')
  assert.strictEqual(res.status, 200)
  assert.doesNotMatch(html, /Choose two different currencies\./)
  const latest = await api('')
  const from = html.slice(html.indexOf('<select name="from"'), html.indexOf('</select>'))
  assert.strictEqual((from.match(/<option /g) || []).length, Object.keys(latest.rates).length + 1)
})

test('navigation links the new pages', async function () {
  for (const urlPath of ['/', '/documentation/', '/convert/usd-to-inr/']) {
    const { html } = await get(LIVE, urlPath)
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
    assert.match(header, /href="\/convert\/"/, urlPath)
    const footer = html.slice(html.lastIndexOf('<footer'))
    assert.match(footer, /href="\/currencies\/"/, urlPath)
  }
  const home = (await get(LIVE, '/')).html
  const grid = home.slice(home.indexOf('<ul class="currency-grid"'))
  assert.match(grid, /href="\/currencies\/inr\/"/)
})

// Sitemap

test('the sitemap lists the pages search engines should find', async function () {
  const res = await fetch('http://127.0.0.1:' + LIVE + '/sitemap.xml')
  assert.strictEqual(res.status, 200)
  assert.match(res.headers.get('content-type'), /^application\/xml/)
  const xml = await res.text()
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  const locs = (xml.match(/<loc>[^<]+<\/loc>/g) || []).map(function (l) { return l.slice(5, -6) })
  const index = (await get(LIVE, '/currencies/')).html
  const currencyPages = new Set((index.match(/href="\/currencies\/[a-z]{3}\/"/g) || []))
  assert.strictEqual(locs.length, 4 + currencyPages.size + 870)
  for (const loc of locs) assert.match(loc, /^https:\/\/theratesapi\.com\/.*\/$|^https:\/\/theratesapi\.com\/$/, loc)
  assert.ok(locs.includes('https://theratesapi.com/convert/vnd-to-usd/'))
  assert.ok(!locs.includes('https://theratesapi.com/convert/kes-to-ugx/'))
  assert.ok(locs.includes('https://theratesapi.com/currencies/cyp/'))
  assert.strictEqual((xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, locs.length)
})

test('robots.txt points to the sitemap', async function () {
  const text = await (await fetch('http://127.0.0.1:' + LIVE + '/robots.txt')).text()
  assert.match(text, /^Sitemap: https:\/\/theratesapi\.com\/sitemap\.xml$/m)
})

// Attribution and titles (final review)

const source = function (html) { return html.match(/<p class="pair-source">([^<]*)<\/p>/)[1].replace(/&#39;/g, "'") }

test('pairs with the euro credit only the bank that published the other side', async function () {
  assert.match(source((await get(LIVE, '/convert/eur-to-kes/')).html), /^Published by Banca d'Italia on /)
  assert.match(source((await get(LIVE, '/convert/kes-to-eur/')).html), /^Calculated from the euro rates published by Banca d'Italia on /)
  assert.match(source((await get(LIVE, '/convert/eur-to-usd/')).html), /^Published by the European Central Bank on /)
})

test('currency pages say their cross-rates are calculated, naming both banks', async function () {
  for (const code of ['inr', 'kes']) {
    const html = (await get(LIVE, '/currencies/' + code + '/')).html.replace(/&#39;/g, "'")
    assert.match(html, /Rates against other currencies are calculated from the euro rates published by Banca d'Italia and the European Central Bank on /, code)
  }
})

test('currency page titles carry a figure', async function () {
  const html = (await get(LIVE, '/currencies/inr/')).html
  const usd = (await api('base=INR&symbols=USD')).rates.USD
  const title = html.match(/<title>([^<]*)<\/title>/)[1]
  assert.match(title, /^Indian rupee \(INR\) exchange rates: 1 INR = [\d.]+ USD \| The Rates API$/)
  assert.strictEqual(Math.round(Number(title.match(/= ([\d.]+) USD/)[1]) * 1e6) / 1e6, usd)
})
