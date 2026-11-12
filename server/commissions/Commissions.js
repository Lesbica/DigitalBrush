const db = require('../config/db');
const logger = require('../utils/logger');
const { imageUpload, withImageUpload } = require('../config/multerConfig');
const auth = require('../middleware/authMiddleware');
const { imageToFile } = require('../utils/images');
const { commissionImageUrl, LIST_WIDTH } = require('../utils/imageUrls');
const { getIO } = require('../socket');
const {
    getSessionUserId,
    getRole,
    requireCommissionParticipant,
    loadCommissionAccess,
    emitToCommission,
} = require('../utils/commissionAccess');
const express = require('express');
const router = express.Router();

function validateCommissionFields(body) {
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title || !description) return { error: 'Title and description are required' };
    if (title.length > 255) return { error: 'Title is too long (max 255)' };
    if (description.length > 5000) return { error: 'Description is too long (max 5000)' };

    let price = null;
    if (body.price !== undefined && body.price !== null && body.price !== '') {
        price = Number(body.price);
        if (!Number.isFinite(price) || price < 0 || price > 1e7) return { error: 'Price must be a number from 0 to 10 000 000' };
        price = Math.round(price * 100) / 100;
    }

    const short = (v) => (v ? String(v).trim().slice(0, 100) || null : null);
    return {
        values: {
            title, description, price,
            category: short(body.category), style: short(body.style),
            size: short(body.size), format: short(body.format),
        },
    };
}

// 1. СТВОРЕННЯ КОМІШЕНУ (public або direct, до 5 зображень; зберігаються як бінарні BLOB)
router.post(
    '/create',
    auth,
    withImageUpload(imageUpload.fields([
        {name: 'referenceImage', maxCount: 1},
        {name: 'image2', maxCount: 1},
        {name: 'image3', maxCount: 1},
        {name: 'image4', maxCount: 1},
        {name: 'image5', maxCount: 1}
    ])),
    async (req, res) => {
        try {
            const user = req.session.user;
            const { values, error } = validateCommissionFields(req.body || {});
            if (error) return res.status(400).json({ success: false, message: error });

            // Тип замовлення: direct, якщо вказано конкретного художника
            let commissionType = 'public';
            let targetCreator = null;
            const { creatorId } = req.body;
            if (creatorId && creatorId !== 'null' && creatorId !== 'undefined' && creatorId !== '') {
                targetCreator = Number(creatorId);
                if (!Number.isInteger(targetCreator) || targetCreator <= 0) {
                    return res.status(400).json({ success: false, message: 'Invalid artist id' });
                }
                if (Number(user.id) === targetCreator) {
                    return res.status(400).json({ success: false, message: 'You cannot request a commission from yourself.' });
                }
                const [artist] = await db.query('SELECT 1 FROM creators WHERE Creator_ID = ?', [targetCreator]);
                if (artist.length === 0) {
                    return res.status(404).json({ success: false, message: 'Artist not found' });
                }
                commissionType = 'direct';
            }

            const file = (name) => req.files?.[name]?.[0]?.buffer || null;

            const [result] = await db.query(`
                INSERT INTO commissions
                (Title, Description, Category, Style, Size, Format, Price,
                 ReferenceImage, Image2, Image3, Image4, Image5,
                 Type, Customer_ID, Creator_ID, Status, Created_At)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', NOW())
            `, [
                values.title, values.description, values.category, values.style,
                values.size, values.format, values.price,
                file('referenceImage'), file('image2'), file('image3'), file('image4'), file('image5'),
                commissionType, user.id, targetCreator
            ]);

            res.status(201).json({
                success: true,
                message: `${commissionType} commission created successfully`,
                commissionId: result.insertId
            });
        } catch (err) {
            logger.error('Error creating commission:', err);
            res.status(500).json({ success: false, message: 'Database error' });
        }
    }
);


// Non-BLOB commission columns plus flags telling which images exist
const COMMISSION_COLUMNS = `
    c.Commission_ID, c.Title, c.Description, c.Category, c.Style, c.Size, c.Format, c.Price,
    c.status AS Status, c.Type, c.Customer_ID, c.Creator_ID, c.Created_At, c.Updated_At, c.is_paid,
    c.ReferenceImage IS NOT NULL AS hasRef, c.Image2 IS NOT NULL AS has2, c.Image3 IS NOT NULL AS has3,
    c.Image4 IS NOT NULL AS has4, c.Image5 IS NOT NULL AS has5, c.ResultImage IS NOT NULL AS hasResult`;

function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    return raw === 'sketch' ? 'Sketch'
        : raw === 'edits' ? 'Edits'
            : raw === 'completed' ? 'Completed'
                : raw === 'cancelled' ? 'Cancelled'
                    : 'Open';
}

