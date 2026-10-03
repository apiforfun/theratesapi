const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fail fast instead of leaving requests hanging when Postgres is unreachable or stuck.
  connectionTimeoutMillis: 2000,
  query_timeout: 5000
})

// Without a listener, an error on an idle client would crash the process.
pool.on('error', function (err) {
  console.error('Postgres pool error', err)
})

module.exports = pool
