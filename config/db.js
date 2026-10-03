const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Without a listener, an error on an idle client would crash the process.
pool.on('error', function (err) {
  console.error('Postgres pool error', err)
})

module.exports = pool
