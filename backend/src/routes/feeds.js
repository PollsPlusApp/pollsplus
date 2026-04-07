const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { isValidCategory, parsePagination } = require('../utils/helpers');

const router = express.Router();

// Shared debate query — includes expires_at, vote timestamp, pin status
const DEBATE_SELECT = `
  SELECT d.id, d.title, d.category, d.community_id, d.created_at, d.expires_at,
    u.id AS author_id, u.username AS author_username, u.category AS author_category,
    (SELECT COALESCE(json_agg(json_build_object(
      'id', o.id, 'label', o.label, 'position', o.position,
      'vote_count', (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id)::int
    ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
    (SELECT COUNT(*) FROM votes v WHERE v.debate_id = d.id)::int AS total_votes,
    (SELECT option_id FROM votes v WHERE v.user_id = $1 AND v.debate_id = d.id) AS my_vote_option_id,
    (SELECT created_at FROM votes v WHERE v.user_id = $1 AND v.debate_id = d.id) AS my_vote_created_at,
    EXISTS(SELECT 1 FROM pins WHERE user_id = $1 AND debate_id = d.id) AS is_pinned,
    (SELECT COUNT(*) FROM comments WHERE debate_id = d.id)::int AS comment_count
  FROM debates d
  JOIN users u ON d.user_id = u.id
`;

const BLOCK_FILTER = `
  AND NOT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = $1 AND blocked_id = d.user_id)
       OR (blocker_id = d.user_id AND blocked_id = $1)
  )
`;

const SEEN_FILTER = `
  AND NOT EXISTS (SELECT 1 FROM seen_posts WHERE user_id = $1 AND debate_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM votes WHERE user_id = $1 AND debate_id = d.id)
`;

// Hide expired debates from discovery feeds
const EXPIRED_FILTER = `
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
`;

// GET /api/feeds/following
router.get('/following', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `${DEBATE_SELECT}
      WHERE d.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
      ${BLOCK_FILTER}
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Following feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/feeds/communities
router.get('/communities', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `${DEBATE_SELECT}
      WHERE d.community_id IN (
        SELECT community_id FROM community_members WHERE user_id = $1 AND status = 'member'
      )
      ${BLOCK_FILTER}
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Communities feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/feeds/category/:category — filters seen + expired
router.get('/category/:category', authenticate, async (req, res) => {
  try {
    const { category } = req.params;
    if (!isValidCategory(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    const { limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `${DEBATE_SELECT}
      WHERE d.category = $4
      ${BLOCK_FILTER}
      ${SEEN_FILTER}
      ${EXPIRED_FILTER}
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset, category]
    );
    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Category feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/feeds/popular — filters seen + expired
router.get('/popular', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `${DEBATE_SELECT}
      WHERE true
      ${BLOCK_FILTER}
      ${SEEN_FILTER}
      ${EXPIRED_FILTER}
      ORDER BY (
        (SELECT COUNT(*) FROM votes v2 WHERE v2.debate_id = d.id)
        + CASE WHEN d.created_at > NOW() - INTERVAL '24 hours' THEN 10 ELSE 0 END
      ) DESC, d.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Popular feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
