const { Pool, Client } = require('pg');

async function testConnection(name, config) {
  const client = new Client({ ...config, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 AS ok');
    await client.end();
    console.log(`[DB] ${name}: SUCCESS`);
    return true;
  } catch (err) {
    console.log(`[DB] ${name}: FAILED - ${err.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function createWorkingPool() {
  // Log every PG-related env var
  const envVars = ['DATABASE_URL', 'DATABASE_PUBLIC_URL', 'DATABASE_PRIVATE_URL',
    'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
    'RAILWAY_PRIVATE_DOMAIN', 'RAILWAY_ENVIRONMENT'];
  for (const v of envVars) {
    const val = process.env[v];
    if (v === 'PGPASSWORD' && val) {
      console.log(`[DB] ${v} = SET (hidden)`);
    } else {
      console.log(`[DB] ${v} = ${val || 'NOT SET'}`);
    }
  }

  const attempts = [];

  // 1. Individual PG vars (Railway may inject these)
  if (process.env.PGHOST) {
    const pgVarConfig = {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'railway',
    };
    attempts.push({ name: 'PGHOST no-ssl', config: { ...pgVarConfig, ssl: false } });
    attempts.push({ name: 'PGHOST ssl-lax', config: { ...pgVarConfig, ssl: { rejectUnauthorized: false } } });
  }

  // 2. DATABASE_PUBLIC_URL
  if (process.env.DATABASE_PUBLIC_URL) {
    const url = process.env.DATABASE_PUBLIC_URL;
    attempts.push({ name: 'PUBLIC_URL no-ssl', config: { connectionString: url, ssl: false } });
    attempts.push({ name: 'PUBLIC_URL ssl-lax', config: { connectionString: url, ssl: { rejectUnauthorized: false } } });
  }

  // 3. DATABASE_URL (internal)
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    attempts.push({ name: 'DATABASE_URL no-ssl', config: { connectionString: url, ssl: false } });
    attempts.push({ name: 'DATABASE_URL ssl-lax', config: { connectionString: url, ssl: { rejectUnauthorized: false } } });
  }

  // 4. Hardcoded public URL as last resort
  const hardcoded = 'postgresql://postgres:WrYLPriByOKcbdCFsMRlsRgqoWiVVhsc@maglev.proxy.rlwy.net:58334/railway';
  attempts.push({ name: 'HARDCODED no-ssl', config: { connectionString: hardcoded, ssl: false } });
  attempts.push({ name: 'HARDCODED ssl-lax', config: { connectionString: hardcoded, ssl: { rejectUnauthorized: false } } });

  // 5. Hardcoded individual params (bypasses URL parsing)
  attempts.push({
    name: 'HARDCODED-params no-ssl',
    config: { host: 'maglev.proxy.rlwy.net', port: 58334, user: 'postgres',
      password: 'WrYLPriByOKcbdCFsMRlsRgqoWiVVhsc', database: 'railway', ssl: false }
  });
  attempts.push({
    name: 'HARDCODED-params ssl-lax',
    config: { host: 'maglev.proxy.rlwy.net', port: 58334, user: 'postgres',
      password: 'WrYLPriByOKcbdCFsMRlsRgqoWiVVhsc', database: 'railway', ssl: { rejectUnauthorized: false } }
  });

  // 6. Internal hostname with individual params
  attempts.push({
    name: 'INTERNAL-params no-ssl',
    config: { host: 'postgres.railway.internal', port: 5432, user: 'postgres',
      password: 'WrYLPriByOKcbdCFsMRlsRgqoWiVVhsc', database: 'railway', ssl: false }
  });

  console.log(`[DB] Testing ${attempts.length} connection configs...`);

  for (const attempt of attempts) {
    const success = await testConnection(attempt.name, attempt.config);
    if (success) {
      console.log(`[DB] Using config: ${attempt.name}`);
      return new Pool({
        ...attempt.config,
        max: 10,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 10000,
      });
    }
  }

  console.error('[DB] ALL connection attempts failed');
  // Return a pool anyway so the server starts (queries will fail with useful errors)
  return new Pool({
    connectionString: process.env.DATABASE_URL || hardcoded,
    max: 10,
    ssl: false,
  });
}

let poolPromise = createWorkingPool();
let resolvedPool = null;

module.exports = {
  async query(text, params) {
    if (!resolvedPool) resolvedPool = await poolPromise;
    return resolvedPool.query(text, params);
  },
  async connect() {
    if (!resolvedPool) resolvedPool = await poolPromise;
    return resolvedPool.connect();
  },
};
