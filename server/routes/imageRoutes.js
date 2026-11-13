// Image endpoints. Lists and details return URLs to these instead of base64 data.
//   /api/images/painting/:id               public preview of a painting (max 1600px, WebP)
//   /api/images/painting/:id/extra/:imgId  public preview of an additional painting image
//   /api/images/avatar/:userId             public avatar
//   /api/images/commission/:id/:slot       commission references (ref, 2..5) and result — access-checked
//   /api/images/message/:id                chat image / stage submission — participants only
// Full-resolution originals of paintings are only available to buyers via /api/profile/download/:id.
const express = require('express');
const db = require('../config/db');
const { sendImage } = require('../utils/imageService');
const { getSessionUserId, getRole } = require('../utils/commissionAccess');
const { DEFAULT_AVATAR_BUFFER } = require('../utils/userProfile');

const router = express.Router();

const PUBLIC_IMMUTABLE = 'public, max-age=604800, immutable';
const PUBLIC_AVATAR = 'public, max-age=86400';
const PRIVATE = 'private, max-age=3600';
const PREVIEW_MAX = 1600;
// Unpaid customers only see a reduced copy of submitted stages (full file after payment)
const UNPAID_STAGE_MAX = 800;

const positiveInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

router.get('/painting/:id', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
        const [[row]] = await db.query('SELECT Image FROM paintings WHERE Painting_ID = ?', [id]);
        if (!row || !row.Image) return res.status(404).json({ success: false, message: 'Image not found' });
        return sendImage(req, res, row.Image, { cacheControl: PUBLIC_IMMUTABLE, maxWidth: PREVIEW_MAX });
    } catch (err) { next(err); }
});

router.get('/painting/:id/extra/:imageId', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        const imageId = positiveInt(req.params.imageId);
        if (!id || !imageId) return res.status(400).json({ success: false, message: 'Invalid id' });
        const [[row]] = await db.query(
            `SELECT i.Image FROM painting_images i
               JOIN paintings p ON p.Batch_ID = i.Batch_ID
              WHERE p.Painting_ID = ? AND i.Image_ID = ?`,
            [id, imageId]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Image not found' });
        return sendImage(req, res, row.Image, { cacheControl: PUBLIC_IMMUTABLE, maxWidth: PREVIEW_MAX });
    } catch (err) { next(err); }
});

router.get('/avatar/:userId', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.userId);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
        const [[row]] = await db.query('SELECT Image FROM creators WHERE Creator_ID = ?', [id]);
        if (!row) return res.status(404).json({ success: false, message: 'User not found' });
        const image = row.Image || DEFAULT_AVATAR_BUFFER;
        if (!image) return res.status(404).json({ success: false, message: 'Image not found' });
        return sendImage(req, res, image, { cacheControl: PUBLIC_AVATAR, maxWidth: 400 });
    } catch (err) { next(err); }
});

const COMMISSION_SLOTS = { ref: 'ReferenceImage', 2: 'Image2', 3: 'Image3', 4: 'Image4', 5: 'Image5', result: 'ResultImage' };

router.get('/commission/:id/:slot', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        const column = COMMISSION_SLOTS[req.params.slot];
        if (!id || !column) return res.status(400).json({ success: false, message: 'Invalid image' });

        const [[c]] = await db.query(
            `SELECT Customer_ID, Creator_ID, Type, status, is_paid, ${column} AS img FROM commissions WHERE Commission_ID = ?`,
            [id]
        );
        if (!c) return res.status(404).json({ success: false, message: 'Not found' });

        const role = getRole(c, getSessionUserId(req));
        const isOpenPublic = String(c.Type).toLowerCase() === 'public' && String(c.status).toLowerCase() === 'open';
        const allowed = column === 'ResultImage'
            ? role === 'creator' || (role === 'customer' && Boolean(c.is_paid))
            : Boolean(role) || isOpenPublic;
        if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden' });
        if (!c.img) return res.status(404).json({ success: false, message: 'Image not found' });

        return sendImage(req, res, c.img, { cacheControl: isOpenPublic && column !== 'ResultImage' ? 'public, max-age=3600' : PRIVATE, maxWidth: PREVIEW_MAX });
    } catch (err) { next(err); }
});

router.get('/message/:id', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
        const userId = getSessionUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const [[m]] = await db.query(
            `SELECT m.image, m.type, c.Customer_ID, c.Creator_ID, c.is_paid
               FROM messages m JOIN commissions c ON c.Commission_ID = m.commissionId
              WHERE m.id = ?`,
            [id]
        );
        if (!m || !m.image) return res.status(404).json({ success: false, message: 'Image not found' });
        const role = getRole(m, userId);
        if (!role) return res.status(403).json({ success: false, message: 'Forbidden' });

        const reduced = m.type === 'stage' && role === 'customer' && !m.is_paid;
        return sendImage(req, res, m.image, { cacheControl: PRIVATE, maxWidth: reduced ? UNPAID_STAGE_MAX : PREVIEW_MAX });
    } catch (err) { next(err); }
});

module.exports = router;
