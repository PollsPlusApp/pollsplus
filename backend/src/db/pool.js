const { Pool } = require('pg');

const connectionString = process.env.DATABASE_PUBLIC_URL
  || process.env.DATABASE_URL
  || 'postgresql://postgres:WrYLPriByOKcbdCFsMRlsRgqoWiVVhsc@maglev.proxy.rlwy.net:58334/railway';

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

module.exports = pool;
