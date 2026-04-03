const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { isValidCategory, parsePagination } = require('../utils/helpers');

const router = express.Router();

// Shared debate query builder — returns debate objects with options, vote counts, user's vote
const DEBATE_SELECT = `
  SELECT d.id, d.title, d.category, d.community_id, d.created_at,
    u.id AS author_id, u.username AS author_username, u.category AS author_category,
    (SELECT COALESCE(json_agg(json_build_object(
      'id', o.id, 'label', o.label, 'position', o.position,
      'vote_count', (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id)::int
    ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
    (SELECT COUNT(*) FROM votes v WHERE v.debate_id = d.id)::int AS total_votes,
    (SELECT option_id FROM votes v WHERE v.user_id = $1 AND v.debate_id = d.id) AS my_vote_option_id
  FROM debates d
  JOIN users u ON d.user_id = u.id
`;

// Block filter — hide debates from/to blocked users
const BLOCK_FILTER = `
  AND NOT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = $1 AND blocked_id = d.user_id)
       OR (blocker_id = d.user_id AND blocked_id = $1)
  )
`;

// Seen filter — hide posts user has seen or voted on
const SEEN_FILTER = `
  AND NOT EXISTS (SELECT 1 FROM seen_posts WHERE user_id = $1 AND debate_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM votes WHERE user_id = $1 AND debate_id = d.id)
`;

// GET /api/feeds/following — Posts from people you follow
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

// GET /api/feeds/communities — Posts from communities you're in
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

// GET /api/feeds/category/:category — Category feed (filters seen)
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

// GET /api/feeds/popular — Popular feed (votes + comments + recency, filters seen)
router.get('/popular', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    // Score = total_votes + recency_bonus (posts in last 24hrs get a boost)
    const result = await pool.query(
      `${DEBATE_SELECT}
      WHERE true
      ${BLOCK_FILTER}
      ${SEEN_FILTER}
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
