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
    assert.match(html, /Last updated 3 October 2026/, urlPath)
    assert.doesNotMatch(html, /DEVELOPER NAME|Mastercard|Google Analytics/, urlPath)
  }
})

test('no page loads third-party scripts, styles or fonts', async function () {
  for (const urlPath of ['/', '/documentation/', '/privacy-policy/', '/terms-and-conditions/', '/nope']) {
    const { html } = await get(LIVE, urlPath)
    assert.doesNotMatch(html, /<(script|link)\b[^>]*\b(src|href)="(https?:)?\/\//, urlPath)
  }
})

test('shared layout has the menu button, nav and footer links', async function () {
  const { html } = await get(LIVE, '/privacy-policy/')
  assert.match(html, /<html lang="en">/)
  assert.match(html, /class="menu-toggle"[^>]*aria-controls="site-nav"/)
  assert.match(html, /href="https:\/\/github.com\/apiforfun\/theratesapi\/issues"/)
  assert.match(html, /<title>Privacy policy \| The Rates API<\/title>/)
})

test('home page has the try-it form, facts and code tabs', async function () {
  const { html } = await get(LIVE, '/')
  assert.match(html, /<form class="try" action="\/try" method="get" data-try>/)
  assert.match(html, /<option value="EUR" selected>EUR<\/option>/)
  assert.match(html, /<option value="USD">USD<\/option>/)
  assert.match(html, /30 currencies/)
  assert.match(html, /role="tabpanel"/)
  assert.doesNotMatch(html, /role="tabpanel"[^>]*\bhidden\b/)
  assert.doesNotMatch(html, /Requests in last 7 days|Response Rate|Dialy/)
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
