const express = require('express')
const router = express.Router()
const { index } = require('../controller/common')

/* GET home page. */
router.get('/', index)

router.get('/:slug', function (req, res) {
  console.log(req.params.slug)
  res.render('pages/' + req.params.slug + '.html')
})

module.exports = router
