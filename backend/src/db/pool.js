const { Pool } = require('pg');

// Railway sets PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE automatically
// when you link a Postgres database to a service. We try individual vars first,
// then fall back to connection string URLs.
let poolConfig;

if (process.env.PGHOST) {
  // Use individual Railway-injected variables
  poolConfig = {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'railway',
  };
} else {
  // Fallback to connection string
  poolConfig = {
    connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  };
}

// Only enable SSL for non-internal connections
const isInternal = (poolConfig.host && poolConfig.host.includes('.railway.internal'))
  || (poolConfig.connectionString && poolConfig.connectionString.includes('.railway.internal'));

poolConfig.ssl = isInternal ? false : { rejectUnauthorized: false };
poolConfig.max = 10;
poolConfig.idleTimeoutMillis = 20000;
poolConfig.connectionTimeoutMillis = 10000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

module.exports = pool;
