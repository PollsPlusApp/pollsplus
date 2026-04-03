const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { isValidCategory, parsePagination } = require('../utils/helpers');

const router = express.Router();

// POST /api/communities — Create community
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, category, is_private } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!category || !isValidCategory(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'INSERT INTO communities (name, category, founder_id, is_private) VALUES ($1, $2, $3, $4) RETURNING *',
        [name.trim(), category, req.userId, is_private || false]
      );
      const community = result.rows[0];

      // Founder auto-joins as member
      await client.query(
        "INSERT INTO community_members (community_id, user_id, status) VALUES ($1, $2, 'member')",
        [community.id, req.userId]
      );

      await client.query('COMMIT');

      res.status(201).json({ ...community, member_count: 1, is_member: true, is_founder: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create community error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/communities/browse/:category — Browse communities by category
router.get('/browse/:category', authenticate, async (req, res) => {
  try {
    const { category } = req.params;
    if (!isValidCategory(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'member')::int AS member_count,
        EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $1 AND status = 'member') AS is_member,
        (c.founder_id = $1) AS is_founder
      FROM communities c
      WHERE c.category = $4
      ORDER BY (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'member') DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset, category]
    );

    res.json({ communities: result.rows });
  } catch (err) {
    console.error('Browse communities error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/communities/:id — Get community info
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        u.username AS founder_username,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'member')::int AS member_count,
        EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $2 AND status = 'member') AS is_member,
        EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $2 AND status = 'pending') AS is_pending,
        (c.founder_id = $2) AS is_founder
      FROM communities c
      JOIN users u ON c.founder_id = u.id
      WHERE c.id = $1`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get community error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/communities/:id/debates — Get community debates (paginated, shows all — no seen filter)
router.get('/:id/debates', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT d.id, d.title, d.category, d.community_id, d.created_at,
        u.id AS author_id, u.username AS author_username, u.category AS author_category,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', o.id, 'label', o.label, 'position', o.position,
          'vote_count', (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id)::int
        ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
        (SELECT COUNT(*) FROM votes v WHERE v.debate_id = d.id)::int AS total_votes,
        (SELECT option_id FROM votes v WHERE v.user_id = $1 AND v.debate_id = d.id) AS my_vote_option_id
      FROM debates d
      JOIN users u ON d.user_id = u.id
      WHERE d.community_id = $4
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocker_id = $1 AND blocked_id = d.user_id)
             OR (blocker_id = d.user_id AND blocked_id = $1)
        )
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset, req.params.id]
    );

    res.json({ debates: result.rows });
  } catch (err) {
    console.error('Get community debates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/communities/:id/join — Join or request to join
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);

    const community = await pool.query('SELECT * FROM communities WHERE id = $1', [communityId]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Check if already a member or pending
    const existing = await pool.query(
      'SELECT status FROM community_members WHERE community_id = $1 AND user_id = $2',
      [communityId, req.userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `Already ${existing.rows[0].status}` });
    }

    const status = community.rows[0].is_private ? 'pending' : 'member';

    await pool.query(
      'INSERT INTO community_members (community_id, user_id, status) VALUES ($1, $2, $3)',
      [communityId, req.userId, status]
    );

    res.json({ success: true, status });
  } catch (err) {
    console.error('Join community error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/communities/:id/leave — Leave community
router.delete('/:id/leave', authenticate, async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);

    // Founder cannot leave
    const community = await pool.query('SELECT founder_id FROM communities WHERE id = $1', [communityId]);
    if (community.rows.length > 0 && community.rows[0].founder_id === req.userId) {
      return res.status(400).json({ error: 'Founders cannot leave their community' });
    }

    await pool.query(
      'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
      [communityId, req.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Leave community error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/communities/:id/members — List members
router.get('/:id/members', authenticate, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT u.id, u.username, u.category, cm.joined_at
      FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = $1 AND cm.status = 'member'
      ORDER BY cm.joined_at ASC
      LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );

    res.json({ members: result.rows });
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/communities/:id/pending — List pending requests (founder only)
router.get('/:id/pending', authenticate, async (req, res) => {
  try {
    const community = await pool.query('SELECT founder_id FROM communities WHERE id = $1', [req.params.id]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (community.rows[0].founder_id !== req.userId) {
      return res.status(403).json({ error: 'Only the founder can view pending requests' });
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.category, cm.joined_at AS requested_at
      FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = $1 AND cm.status = 'pending'
      ORDER BY cm.joined_at ASC`,
      [req.params.id]
    );

    res.json({ pending: result.rows });
  } catch (err) {
    console.error('Get pending error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/communities/:id/approve/:userId — Approve join request
router.post('/:id/approve/:userId', authenticate, async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const community = await pool.query('SELECT founder_id FROM communities WHERE id = $1', [communityId]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (community.rows[0].founder_id !== req.userId) {
      return res.status(403).json({ error: 'Only the founder can approve requests' });
    }

    const result = await pool.query(
      "UPDATE community_members SET status = 'member', joined_at = NOW() WHERE community_id = $1 AND user_id = $2 AND status = 'pending' RETURNING id",
      [communityId, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending request found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/communities/:id/members/:userId — Remove member (founder only)
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const community = await pool.query('SELECT founder_id FROM communities WHERE id = $1', [communityId]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (community.rows[0].founder_id !== req.userId) {
      return res.status(403).json({ error: 'Only the founder can remove members' });
    }
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    await pool.query('DELETE FROM community_members WHERE community_id = $1 AND user_id = $2', [communityId, targetUserId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/communities/:id/debates/:debateId — Delete post in community (founder only)
router.delete('/:id/debates/:debateId', authenticate, async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);

    const community = await pool.query('SELECT founder_id FROM communities WHERE id = $1', [communityId]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (community.rows[0].founder_id !== req.userId) {
      return res.status(403).json({ error: 'Only the founder can delete community posts' });
    }

    await pool.query('DELETE FROM debates WHERE id = $1 AND community_id = $2', [req.params.debateId, communityId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete community debate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
