const express = require('express');
const db = require('../config/db');
const { MESSAGE_COLUMNS, rowToMessage } = require('../utils/chatHelpers');
const { requireCommissionParticipant, getSessionUserId } = require('../utils/commissionAccess');
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
    console.error('[chat] GET messages error:', err);
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

    // Do not allow submissions after completion
    if (commissionStatus.toLowerCase() === 'completed') {
      return res.status(400).json({ success: false, code: 'COMPLETED', message: 'Commission is completed. Submissions are blocked.' });
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

    const [newRows] = await db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [result.insertId]);
    const out = rowToMessage(newRows[0]);

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      io.to(`commission_${commissionId}`).emit('stageSubmitted', { commissionId: Number(commissionId), message: out });
    } catch (e) {
      console.warn('[chat] socket emit failed (stageSubmitted):', e.message);
    }

    res.status(201).json({ success: true, message: out });
  } catch (err) {
    console.error('[chat] submit-stage error:', err);
    res.status(500).json({ success: false, code: 'DB_ERROR', message: 'Database error' });
  }
});

// Review a stage (customer → creator)
// POST /api/commissions/chat/:commissionId/review
// body: { decision: 'approve'|'reject', messageId?: number }
router.post('/:commissionId/review', async (req, res) => {
  const { commissionId } = req.params;
  const { decision, messageId } = req.body || {};

  if (!req.session?.user?.id) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const senderId = Number(req.session.user.id);

  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ success: false, code: 'BAD_DECISION', message: 'Invalid decision' });
  }

  try {
    const [commRows] = await db.query('SELECT Creator_ID, Customer_ID, Status FROM commissions WHERE Commission_ID = ?', [commissionId]);
    if (!commRows || commRows.length === 0) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Commission not found' });
    }
    const creatorId = Number(commRows[0].Creator_ID);
    const customerId = Number(commRows[0].Customer_ID);
    const currentStatus = String(commRows[0].Status || '').trim();

    if (senderId !== customerId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only customer can review stage' });
    }

    // if messageId is not provided, infer last submitted stage from creator
    let targetMessageId = messageId;
    if (!targetMessageId) {
      const [rows] = await db.query('SELECT id FROM messages WHERE commissionId = ? AND senderId = ? AND type = ? ORDER BY timestamp DESC LIMIT 1', [commissionId, creatorId, 'stage']);
      if (!rows || rows.length === 0) {
        return res.status(400).json({ success: false, code: 'NO_STAGE', message: 'No stage submission to review' });
      }
      targetMessageId = rows[0].id;
    }

    // Insert a system review message that references the stage messageId in content
    const reviewType = decision === 'approve' ? 'stage-approve' : 'stage-reject';
    const [ins] = await db.query(
      'INSERT INTO messages (senderId, receiverId, commissionId, type, content, status) VALUES (?, ?, ?, ?, ?, ?)',
      [customerId, creatorId, commissionId, reviewType, String(targetMessageId), 'unread']
    );

    let nextStatus = null;
    if (decision === 'approve') {
      const st = currentStatus.toLowerCase();
      if (st === 'sketch') nextStatus = 'Edits';
      else if (st === 'edits') nextStatus = 'Completed';

      if (nextStatus) {
        // Обновляем статус
        await db.query('UPDATE commissions SET Status = ? WHERE Commission_ID = ?', [nextStatus, commissionId]);

        // === НОВАЯ ЛОГИКА: Если статус стал Completed, сохраняем картинку ===
        if (nextStatus === 'Completed') {
          // 1. Находим сообщение, которое мы только что одобрили (там лежит картинка)
          const [msgRows] = await db.query('SELECT image FROM messages WHERE id = ?', [targetMessageId]);

          if (msgRows.length > 0 && msgRows[0].image) {
            // 2. Копируем BLOB картинки в таблицу commissions
            await db.query(
                'UPDATE commissions SET ResultImage = ? WHERE Commission_ID = ?',
                [msgRows[0].image, commissionId]
            );
            console.log(`[Review] Result image saved for commission ${commissionId}`);
          }
        }
      }
    }

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      io.to(`commission_${commissionId}`).emit('stageReview', { commissionId: Number(commissionId), messageId: Number(targetMessageId), decision, nextStatus });
    } catch (e) {
      console.warn('[chat] socket emit failed (stageReview):', e.message);
    }

    res.status(201).json({ success: true, decision, messageId: Number(targetMessageId), nextStatus });
  } catch (err) {
    console.error('[chat] review error:', err);
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
    console.log(`[chat] POST /${commissionId}/messages — sender=${senderId} type=${type} contentLen=${String(content || '').length}`);
    // 2. Fetch the commission to find the creator and customer
    const [commRows] = await db.query(
      'SELECT Creator_ID, Customer_ID FROM commissions WHERE Commission_ID = ?',
      [commissionId]
    );

    console.log('[chat] commission rows:', commRows && commRows.length, commRows && commRows[0]);

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

      console.log('[chat] inserting message: receiverId=', receiverId, 'type=', type);

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
        console.log('[chat] insert result:', result && { insertId: result.insertId, affectedRows: result.affectedRows });

        const [newMsgRows] = await db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [result.insertId]);
        const out = rowToMessage(newMsgRows[0]);
          // emit realtime event to room
          try {
            const { getIO } = require('../socket');
            const io = getIO();
            io.to(`commission_${commissionId}`).emit('newMessage', out);
          } catch (e) {
            console.warn('[chat] socket emit failed:', e.message);
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
      console.log('[chat] insert result:', result && { insertId: result.insertId, affectedRows: result.affectedRows });

      const [newMsgRows] = await db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [result.insertId]);
      const row = newMsgRows[0];
      const out = rowToMessage(row);
      try {
        const { getIO } = require('../socket');
        const io = getIO();
        io.to(`commission_${commissionId}`).emit('newMessage', out);
      } catch (e) {
        console.warn('[chat] socket emit failed:', e.message);
      }
      res.status(201).json({ success: true, message: out });
  } catch (err) {
    console.error('[chat] INSERT ERROR:', err); // Check your terminal for this log
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
    console.error('[chat] PATCH read error:', err);
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
    console.error('[chat] GET unread-count error:', err);
    res.status(500).json({ success: false, message: 'Error getting unread count' });
  }
});

module.exports = router;
