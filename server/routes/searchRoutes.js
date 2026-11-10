const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Поиск художников по имени или стилю
// NOTE: этот роут смонтирован в app.js как app.use('/api/search', searchRoutes)
// поэтому конечный путь здесь должен быть БЕЗ префикса /api
router.get('/creators', async (req, res) => {
    const query = req.query.q?.trim() || '';

    if (!query) {
        return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    try {
        const [results] = await db.query(`
            SELECT DISTINCT
                c.Creator_ID,
                c.Name,
                c.Other_Details,
                c.Image
            FROM creators c
                     LEFT JOIN creator_styles cs ON c.Creator_ID = cs.Creator_ID
                     LEFT JOIN styles s ON cs.Style_ID = s.Style_ID
            WHERE c.Name LIKE CONCAT('%', ?, '%')
               OR s.Style_Name LIKE CONCAT('%', ?, '%')
                LIMIT 50
        `, [query, query]);

        const formatted = results.map(c => {
            const img = c.Image
                ? (Buffer.isBuffer(c.Image)
                    ? `data:image/jpeg;base64,${c.Image.toString('base64')}`
                    : c.Image)
                : 'img/icons/profile.jpg';
            return {
                id: c.Creator_ID,
                name: c.Name,
                bio: c.Other_Details || '',
                profileImage: img
            };
        });

        res.json({ success: true, count: formatted.length, creators: formatted });
    } catch (err) {
        console.error('Error searching creators:', err);
        res.status(500).json({ success: false, message: 'Database error during search' });
    }
});

module.exports = router;