// Public open commissions. Optional: category, q (title), page (1-based) + limit (max 100).
// Without page/limit returns everything (up to 500).
router.get('/public', async (req, res) => {
    const where = [`c.Type = 'public'`, `c.status = 'Open'`];
    const params = [];
    if (req.query.category) { where.push('c.Category = ?'); params.push(String(req.query.category)); }
    if (req.query.q) {
        where.push('c.Title LIKE ?');
        params.push(`%${String(req.query.q).slice(0, 100).replace(/[\\%_]/g, (ch) => '\\' + ch)}%`);
    }
    const paginated = req.query.page !== undefined || req.query.limit !== undefined;
    const limit = paginated ? Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 24, 1), 100) : 500;
    const page = paginated ? Math.max(Number.parseInt(req.query.page, 10) || 1, 1) : 1;

    try {
        const whereSql = where.join(' AND ');
        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM commissions c WHERE ${whereSql}`, params);
        const [results] = await db.query(`
            SELECT ${COMMISSION_COLUMNS}, cr.Name AS customer_name
              FROM commissions c
              LEFT JOIN creators cr ON c.Customer_ID = cr.Creator_ID
             WHERE ${whereSql}
             ORDER BY c.Created_At DESC, c.Commission_ID DESC
             LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);

        const commissions = results.map((c) => ({
            id: c.Commission_ID,
            Commission_ID: c.Commission_ID,
            Title: c.Title,
            Description: c.Description,
            Category: c.Category,
            Style: c.Style,
            Size: c.Size,
            Format: c.Format,
            Price: c.Price,
            Type: c.Type,
            Status: normalizeStatus(c.Status),
            Customer_ID: c.Customer_ID,
            Creator_ID: c.Creator_ID,
            Created_At: c.Created_At,
            customer_name: c.customer_name,
            imageUrl: c.hasRef ? commissionImageUrl(c.Commission_ID, 'ref', LIST_WIDTH) : null,
        }));

        res.json({ success: true, commissions, total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) });
    } catch (err) {
        logger.error('Error fetching public commissions:', err);
        res.status(500).json({ success: false, message: 'Error fetching commissions' });
    }
});

router.get('/my', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = req.session.user.id;

    try {
        const [results] = await db.query(`
            SELECT ${COMMISSION_COLUMNS}, cust.Name AS CustomerName, creat.Name AS CreatorName
              FROM commissions c
              LEFT JOIN creators cust ON c.Customer_ID = cust.Creator_ID
              LEFT JOIN creators creat ON c.Creator_ID = creat.Creator_ID
             WHERE c.Customer_ID = ? OR c.Creator_ID = ?
             ORDER BY c.Created_At DESC`, [userId, userId]);

        const myCommissions = results.map(({ hasRef, has2, has3, has4, has5, hasResult, ...c }) => {
            const status = normalizeStatus(c.Status);
            return {
                ...c,
                Status: status,
                status,
                hasResult: Boolean(hasResult),
                ReferenceImage: hasRef ? commissionImageUrl(c.Commission_ID, 'ref', LIST_WIDTH) : null,
            };
        });

        res.json({ success: true, commissions: myCommissions });
    } catch (err) {
        logger.error('Error fetching user commissions:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Details. Images are returned as URLs of /api/images/commission/:id/:slot (access-checked there too)
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });

    try {
        const [rows] = await db.query(`SELECT ${COMMISSION_COLUMNS} FROM commissions c WHERE c.Commission_ID = ? LIMIT 1`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Commission not found' });
        }
        const commission = rows[0];

        // Доступ: учасники бачать усе; інші — лише відкриті публічні комішени (без результату).
        const role = getRole(commission, getSessionUserId(req));
        const isOpenPublic = String(commission.Type || '').toLowerCase() === 'public'
            && String(commission.Status || '').toLowerCase() === 'open';
        if (!role && !isOpenPublic) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        // Готовий результат — виконавцю завжди, замовнику лише після оплати.
        const canSeeResult = role === 'creator' || (role === 'customer' && Boolean(commission.is_paid));

        const url = (flag, slot) => (flag ? commissionImageUrl(id, slot) : null);
        const image1 = url(commission.hasRef, 'ref');
        const image2 = url(commission.has2, 2);
        const image3 = url(commission.has3, 3);
        const image4 = url(commission.has4, 4);
        const image5 = url(commission.has5, 5);
        const status = normalizeStatus(commission.Status);

        res.json({
            success: true,
            commission: {
                id: commission.Commission_ID,
                title: commission.Title,
                description: commission.Description,
                category: commission.Category,
                style: commission.Style,
                size: commission.Size,
                format: commission.Format,
                price: commission.Price,
                is_paid: commission.is_paid,
                resultImage: canSeeResult ? url(commission.hasResult, 'result') : null,
                Customer_ID: commission.Customer_ID,
                Creator_ID: commission.Creator_ID,
                status,
                Status: status,
                images: [image1, image2, image3, image4, image5].filter(Boolean),
                image1,
                image2,
                image3,
                image4,
                image5
            }
        });
    } catch (err) {
        logger.error('Error fetching commission details:', err);
        res.status(500).json({ success: false, message: 'Error fetching commission details' });
    }
});


