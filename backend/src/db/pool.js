const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 lookups — Railway uses IPv6 by default but Supabase direct needs IPv4
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
});

module.exports = pool;
