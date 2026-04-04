const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  ssl: false,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

module.exports = pool;
