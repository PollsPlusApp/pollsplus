const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { optionalAuth } = authenticate;
const { parsePagination } = require('../utils/helpers');

const router = express.Router();

// GET /api/search?q=term — Search users, communities, and debates
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ users: [], communities: [], debates: [] });
    }

    const term = `%${q.trim()}%`;
    const { limit } = parsePagination(req.query);

    // Search users
    const users = await pool.query(
      `SELECT id, username, category FROM users
      WHERE username ILIKE $1
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = $3 AND blocked_id = users.id) OR (blocker_id = users.id AND blocked_id = $3))
      ORDER BY username ASC LIMIT $2`,
      [term, limit, req.userId]
    );

    // Search communities
    const communities = await pool.query(
      `SELECT c.id, c.name, c.category, c.is_private,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'member')::int AS member_count,
        EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $3 AND status = 'member') AS is_member
      FROM communities c
      WHERE c.name ILIKE $1
      ORDER BY (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'member') DESC
      LIMIT $2`,
      [term, limit, req.userId]
    );

    // Search debates by title
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
      WHERE d.title ILIKE $1
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = $3 AND blocked_id = d.user_id) OR (blocker_id = d.user_id AND blocked_id = $3))
      ORDER BY d.created_at DESC
      LIMIT $2`,
      [term, limit, req.userId]
    );

    res.json({
      users: users.rows,
      communities: communities.rows,
      debates: debates.rows,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
