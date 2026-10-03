const test = require('node:test')
const assert = require('node:assert')
const highlightJson = require('../public/js/highlight')

test('pretty-prints with two-space indent and wraps each token', function () {
  assert.strictEqual(
    highlightJson({ a: 1 }),
    '{\n  <span class="j-key">"a"</span>: <span class="j-num">1</span>\n}'
  )
})

test('wraps keys, strings, numbers and literals', function () {
  const html = highlightJson({ base: 'EUR', rate: -1.5e-7, ok: true, off: false, none: null })
  assert.ok(html.includes('<span class="j-key">"base"</span>:'))
  assert.ok(html.includes('<span class="j-str">"EUR"</span>'))
  assert.ok(html.includes('<span class="j-num">-1.5e-7</span>'))
  assert.ok(html.includes('<span class="j-lit">true</span>'))
  assert.ok(html.includes('<span class="j-lit">false</span>'))
  assert.ok(html.includes('<span class="j-lit">null</span>'))
})

test('leaves digits and literals inside strings alone', function () {
  const html = highlightJson({ date: '2026-10-02', note: 'true or null' })
  assert.ok(html.includes('<span class="j-str">"2026-10-02"</span>'))
  assert.ok(html.includes('<span class="j-str">"true or null"</span>'))
})

test('keeps escaped quotes inside one string token', function () {
  const html = highlightJson({ q: 'say "hi"' })
  assert.ok(html.includes('<span class="j-str">"say \\"hi\\""</span>'))
})

test('escapes markup in keys and values', function () {
  const html = highlightJson({ '<script>': '</pre><img src=x onerror=alert(1)>', amp: 'a&b' })
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('</pre>'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('a&amp;b'))
})