// PATCH endpoint to accept a commission
router.patch('/:id/accept', async (req, res) => {
    const { id } = req.params;
    const user = req.session.user;

    // Перевірка сесії
    if (!user || !user.id) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    // Той, хто приймає замовлення - це Виконавець (Creator)
    const creatorId = user.id;

    try {
        const sql = `
            UPDATE commissions
            SET Status = 'Sketch',
                Creator_ID = ?
            WHERE Commission_ID = ?
              AND LOWER(Status) = 'open'
              AND Customer_ID != ?
              AND (Creator_ID IS NULL OR Creator_ID = ?)
        `;

        // Direct-комішен може прийняти лише художник, якому його адресовано
        const [result] = await db.query(sql, [creatorId, id, creatorId, creatorId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Commission not found, already accepted, or you are trying to accept your own commission'
            });
        }

        // Эмитим событие изменения статуса/исполнителя в комнату комиссии
        try {
            const updated = await loadCommissionAccess(id);
            if (updated) {
                emitToCommission(getIO(), updated, 'statusUpdated', { commissionId: Number(id), status: 'Sketch' });
            }
        } catch (e) {
            // socket not initialized — игнорируем
        }

        res.json({ success: true, message: `Commission ${id} accepted by artist ${creatorId}` });
    } catch (err) {
        logger.error('Error accepting commission:', err);
        res.status(500).json({ success: false, message: 'Database error while accepting commission' });
    }
});

// Ручна зміна статусу. Переходи Sketch → Edits → Completed робить лише флоу рев'ю етапів
// (POST /chat/:id/review), тому тут дозволене тільки скасування учасником неоплаченого комішену.
router.patch('/:id/status', requireCommissionParticipant('id'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const commission = req.commission;

    if (String(status || '').toLowerCase() !== 'cancelled') {
        return res.status(400).json({ success: false, message: 'Only cancellation is allowed via this endpoint' });
    }

    const current = String(commission.Status || '').toLowerCase();
    if (current === 'completed' || current === 'cancelled') {
        return res.status(409).json({ success: false, message: `Commission is already ${commission.Status}` });
    }
    if (commission.is_paid) {
        return res.status(409).json({ success: false, message: 'Paid commission cannot be cancelled' });
    }

    try {
        await db.query(`UPDATE commissions SET Status = 'Cancelled', Updated_At = NOW() WHERE Commission_ID = ?`, [id]);

        try {
            emitToCommission(getIO(), commission, 'statusUpdated', { commissionId: Number(id), status: 'Cancelled' });
        } catch (e) {
            // socket not initialized — пропускаем
        }

        res.json({ success: true, status: 'Cancelled' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Роут для скачування файлів виконаного замовлення
router.get('/download/:id', async (req, res) => {
    const commissionId = req.params.id;
    const userId = req.session.user?.Creator_ID || req.session.user?.id;

    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    try {
        // 1. Отримуємо дані про комішн, щоб перевірити доступ та статус оплати
        const [rows] = await db.query(
            `SELECT * FROM commissions WHERE Commission_ID = ?`,
            [commissionId]
        );

        if (rows.length === 0) {
            return res.status(404).send('Commission not found');
        }

        const commission = rows[0];

        // Перевіряємо, чи користувач є учасником цього замовлення
        const isCustomer = (commission.Customer_ID === userId);
        const isCreator = (commission.Creator_ID === userId);

        if (!isCustomer && !isCreator) {
            return res.status(403).send('Access denied');
        }

        // 2. Якщо це замовник - перевіряємо, чи замовлення оплачене
        // (Автору дозволяємо скачувати завжди)
        if (isCustomer && !commission.is_paid) {
            return res.status(402).send('Payment required. Please pay to download files.');
        }

        // 3. Віддаємо готовий результат (ResultImage зберігається після схвалення фінального етапу).
        // Референси замовника (Image2..Image5) результатом не є, тому їх не віддаємо.
        const file = imageToFile(commission.ResultImage);
        if (!file) {
            return res.status(404).send('No finished files found to download (ResultImage is empty).');
        }
        res.set('Content-Type', file.mime);
        res.set('Content-Disposition', `attachment; filename="commission_${commissionId}_result.${file.ext}"`);
        return res.send(file.buffer);

    } catch (err) {
        logger.error('Download error:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

