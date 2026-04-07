const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { parsePagination, isValidCategory } = require('../utils/helpers');

const router = express.Router();

// GET /api/users/me/voted — Get debates the current user voted on (with vote timestamp)
router.get('/me/voted', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT d.id, d.title, d.category, d.community_id, d.created_at, d.expires_at,
        u.id AS author_id, u.username AS author_username, u.category AS author_category,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', o.id, 'label', o.label, 'position', o.position,
          'vote_count', (SELECT COUNT(*) FROM votes v2 WHERE v2.option_id = o.id)::int
        ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
        (SELECT COUNT(*) FROM votes v2 WHERE v2.debate_id = d.id)::int AS total_votes,
        (SELECT option_id FROM votes v2 WHERE v2.user_id = $1 AND v2.debate_id = d.id) AS my_vote_option_id,
        v.created_at AS my_vote_created_at,
        EXISTS(SELECT 1 FROM pins WHERE user_id = $1 AND debate_id = d.id) AS is_pinned
      FROM votes v
      JOIN debates d ON v.debate_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE v.user_id = $1
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = d.user_id) OR (blocker_id = d.user_id AND blocked_id = $1))
      ORDER BY v.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Get voted debates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/me/pinned — Get debates the current user has pinned
router.get('/me/pinned', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT d.id, d.title, d.category, d.community_id, d.created_at, d.expires_at,
        u.id AS author_id, u.username AS author_username, u.category AS author_category,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', o.id, 'label', o.label, 'position', o.position,
          'vote_count', (SELECT COUNT(*) FROM votes v2 WHERE v2.option_id = o.id)::int
        ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
        (SELECT COUNT(*) FROM votes v2 WHERE v2.debate_id = d.id)::int AS total_votes,
        (SELECT option_id FROM votes v2 WHERE v2.user_id = $1 AND v2.debate_id = d.id) AS my_vote_option_id,
        (SELECT created_at FROM votes v2 WHERE v2.user_id = $1 AND v2.debate_id = d.id) AS my_vote_created_at,
        true AS is_pinned,
        p.pin_type
      FROM pins p
      JOIN debates d ON p.debate_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE p.user_id = $1
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = d.user_id) OR (blocker_id = d.user_id AND blocked_id = $1))
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Get pinned debates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/me/communities — Get communities the current user is a member of
router.get('/me/communities', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT c.*,
        u.username AS founder_username,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'member')::int AS member_count,
        true AS is_member,
        (c.founder_id = $1) AS is_founder
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      JOIN users u ON c.founder_id = u.id
      WHERE cm.user_id = $1 AND cm.status = 'member'
      ORDER BY cm.joined_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    res.json({ communities: result.rows });
  } catch (err) {
    console.error('Get my communities error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/me/category — Update current user's category
router.put('/me/category', authenticate, async (req, res) => {
  try {
    const { category } = req.body;
    if (!category || !isValidCategory(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    await pool.query('UPDATE users SET category = $1, updated_at = NOW() WHERE id = $2', [category, req.userId]);
    res.json({ success: true, category });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
