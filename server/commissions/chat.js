const express = require('express');
const logger = require('../utils/logger');
const db = require('../config/db');
const { MESSAGE_COLUMNS, rowToMessage } = require('../utils/chatHelpers');
const { requireCommissionParticipant, getSessionUserId } = require('../utils/commissionAccess');
const { isStage, normalizeStatus, reviewStage } = require('../services/commissionStages');
const events = require('../services/commissionEvents');
const { commissionEvents: notifyCommission } = require('../services/notifications');
const { detectImageMime: detectRealImage } = require('../config/multerConfig');

const router = express.Router();

// Get messages for a commission
// GET /api/commissions/chat/:commissionId/messages?limit=100&before=<messageId>
// Newest `limit` messages (default 200, max 500) older than `before`, returned oldest-first.
router.get('/:commissionId/messages', requireCommissionParticipant(), async (req, res) => {
  const { commissionId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const before = parseInt(req.query.before, 10);

  try {
    const params = [commissionId];
    let beforeSql = '';
    if (Number.isInteger(before) && before > 0) { beforeSql = 'AND id < ?'; params.push(before); }
    const [rows] = await db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE commissionId = ? ${beforeSql} ORDER BY id DESC LIMIT ?`,
      [...params, limit + 1]
    );
    const hasMore = rows.length > limit;
    const mapped = rows.slice(0, limit).reverse().map(rowToMessage);

    res.json({ success: true, messages: mapped, hasMore });
  } catch (err) {
    logger.error('[chat] GET messages error:', err);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

// Submit a stage image for review (creator → customer)
// POST /api/commissions/chat/:commissionId/submit-stage
// body: { image: dataUrl }
router.post('/:commissionId/submit-stage', async (req, res) => {
  const { commissionId } = req.params;
  const { image } = req.body || {};

  if (!req.session?.user?.id) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const senderId = Number(req.session.user.id);

  try {
    // load commission to determine roles
    const [commRows] = await db.query(
      'SELECT Creator_ID, Customer_ID, Status FROM commissions WHERE Commission_ID = ?',
      [commissionId]
    );
    if (!commRows || commRows.length === 0) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Commission not found' });
    }
    const creatorId = Number(commRows[0].Creator_ID);
    const customerId = Number(commRows[0].Customer_ID);
    const commissionStatus = String(commRows[0].Status || '').trim();

    // Only creator can submit stage; receiver must be customer
    if (senderId !== creatorId || !customerId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only creator can submit stage for review' });
    }

    // Stages can only be submitted while the work is in progress (Sketch / Lineart / Color / Final)
    if (!isStage(commissionStatus)) {
      return res.status(409).json({ success: false, code: 'NOT_IN_PROGRESS', message: `Stages cannot be submitted in status ${normalizeStatus(commissionStatus)}` });
    }

    if (typeof image !== 'string' || !image.startsWith('data:')) {
      return res.status(400).json({ success: false, code: 'BAD_IMAGE', message: 'Invalid image payload' });
    }

    const commaIndex = image.indexOf(',');
    const base64 = image.substring(commaIndex + 1);
    const buffer = Buffer.from(base64, 'base64');

    // 10 MB server-side limit safeguard
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Image is too large' });
    }
    if (!detectRealImage(buffer)) {
      return res.status(415).json({ success: false, code: 'BAD_IMAGE', message: 'Only JPG, PNG, GIF or WEBP images are allowed' });
    }

    const [result] = await db.query(
      'INSERT INTO messages (senderId, receiverId, commissionId, type, content, image, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [senderId, customerId, commissionId, 'stage', null, buffer, 'unread']
    );
    // The customer now has AUTO_APPROVE_DAYS to approve or request changes
    await db.query(
      `UPDATE commissions SET Review_State = 'pending', Stage_Submitted_At = NOW() WHERE Commission_ID = ?`,
      [commissionId]
    );

    const [newRows] = await db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [result.insertId]);
    const out = rowToMessage(newRows[0]);

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      io.to(`commission_${commissionId}`).emit('stageSubmitted', { commissionId: Number(commissionId), message: out });
    } catch (e) {
      logger.warn('[chat] socket emit failed (stageSubmitted):', e.message);
    }

    await notifyCommission.stageSubmitted(
      { Commission_ID: Number(commissionId), Customer_ID: customerId, Creator_ID: creatorId },
      normalizeStatus(commissionStatus)
    );

    res.status(201).json({ success: true, message: out });
  } catch (err) {
    logger.error('[chat] submit-stage error:', err);
    res.status(500).json({ success: false, code: 'DB_ERROR', message: 'Database error' });
  }
});

// Review a stage (customer → creator)
// POST /api/commissions/chat/:commissionId/review
// body: { decision: 'approve'|'reject', messageId?: number }
// approve moves Sketch -> Lineart -> Color -> Final -> Completed; reject marks "changes requested".
router.post('/:commissionId/review', requireCommissionParticipant(), async (req, res) => {
  const commissionId = Number(req.params.commissionId);
  const { decision, messageId } = req.body || {};

  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ success: false, code: 'BAD_DECISION', message: 'Invalid decision' });
  }
  if (req.commissionRole !== 'customer') {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only customer can review stage' });
  }

  try {
    const result = await reviewStage(commissionId, { decision, messageId });
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    events.stageReviewed(req.commission, { messageId: result.messageId, decision, nextStatus: result.nextStatus });
    await notifyCommission.stageReviewed(req.commission, { decision, nextStatus: result.nextStatus });
    res.status(201).json({ success: true, decision, messageId: Number(result.messageId), nextStatus: result.nextStatus });
  } catch (err) {
    logger.error('[chat] review error:', err);
    res.status(500).json({ success: false, code: 'DB_ERROR', message: 'Database error' });
  }
});

// Send a message
// POST /api/commissions/chat/:commissionId/messages
// body: { senderId, receiverId, type, content }
// POST /api/commissions/chat/:commissionId/messages
router.post('/:commissionId/messages', async (req, res) => {
  const { commissionId } = req.params;
  const { type = 'text', content } = req.body;

  // 1. Session check
  if (!req.session?.user?.id) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const senderId = Number(req.session.user.id);

  try {
    // 2. Fetch the commission to find the creator and customer
    const [commRows] = await db.query(
      'SELECT Creator_ID, Customer_ID FROM commissions WHERE Commission_ID = ?',
      [commissionId]
    );


    if (!commRows || commRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Commission not found' });
    }

    const creatorId = Number(commRows[0].Creator_ID);
    const customerId = Number(commRows[0].Customer_ID);

    // 3. Determine who gets the message
    let receiverId = null;
    if (senderId === creatorId) receiverId = customerId;
    else if (senderId === customerId) receiverId = creatorId;
    else return res.status(403).json({ success: false, message: 'Forbidden: You are not part of this commission' });

    // 4. Insert message (Letting MySQL handle the AUTO_INCREMENT ID and TIMESTAMP)
      if (!receiverId) return res.status(400).json({ success: false, message: 'No receiver for this commission' });


      // If it's an image message, convert data URI to binary for storage in `image` column
      if (type === 'image' && typeof content === 'string' && content.startsWith('data:')) {
        const commaIndex = content.indexOf(',');
        const base64 = content.substring(commaIndex + 1);
        const buffer = Buffer.from(base64, 'base64');
        const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
        if (buffer.length > MAX_IMAGE_BYTES) {
          return res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Image is too large' });
        }
        if (!detectRealImage(buffer)) {
          return res.status(415).json({ success: false, code: 'BAD_IMAGE', message: 'Only JPG, PNG, GIF or WEBP images are allowed' });
        }

        const [result] = await db.query(
          'INSERT INTO messages (senderId, receiverId, commissionId, type, content, image, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [senderId, receiverId, commissionId, type, null, buffer, 'unread']
        );

        const [newMsgRows] = await db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [result.insertId]);
        const out = rowToMessage(newMsgRows[0]);
          // emit realtime event to room
          try {
            const { getIO } = require('../socket');
            const io = getIO();
            io.to(`commission_${commissionId}`).emit('newMessage', out);
            await notifyCommission.message({ Commission_ID: Number(commissionId), Customer_ID: customerId, Creator_ID: creatorId }, senderId, type === 'text' ? content : null);
          } catch (e) {
            logger.warn('[chat] socket emit failed:', e.message);
          }
          res.status(201).json({ success: true, message: out });
        return;
      }

      // non-image messages (text)
      if (type !== 'text' || typeof content !== 'string' || !content.trim() || content.length > 5000) {
        return res.status(400).json({ success: false, message: 'Message must be non-empty text up to 5000 characters' });
      }
      const [result] = await db.query(
        'INSERT INTO messages (senderId, receiverId, commissionId, type, content, status) VALUES (?, ?, ?, ?, ?, ?)',
        [senderId, receiverId, commissionId, type, content, 'unread']
      );

      const [newMsgRows] = await db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [result.insertId]);
      const row = newMsgRows[0];
      const out = rowToMessage(row);
      try {
        const { getIO } = require('../socket');
        const io = getIO();
        io.to(`commission_${commissionId}`).emit('newMessage', out);
            await notifyCommission.message({ Commission_ID: Number(commissionId), Customer_ID: customerId, Creator_ID: creatorId }, senderId, type === 'text' ? content : null);
      } catch (e) {
        logger.warn('[chat] socket emit failed:', e.message);
      }
      res.status(201).json({ success: true, message: out });
  } catch (err) {
    logger.error('[chat] INSERT ERROR:', err); // Check your terminal for this log
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Mark a message as read
// PATCH /api/commissions/chat/:commissionId/messages/:id/read
router.patch('/:commissionId/messages/:id/read', requireCommissionParticipant(), async (req, res) => {
  const { id, commissionId } = req.params;

  try {
    // Позначити прочитаним може лише отримувач повідомлення
    const [result] = await db.query(
      'UPDATE messages SET status = ? WHERE id = ? AND commissionId = ? AND receiverId = ?',
      ['read', id, commissionId, req.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[chat] PATCH read error:', err);
    res.status(500).json({ success: false, message: 'Error updating message' });
  }
});

// Unread count for a user (optionally filtered by commission)
// GET /api/commissions/chat/unread-count/:userId?commissionId=123
router.get('/unread-count/:userId', async (req, res) => {
  const { commissionId } = req.query;
  const userId = getSessionUserId(req);

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  // Лічильник доступний лише для власного акаунта
  if (Number(req.params.userId) !== userId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    let sql = 'SELECT COUNT(*) AS cnt FROM messages WHERE receiverId = ? AND status = ?';
    const params = [userId, 'unread'];

    if (commissionId) {
      sql += ' AND commissionId = ?';
      params.push(commissionId);
    }

    const [rows] = await db.query(sql, params);
    res.json({ success: true, unread: rows[0].cnt });
  } catch (err) {
    logger.error('[chat] GET unread-count error:', err);
    res.status(500).json({ success: false, message: 'Error getting unread count' });
  }
});

module.exports = router;
