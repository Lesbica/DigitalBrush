// Current user's notifications.
const express = require('express');
const db = require('../config/db');
const logger = require('../utils/logger');
const auth = require('../middleware/authMiddleware');
const { getSessionUserId } = require('../utils/commissionAccess');
const { renderContent } = require('../services/notifications');

const router = express.Router();
router.use(auth);

// Text in the reader's current language; rows without Content (older ones) keep the stored text
function texts(r, lang) {
    if (!r.Content) return { title: r.Title, body: r.Body };
    try {
        return renderContent(lang, r.Content);
    } catch {
        return { title: r.Title, body: r.Body };
    }
}

const toItem = (r, lang) => ({
    id: r.Notification_ID,
    type: r.Type,
    ...texts(r, lang),
    link: r.Link,
    commissionId: r.Commission_ID,
    createdAt: r.Created_At,
    read: Boolean(r.Read_At),
});

// GET /api/notifications?limit=20&unreadOnly=true
router.get('/', async (req, res) => {
    const userId = getSessionUserId(req);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const unreadOnly = req.query.unreadOnly === 'true';
    try {
        const [rows] = await db.query(
            `SELECT * FROM notifications WHERE User_ID = ? ${unreadOnly ? 'AND Read_At IS NULL' : ''}
              ORDER BY Created_At DESC, Notification_ID DESC LIMIT ?`,
            [userId, limit]
        );
        const [[{ unread }]] = await db.query('SELECT COUNT(*) AS unread FROM notifications WHERE User_ID = ? AND Read_At IS NULL', [userId]);
        res.json({ success: true, unread, notifications: rows.map((r) => toItem(r, req.lang)) });
    } catch (err) {
        logger.error('List notifications error:', err);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
});

router.get('/unread-count', async (req, res) => {
    try {
        const [[{ unread }]] = await db.query('SELECT COUNT(*) AS unread FROM notifications WHERE User_ID = ? AND Read_At IS NULL', [getSessionUserId(req)]);
        res.json({ success: true, unread });
    } catch (err) {
        logger.error('Unread count error:', err);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
});

router.patch('/:id/read', async (req, res) => {
    try {
        const [r] = await db.query(
            'UPDATE notifications SET Read_At = COALESCE(Read_At, NOW()) WHERE Notification_ID = ? AND User_ID = ?',
            [req.params.id, getSessionUserId(req)]
        );
        if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.json({ success: true });
    } catch (err) {
        logger.error('Read notification error:', err);
        res.status(500).json({ success: false, message: 'Error updating notification' });
    }
});

router.post('/read-all', async (req, res) => {
    try {
        await db.query('UPDATE notifications SET Read_At = NOW() WHERE User_ID = ? AND Read_At IS NULL', [getSessionUserId(req)]);
        res.json({ success: true });
    } catch (err) {
        logger.error('Read-all notifications error:', err);
        res.status(500).json({ success: false, message: 'Error updating notifications' });
    }
});

module.exports = router;
