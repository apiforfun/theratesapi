require('dotenv').config()
const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')

const createError = require('http-errors')
const nunjucks = require('nunjucks')
const logger = require('morgan')
const bodyParser = require('body-parser')
const highlightJson = require('./public/js/highlight')

app.set('view engine', 'nunjucks')

// determine absolute path to your views folder
const viewsPath = path.join(__dirname, 'views')

// configure Nunjucks
const njEnv = nunjucks.configure(viewsPath, {
  autoescape: true,
  express:    app,
  watch:      process.env.NODE_ENV !== 'production'
})

// highlightJson escapes before adding markup, so its output is safe to insert as HTML.
njEnv.addFilter('json', function (value) {
  return new nunjucks.runtime.SafeString(highlightJson(value))
})

// CSS and JS URLs carry a hash of their contents, so the static cache never serves a stale
// file after a deploy. Fonts stay unversioned: the stylesheet refers to them by plain URL.
const assetHash = crypto.createHash('md5')
for (const file of ['css/style.css', 'js/highlight.js', 'js/site.js']) {
  assetHash.update(fs.readFileSync(path.join(__dirname, 'public', file)))
}
njEnv.addGlobal('assetVersion', assetHash.digest('hex').slice(0, 8))

// register .html so you can keep your existing filenames
app.engine('html', njEnv.render)
app.set('view engine', 'html')
app.set('views', viewsPath)

// Asset names aren't fingerprinted, so keep the cache short enough for edits to show up.
app.use(express.static('public', { maxAge: '1h' }))
app.use(bodyParser.urlencoded({ extended: false }))

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, '/public')));

const commonRouter = require('./routes/common')
const apiRouter = require('./routes/api')

app.use('/api', apiRouter)
app.use('/', commonRouter)


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status)
  res.render('error.html', { status })
})

const PORT = process.env.PORT || 9060

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`)
})
