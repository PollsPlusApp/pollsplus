const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { parsePagination } = require('../utils/helpers');

const router = express.Router();

// GET /api/users/:id — Get user profile
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT u.id, u.username, u.category, u.created_at,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)::int AS following_count,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following,
        EXISTS(SELECT 1 FROM blocks WHERE blocker_id = $2 AND blocked_id = u.id) AS is_blocked
      FROM users u WHERE u.id = $1`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id/debates — Get user's debates (paginated)
router.get('/:id/debates', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, offset } = parsePagination(req.query);

    const debates = await pool.query(
      `SELECT d.id, d.title, d.category, d.community_id, d.created_at,
        u.id AS author_id, u.username AS author_username, u.category AS author_category,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', o.id, 'label', o.label, 'position', o.position,
          'vote_count', (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id)::int
        ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
        (SELECT COUNT(*) FROM votes v WHERE v.debate_id = d.id)::int AS total_votes,
        (SELECT option_id FROM votes v WHERE v.user_id = $3 AND v.debate_id = d.id) AS my_vote_option_id
      FROM debates d
      JOIN users u ON d.user_id = u.id
      WHERE d.user_id = $1
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = $3 AND blocked_id = d.user_id) OR (blocker_id = d.user_id AND blocked_id = $3))
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $4`,
      [id, limit, req.userId, offset]
    );

    res.json({ debates: debates.rows, page: Math.floor(offset / limit) + 1, limit });
  } catch (err) {
    console.error('Get user debates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/follow — Follow user
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check target exists
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check not blocked
    const blocked = await pool.query(
      'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
      [req.userId, targetId]
    );
    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot follow this user' });
    }

    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, targetId]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, from_user_id) VALUES ($1, 'new_follower', $2)`,
      [targetId, req.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id/follow — Unfollow user
router.delete('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.userId, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id/following — List who user follows
router.get('/:id/following', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `SELECT u.id, u.username, u.category
      FROM follows f JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get following error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id/followers — List user's followers
router.get('/:id/followers', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `SELECT u.id, u.username, u.category
      FROM follows f JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get followers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/block — Block user
router.post('/:id/block', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await pool.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, targetId]
    );

    // Remove any follows between the two users
    await pool.query(
      'DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
      [req.userId, targetId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Block error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id/block — Unblock user
router.delete('/:id/block', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.userId, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Unblock error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/report — Report user
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason) VALUES ($1, $2, $3)',
      [req.userId, parseInt(req.params.id), reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
