require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { globalLimiter, authLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const debateRoutes = require('./routes/debates');
const feedRoutes = require('./routes/feeds');
const communityRoutes = require('./routes/communities');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint — check DB connection and tables (REMOVE BEFORE PRODUCTION)
app.get('/debug/db', async (req, res) => {
  const pool = require('./db/pool');
  const envInfo = {
    DATABASE_URL: (process.env.DATABASE_URL || 'NOT SET').replace(/:([^@]+)@/, ':***@'),
    DATABASE_PUBLIC_URL: (process.env.DATABASE_PUBLIC_URL || 'NOT SET').replace(/:([^@]+)@/, ':***@'),
    PGHOST: process.env.PGHOST || 'NOT SET',
    PGPORT: process.env.PGPORT || 'NOT SET',
    PGUSER: process.env.PGUSER || 'NOT SET',
    PGDATABASE: process.env.PGDATABASE || 'NOT SET',
    PGPASSWORD: process.env.PGPASSWORD ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
  };
  try {
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    res.json({ connected: true, env: envInfo, tables: tables.rows.map(r => r.table_name) });
  } catch (err) {
    res.json({ connected: false, error: err.message, env: envInfo });
  }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/debates', debateRoutes);
app.use('/api/feeds', feedRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PollsPlus server running on port ${PORT}`);
});

module.exports = app;
