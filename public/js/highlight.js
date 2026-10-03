// Pretty-prints a JSON value as HTML with a span around each token. Shared by the server
// (the Nunjucks `json` filter) and the browser (try-it results). Callers insert the result
// unescaped, so the whole string is escaped before any markup is added.
(function (root) {
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
  const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

  function highlightJson (value) {
    const escaped = JSON.stringify(value, null, 2).replace(/[&<>]/g, function (c) { return ESCAPES[c] })
    return escaped.replace(TOKEN, function (match, string, colon, literal) {
      if (string) {
        return colon
          ? '<span class="j-key">' + string + '</span>' + colon
          : '<span class="j-str">' + string + '</span>'
      }
      if (literal) return '<span class="j-lit">' + literal + '</span>'
      return '<span class="j-num">' + match + '</span>'
    })
  }

  if (typeof module !== 'undefined') module.exports = highlightJson
  else root.highlightJson = highlightJson
})(this)
