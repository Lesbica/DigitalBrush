// Reviews of artists: a customer rates a completed commission (1–5 stars + optional text).
const express = require('express');
const db = require('../config/db');
const logger = require('../utils/logger');
const auth = require('../middleware/authMiddleware');
const { getSessionUserId } = require('../utils/commissionAccess');
const { avatarUrl } = require('../utils/imageUrls');

const router = express.Router();

// POST /api/reviews  { commissionId, rating, text }
router.post('/', auth, async (req, res) => {
    const userId = getSessionUserId(req);
    const commissionId = Number(req.body?.commissionId);
    const rating = Number(req.body?.rating);
    const text = req.body?.text === undefined || req.body?.text === null ? '' : String(req.body.text).trim();

    if (!Number.isInteger(commissionId) || commissionId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid commission id' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
    }
    if (text.length > 2000) {
        return res.status(400).json({ success: false, message: 'Review text is too long (max 2000)' });
    }

    try {
        const [[c]] = await db.query(
            'SELECT Customer_ID, Creator_ID, status FROM commissions WHERE Commission_ID = ?',
            [commissionId]
        );
        if (!c) return res.status(404).json({ success: false, message: 'Commission not found' });
        if (Number(c.Customer_ID) !== userId) {
            return res.status(403).json({ success: false, message: 'Only the customer can review this commission' });
        }
        if (String(c.status).toLowerCase() !== 'completed' || !c.Creator_ID) {
            return res.status(409).json({ success: false, message: 'Only completed commissions can be reviewed' });
        }

        const [result] = await db.query(
            'INSERT INTO reviews (Commission_ID, Artist_ID, Customer_ID, Rating, Text) VALUES (?, ?, ?, ?, ?)',
            [commissionId, c.Creator_ID, userId, rating, text || null]
        );
        res.status(201).json({ success: true, reviewId: result.insertId });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'This commission has already been reviewed' });
        }
        logger.error('Create review error:', err);
        res.status(500).json({ success: false, message: 'Error saving review' });
    }
});

// GET /api/reviews/artist/:id?page=&limit=  → { summary: { average, count }, reviews: [...] }
router.get('/artist/:id', async (req, res) => {
    const artistId = Number(req.params.id);
    if (!Number.isInteger(artistId) || artistId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid artist id' });
    }
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    try {
        const [[summary]] = await db.query(
            'SELECT COUNT(*) AS count, ROUND(AVG(Rating), 2) AS average FROM reviews WHERE Artist_ID = ?',
            [artistId]
        );
        const [rows] = await db.query(
            `SELECT r.Review_ID, r.Commission_ID, r.Rating, r.Text, r.Created_At,
                    r.Customer_ID, c.Name AS customer_name, LEFT(MD5(c.Image), 8) AS customer_image_version
               FROM reviews r
               JOIN creators c ON c.Creator_ID = r.Customer_ID
              WHERE r.Artist_ID = ?
              ORDER BY r.Created_At DESC, r.Review_ID DESC
              LIMIT ? OFFSET ?`,
            [artistId, limit, (page - 1) * limit]
        );
        res.json({
            success: true,
            summary: { average: summary.average === null ? null : Number(summary.average), count: summary.count },
            reviews: rows.map((r) => ({
                id: r.Review_ID,
                commissionId: r.Commission_ID,
                rating: r.Rating,
                text: r.Text || '',
                createdAt: r.Created_At,
                customer: {
                    id: r.Customer_ID,
                    name: r.customer_name,
                    avatar: avatarUrl(r.Customer_ID, r.customer_image_version || 'default'),
                },
            })),
            page,
            totalPages: Math.max(Math.ceil(summary.count / limit), 1),
        });
    } catch (err) {
        logger.error('List reviews error:', err);
        res.status(500).json({ success: false, message: 'Error fetching reviews' });
    }
});

module.exports = router;
