const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { optionalAuth } = authenticate;
const { isValidCategory } = require('../utils/helpers');

const router = express.Router();

// POST /api/debates — Create debate
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, category, options, community_id, expires_at } = req.body;

    if (!category || !isValidCategory(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }
    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' });
    }
    if (options.some(o => !o || typeof o !== 'string' || o.trim().length === 0)) {
      return res.status(400).json({ error: 'All options must be non-empty strings' });
    }

    // Validate expires_at if provided
    let expiresAtValue = null;
    if (expires_at) {
      const d = new Date(expires_at);
      if (isNaN(d.getTime()) || d <= new Date()) {
        return res.status(400).json({ error: 'Expiry date must be in the future' });
      }
      expiresAtValue = d.toISOString();
    }

    if (community_id) {
      const membership = await pool.query(
        "SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2 AND status = 'member'",
        [community_id, req.userId]
      );
      if (membership.rows.length === 0) {
        return res.status(403).json({ error: 'Must be a community member to post' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const debateResult = await client.query(
        'INSERT INTO debates (user_id, community_id, title, category, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.userId, community_id || null, title || null, category, expiresAtValue]
      );
      const debate = debateResult.rows[0];

      const optionValues = options.map((label, i) => `(${debate.id}, $${i + 1}, ${i})`).join(', ');
      const optionResult = await client.query(
        `INSERT INTO debate_options (debate_id, label, position) VALUES ${optionValues} RETURNING *`,
        options.map(o => o.trim())
      );

      await client.query('COMMIT');

      // Get author info for response
      const author = await client.query('SELECT username, category FROM users WHERE id = $1', [req.userId]);

      res.status(201).json({
        ...debate,
        author_id: req.userId,
        author_username: author.rows[0].username,
        author_category: author.rows[0].category,
        options: optionResult.rows.map(o => ({ ...o, vote_count: 0 })),
        total_votes: 0,
        my_vote_option_id: null,
        my_vote_created_at: null,
        is_pinned: false,
        comment_count: 0,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create debate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Shared debate SELECT with vote timestamp and pin status
const DEBATE_FIELDS = `
  SELECT d.id, d.title, d.category, d.community_id, d.created_at, d.expires_at,
    u.id AS author_id, u.username AS author_username, u.category AS author_category,
    (SELECT COALESCE(json_agg(json_build_object(
      'id', o.id, 'label', o.label, 'position', o.position,
      'vote_count', (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id)::int
    ) ORDER BY o.position), '[]') FROM debate_options o WHERE o.debate_id = d.id) AS options,
    (SELECT COUNT(*) FROM votes v WHERE v.debate_id = d.id)::int AS total_votes,
    (SELECT option_id FROM votes v WHERE v.user_id = $2 AND v.debate_id = d.id) AS my_vote_option_id,
    (SELECT created_at FROM votes v WHERE v.user_id = $2 AND v.debate_id = d.id) AS my_vote_created_at,
    EXISTS(SELECT 1 FROM pins WHERE user_id = $2 AND debate_id = d.id) AS is_pinned,
    (SELECT COUNT(*) FROM comments WHERE debate_id = d.id)::int AS comment_count,
    (SELECT name FROM communities WHERE id = d.community_id) AS community_name
  FROM debates d
  JOIN users u ON d.user_id = u.id
`;

// GET /api/debates/:id — Get single debate
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `${DEBATE_FIELDS} WHERE d.id = $1`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get debate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/debates/:id — Delete debate (owner or community founder)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const debate = await pool.query('SELECT * FROM debates WHERE id = $1', [req.params.id]);
    if (debate.rows.length === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    const d = debate.rows[0];
    let authorized = d.user_id === req.userId;

    if (!authorized && d.community_id) {
      const community = await pool.query('SELECT founder_id FROM communities WHERE id = $1', [d.community_id]);
      if (community.rows.length > 0 && community.rows[0].founder_id === req.userId) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Not authorized to delete this debate' });
    }

    await pool.query('DELETE FROM debates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete debate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/debates/:id/vote — Vote on a debate
router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { option_id } = req.body;
    if (!option_id) {
      return res.status(400).json({ error: 'option_id is required' });
    }

    // Check if debate is expired
    const debate = await pool.query('SELECT expires_at FROM debates WHERE id = $1', [req.params.id]);
    if (debate.rows.length === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }
    if (debate.rows[0].expires_at && new Date(debate.rows[0].expires_at) <= new Date()) {
      return res.status(403).json({ error: 'Voting has ended for this debate' });
    }

    const option = await pool.query(
      'SELECT id FROM debate_options WHERE id = $1 AND debate_id = $2',
      [option_id, req.params.id]
    );
    if (option.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid option for this debate' });
    }

    await pool.query(
      'INSERT INTO votes (user_id, debate_id, option_id) VALUES ($1, $2, $3)',
      [req.userId, req.params.id, option_id]
    );

    await pool.query(
      'INSERT INTO seen_posts (user_id, debate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.id]
    );

    // Update streak: increment if last vote was yesterday, reset to 1 if broken or first vote,
    // no change if they already voted today
    const streakResult = await pool.query(
      `UPDATE users SET
        current_streak = CASE
          WHEN last_vote_date = CURRENT_DATE THEN current_streak
          WHEN last_vote_date = CURRENT_DATE - 1 THEN current_streak + 1
          ELSE 1
        END,
        longest_streak = GREATEST(longest_streak, CASE
          WHEN last_vote_date = CURRENT_DATE THEN current_streak
          WHEN last_vote_date = CURRENT_DATE - 1 THEN current_streak + 1
          ELSE 1
        END),
        last_vote_date = CURRENT_DATE
      WHERE id = $1
      RETURNING current_streak, longest_streak`,
      [req.userId]
    );

    res.json({
      success: true,
      current_streak: streakResult.rows[0].current_streak,
      longest_streak: streakResult.rows[0].longest_streak,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already voted on this debate' });
    }
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/debates/:id/vote — Delete your vote
router.delete('/:id/vote', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM votes WHERE user_id = $1 AND debate_id = $2 RETURNING id',
      [req.userId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No vote found to delete' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete vote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/debates/:id/pin — Pin a debate
router.post('/:id/pin', authenticate, async (req, res) => {
  try {
    const debateId = parseInt(req.params.id);
    const debate = await pool.query('SELECT user_id FROM debates WHERE id = $1', [debateId]);
    if (debate.rows.length === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // Determine pin type: creator or voter
    const isCreator = debate.rows[0].user_id === req.userId;
    const hasVoted = await pool.query('SELECT 1 FROM votes WHERE user_id = $1 AND debate_id = $2', [req.userId, debateId]);

    if (!isCreator && hasVoted.rows.length === 0) {
      return res.status(403).json({ error: 'You must be the creator or have voted to pin this debate' });
    }

    const pinType = isCreator ? 'created' : 'voted';

    await pool.query(
      'INSERT INTO pins (user_id, debate_id, pin_type) VALUES ($1, $2, $3) ON CONFLICT (user_id, debate_id) DO NOTHING',
      [req.userId, debateId, pinType]
    );

    res.json({ success: true, pin_type: pinType });
  } catch (err) {
    console.error('Pin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/debates/:id/pin — Unpin a debate
router.delete('/:id/pin', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM pins WHERE user_id = $1 AND debate_id = $2', [req.userId, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Unpin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/debates/:id/report — Report debate
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    await pool.query(
      'INSERT INTO reports (reporter_id, reported_debate_id, reason) VALUES ($1, $2, $3)',
      [req.userId, parseInt(req.params.id), reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Report debate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/debates/:id/seen — Mark debate as seen
router.post('/:id/seen', authenticate, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO seen_posts (user_id, debate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark seen error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
