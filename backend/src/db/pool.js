const { Pool, Client } = require('pg');

// Hardcoded public URL — Railway env vars not resolving
const DB_URL = 'postgresql://postgres:WrYLPriByOKcbdCFsMRlsRgqoWiVVhsc@maglev.proxy.rlwy.net:58334/railway';

// Try multiple SSL configs to find what works
async function createWorkingPool() {
  const configs = [
    { name: 'no-ssl', ssl: false },
    { name: 'ssl-reject-false', ssl: { rejectUnauthorized: false } },
    { name: 'ssl-true', ssl: true },
  ];

  for (const cfg of configs) {
    try {
      const client = new Client({
        connectionString: DB_URL,
        ssl: cfg.ssl,
        connectionTimeoutMillis: 8000,
      });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log(`DB connected with config: ${cfg.name}`);
      return new Pool({
        connectionString: DB_URL,
        max: 10,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 10000,
        ssl: cfg.ssl,
      });
    } catch (err) {
      console.log(`DB config ${cfg.name} failed: ${err.message}`);
    }
  }

  console.error('All DB connection attempts failed, creating pool with no-ssl as default');
  return new Pool({
    connectionString: DB_URL,
    max: 10,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
    ssl: false,
  });
}

// Export a promise that resolves to the pool
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
