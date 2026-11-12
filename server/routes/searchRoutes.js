const express = require('express');
const logger = require('../utils/logger');
const db = require('../config/db');
const router = express.Router();
const { avatarUrl } = require('../utils/imageUrls');

// Екрануємо % і _ , щоб користувацький запит шукався буквально.
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

// Поиск художников по имени или стилю
// NOTE: этот роут смонтирован в app.js как app.use('/api/search', searchRoutes)
// поэтому конечный путь здесь должен быть БЕЗ префикса /api
router.get('/creators', async (req, res) => {
    const query = String(req.query.q || '').trim().slice(0, 100);

    if (!query) {
        return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    try {
        // Стилі зберігаються в creators.styles як JSON-рядок (напр. '["Retro","Realism"]'),
        // окремих таблиць styles/creator_styles у БД немає.
        const pattern = `%${escapeLike(query)}%`;
        const [results] = await db.query(`
            SELECT Creator_ID, Name, Other_Details, LEFT(MD5(Image), 8) AS imageVersion, styles
            FROM creators
            WHERE Name LIKE ? OR styles LIKE ?
            ORDER BY Name
            LIMIT 50
        `, [pattern, pattern]);

        const formatted = results.map(c => {
            let styles = [];
            try {
                const parsed = JSON.parse(c.styles || '[]');
                if (Array.isArray(parsed)) styles = parsed.map(String);
            } catch { /* legacy non-JSON value */ }
            return {
                id: c.Creator_ID,
                name: c.Name,
                bio: c.Other_Details || '',
                styles,
                profileImage: avatarUrl(c.Creator_ID, c.imageVersion || 'default')
            };
        });

        res.json({ success: true, count: formatted.length, creators: formatted });
    } catch (err) {
        logger.error('Error searching creators:', err);
        res.status(500).json({ success: false, message: 'Database error during search' });
    }
});

module.exports = router;
