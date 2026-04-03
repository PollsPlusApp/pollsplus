const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { parsePagination } = require('../utils/helpers');

const router = express.Router();

// GET /api/notifications — Get notifications (paginated)
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT n.id, n.type, n.read, n.created_at,
        u.id AS from_user_id, u.username AS from_username, u.category AS from_user_category
      FROM notifications n
      JOIN users u ON n.from_user_id = u.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    const unreadCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = false',
      [req.userId]
    );

    res.json({
      notifications: result.rows,
      unread_count: unreadCount.rows[0].count,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/read — Mark all as read
router.post('/read', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
