const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { optionalAuth } = authenticate;
const { parsePagination } = require('../utils/helpers');

const router = express.Router();

// GET /api/debates/:debateId/comments — Get comments for a debate (threaded)
router.get('/:debateId/comments', optionalAuth, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const debateId = parseInt(req.params.debateId);

    // Get top-level comments (no parent) with reply count
    const result = await pool.query(
      `SELECT c.id, c.content, c.parent_id, c.created_at,
        u.id AS user_id, u.username, u.category AS user_category,
        (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id)::int AS reply_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.debate_id = $1 AND c.parent_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocker_id = $2 AND blocked_id = c.user_id)
             OR (blocker_id = c.user_id AND blocked_id = $2)
        )
      ORDER BY c.created_at ASC
      LIMIT $3 OFFSET $4`,
      [debateId, req.userId, limit, offset]
    );

    // Get total comment count for this debate
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM comments WHERE debate_id = $1',
      [debateId]
    );

    res.json({
      comments: result.rows,
      total_count: countResult.rows[0].count,
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/debates/:debateId/comments/:commentId/replies — Get replies to a comment
router.get('/:debateId/comments/:commentId/replies', optionalAuth, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const result = await pool.query(
      `SELECT c.id, c.content, c.parent_id, c.created_at,
        u.id AS user_id, u.username, u.category AS user_category,
        (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id)::int AS reply_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocker_id = $2 AND blocked_id = c.user_id)
             OR (blocker_id = c.user_id AND blocked_id = $2)
        )
      ORDER BY c.created_at ASC
      LIMIT $3 OFFSET $4`,
      [parseInt(req.params.commentId), req.userId, limit, offset]
    );

    res.json({ replies: result.rows });
  } catch (err) {
    console.error('Get replies error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/debates/:debateId/comments — Post a comment or reply
router.post('/:debateId/comments', authenticate, async (req, res) => {
  try {
    const { content, parent_id } = req.body;
    const debateId = parseInt(req.params.debateId);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (content.trim().length > 1000) {
      return res.status(400).json({ error: 'Comment must be under 1000 characters' });
    }

    // Verify debate exists
    const debate = await pool.query('SELECT id, user_id FROM debates WHERE id = $1', [debateId]);
    if (debate.rows.length === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // If replying, verify parent comment exists and belongs to this debate
    if (parent_id) {
      const parent = await pool.query(
        'SELECT id, user_id FROM comments WHERE id = $1 AND debate_id = $2',
        [parent_id, debateId]
      );
      if (parent.rows.length === 0) {
        return res.status(400).json({ error: 'Parent comment not found' });
      }

      // Notify the parent comment author (if not self)
      if (parent.rows[0].user_id !== req.userId) {
        await pool.query(
          "INSERT INTO notifications (user_id, type, from_user_id) VALUES ($1, 'comment_reply', $2)",
          [parent.rows[0].user_id, req.userId]
        );
      }
    }

    // Notify the debate author (if not self and not a reply — replies notify the parent comment author instead)
    if (!parent_id && debate.rows[0].user_id !== req.userId) {
      await pool.query(
        "INSERT INTO notifications (user_id, type, from_user_id) VALUES ($1, 'debate_comment', $2)",
        [debate.rows[0].user_id, req.userId]
      );
    }

    const result = await pool.query(
      'INSERT INTO comments (user_id, debate_id, parent_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, debateId, parent_id || null, content.trim()]
    );

    // Return the comment with user info
    const comment = await pool.query(
      `SELECT c.id, c.content, c.parent_id, c.created_at,
        u.id AS user_id, u.username, u.category AS user_category,
        0 AS reply_count
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(comment.rows[0]);
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/debates/:debateId/comments/:commentId — Delete own comment
router.delete('/:debateId/comments/:commentId', authenticate, async (req, res) => {
  try {
    const comment = await pool.query('SELECT user_id FROM comments WHERE id = $1', [parseInt(req.params.commentId)]);
    if (comment.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only the comment author or debate author can delete
    const debate = await pool.query('SELECT user_id FROM debates WHERE id = $1', [parseInt(req.params.debateId)]);
    const isCommentAuthor = comment.rows[0].user_id === req.userId;
    const isDebateAuthor = debate.rows.length > 0 && debate.rows[0].user_id === req.userId;

    if (!isCommentAuthor && !isDebateAuthor) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // CASCADE deletes replies too
    await pool.query('DELETE FROM comments WHERE id = $1', [parseInt(req.params.commentId)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
