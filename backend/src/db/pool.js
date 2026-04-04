const { Pool } = require('pg');

const useSSL = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: useSSL,
});

module.exports = pool;
