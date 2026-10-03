require('dotenv').config()
const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const path = require('path')

const createError = require('http-errors')
const nunjucks = require('nunjucks')
const logger = require('morgan')
const bodyParser = require('body-parser')

app.set('view engine', 'nunjucks')

// determine absolute path to your views folder
const viewsPath = path.join(__dirname, 'views')

// configure Nunjucks
const njEnv = nunjucks.configure(viewsPath, {
  autoescape: true,
  express:    app,
  watch:      process.env.NODE_ENV !== 'production'
})

// register .html so you can keep your existing filenames
app.engine('html', njEnv.render)
app.set('view engine', 'html')
app.set('views', viewsPath)

app.use(express.static('public'))
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
  // set locals, only providing error in development
  console.log(err)
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

const PORT = process.env.PORT || 9060

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`)
})
