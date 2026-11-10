const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const {upload} = require('../config/multerConfig');
const { getIO } = require('../socket');
const {
    getSessionUserId,
    getRole,
    requireCommissionParticipant,
    loadCommissionAccess,
    emitToCommission,
} = require('../utils/commissionAccess');
const express = require('express');
const AdmZip = require('adm-zip');
const router = express.Router();

// new helpers to normalize images to data URIs
function bufferToDataUri(buffer, fallbackExt = 'png') {
    if (!buffer) return null;
    const ext = (fallbackExt || 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
}

function filePathToDataUri(filePath) {
    try {
        if (!filePath) return null;
        if (String(filePath).startsWith('data:')) return filePath; // already a data URI

        // try a few candidate locations relative to server
        const candidates = [
            path.join(__dirname, '..', 'public', filePath),
            path.join(__dirname, '..', filePath),
            path.join(__dirname, 'public', filePath),
            path.resolve(filePath)
        ];

        for (const c of candidates) {
            if (fs.existsSync(c)) {
                const buffer = fs.readFileSync(c);
                const ext = path.extname(c).slice(1) || 'png';
                return bufferToDataUri(buffer, ext);
            }
        }

        return null;
    } catch (err) {
        console.error('filePathToDataUri error:', err);
        return null;
    }
}

// 1. СТВОРЕННЯ ПУБЛІЧНОГО КОМІШЕНУ (із збереженням зображення в base64)
// Create a public commission (with up to 5 images)
router.post(
    '/create',
    upload.fields([
        {name: 'referenceImage', maxCount: 1},
        {name: 'image2', maxCount: 1},
        {name: 'image3', maxCount: 1},
        {name: 'image4', maxCount: 1},
        {name: 'image5', maxCount: 1}
    ]),
    async (req, res) => {
        try {
            // Отримуємо всі поля
            const {title, description, category, style, size, format, price, creatorId} = req.body;

            // 1. Перевірка авторизації
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
            }
            const user = req.session.user;

            // 2. Валідація обов'язкових полів
            if (!title || !description) {
                return res.status(400).json({ success: false, message: 'Title and description are required' });
            }

            // 3. Логіка визначення ТИПУ замовлення
            let commissionType = 'public'; // За замовчуванням
            let targetCreator = null;      // За замовчуванням

            // Перевіряємо, чи передали ID автора (і чи він не "null"/"undefined" рядком)
            if (creatorId && creatorId !== 'null' && creatorId !== 'undefined' && creatorId !== '') {
                targetCreator = parseInt(creatorId);

                // Перевірка на самозамовлення
                if (parseInt(user.id) === targetCreator) {
                    return res.status(400).json({ success: false, message: 'You cannot request a commission from yourself.' });
                }

                // Якщо все ок — тип стає direct
                commissionType = 'direct';
            }

            const fileToBase64 = (file) => {
                if (!file) return null;
                try {
                    const fileBuffer = fs.readFileSync(file.path);
                    const mimeType = file.mimetype || 'image/png';
                    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
                } catch (err) {
                    console.error(`Error reading ${file.originalname}:`, err);
                    return null;
                }
            }

            // 4. Обробка зображень
            const referenceImageBase64 = fileToBase64(req.files?.referenceImage?.[0]);
            const image2xBase64 = fileToBase64(req.files?.image2?.[0]);
            const image3xBase64 = fileToBase64(req.files?.image3?.[0]);
            const image4xBase64 = fileToBase64(req.files?.image4?.[0]);
            const image5xBase64 = fileToBase64(req.files?.image5?.[0]);

            // 5. SQL Запит
            const sql = `
                INSERT INTO commissions
                (Title, Description, Category, Style, Size, Format, Price,
                 ReferenceImage, Image2, Image3, Image4, Image5,
                 Type, Customer_ID, Creator_ID, Status, Created_At)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW())
            `;

            const values = [
                title,
                description,
                category || null,
                style || null,
                size || null,
                format || null,
                price || null,
                referenceImageBase64,
                image2xBase64,
                image3xBase64,
                image4xBase64,
                image5xBase64,
                commissionType, // 'public' або 'direct'
                user.id,        // Customer_ID (Замовник)
                targetCreator   // Creator_ID (Виконавець або NULL)
            ];

            const [result] = await db.query(sql, values);

            console.log(`Commission created. ID: ${result.insertId}, Type: ${commissionType}, Creator: ${targetCreator}`);

            res.status(201).json({
                success: true,
                message: `${commissionType} commission created successfully`,
                commissionId: result.insertId
            });

        } catch (err) {
            console.error('Error creating commission:', err);
            res.status(500).json({
                success: false,
                message: 'Database error',
                error: err.message
            });
        }
    }
);


// Updated GET route for Commissions.js backend
router.get('/public', async (req, res) => {
    const sql = `
        SELECT c.*,
               cr.Name  AS customer_name
        FROM commissions c
                 LEFT JOIN creators cr ON c.Customer_ID = cr.Creator_ID
        WHERE c.Type = 'public'
          AND LOWER(c.Status) = 'open'
        ORDER BY c.Created_At DESC
    `;

    try {
        const [results] = await db.query(sql);
        console.log(`Found ${results.length} commissions`);

        const commissionsWithImages = results.map((commission) => {
            let imageUrl = null;
            const ref = commission.ReferenceImage;

            console.log(`Commission ${commission.Commission_ID} (${commission.Title}):`);
            console.log(`  - ReferenceImage type: ${ref ? (Buffer.isBuffer(ref) ? 'Buffer' : typeof ref) : 'null'}`);

            if (ref) {
                let refAsString = null;

                // --- ПОЧАТОК ВИПРАВЛЕННЯ ---
                // 1. Перетворюємо буфер на рядок, якщо це буфер.
                // Ми припускаємо, що в БД зберігається рядок (Data URI або шлях до файлу).
                if (Buffer.isBuffer(ref)) {
                    refAsString = ref.toString('utf8');
                } else if (typeof ref === 'string') {
                    refAsString = ref;
                }

                // 2. Тепер працюємо з рядком
                if (refAsString) {
                    const trimmed = refAsString.trim();

                    // 3. Перевіряємо, чи це ВЖЕ готовий Data URI
                    if (trimmed.startsWith('data:image')) {
                        imageUrl = trimmed;
                        console.log(`  - Successfully processed data URI from DB`);
                    }
                    // 4. Якщо ні, припускаємо, що це шлях до файлу
                    else {
                        imageUrl = filePathToDataUri(trimmed);
                        console.log(`  - Tried file path, result: ${imageUrl ? 'success' : 'failed'}`);
                    }
                }
                // --- КІНЕЦЬ ВИПРАВЛЕННЯ ---

            } else {
                console.log(`  - No image data`);
            }

            // Return normalized commission object
            return {
                id: commission.Commission_ID,
                Commission_ID: commission.Commission_ID,
                Title: commission.Title,
                Description: commission.Description,
                Category: commission.Category,
                Style: commission.Style,
                Size: commission.Size,
                Format: commission.Format,
                Price: commission.Price,
                Type: commission.Type,
                Status: commission.Status,
                Customer_ID: commission.Customer_ID,
                Creator_ID: commission.Creator_ID,
                Created_At: commission.Created_At,
                customer_name: commission.customer_name,
                imageUrl: imageUrl // This is the key field for frontend
            };
        });

        console.log(`Sending ${commissionsWithImages.length} commissions to frontend`);
        res.json({success: true, commissions: commissionsWithImages});
    } catch (err) {
        console.error('Error fetching public commissions:', err);
        res.status(500).json({success: false, message: 'Error fetching commissions'});
    }
});

router.get('/my', async (req, res) => {
    // 1. Перевірка авторизації
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user.id;

    // 2. SQL: вибираємо комісії, де юзер є замовником АБО виконавцем
    const sql = `
        SELECT c.*,
               cust.Name as CustomerName,
               creat.Name as CreatorName
        FROM commissions c
        LEFT JOIN creators cust ON c.Customer_ID = cust.Creator_ID
        LEFT JOIN creators creat ON c.Creator_ID = creat.Creator_ID
        WHERE c.Customer_ID = ? OR c.Creator_ID = ?
        ORDER BY c.Created_At DESC
    `;

    try {
        const [results] = await db.query(sql, [userId, userId]);

        // 3. Нормалізація зображень (використовуємо ту ж логіку, що і в public route)
        const myCommissions = results.map((commission) => {
            let imageUrl = null;
            const ref = commission.ReferenceImage;

            if (ref) {
                let refAsString = null;
                if (Buffer.isBuffer(ref)) {
                    refAsString = ref.toString('utf8');
                } else if (typeof ref === 'string') {
                    refAsString = ref;
                }

                if (refAsString) {
                    const trimmed = refAsString.trim();
                    if (trimmed.startsWith('data:image')) {
                        imageUrl = trimmed;
                    } else {
                        // Використовуємо допоміжну функцію filePathToDataUri, яка є у вашому файлі
                        imageUrl = filePathToDataUri(trimmed);
                    }
                }
            }

            // Нормалізуємо статус під новий enum (Title Case)
            // Берем з поля в любом регистре (MySQL может вернуть как Status/status)
            const sourceStatus = commission.Status ?? commission.status ?? '';
            const rawStatus = String(sourceStatus || '').toLowerCase();
            const normalizedStatus =
                rawStatus === 'sketch' ? 'Sketch' :
                rawStatus === 'edits' ? 'Edits' :
                rawStatus === 'completed' ? 'Completed' :
                rawStatus === 'cancelled' ? 'Cancelled' :
                'Open';

            return {
                ...commission,
                Status: normalizedStatus,
                status: normalizedStatus,
                ReferenceImage: imageUrl // Оновлюємо поле для фронтенду
            };
        });

        res.json({ success: true, commissions: myCommissions });

    } catch (err) {
        console.error('Error fetching user commissions:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get full details (including all images) - normalized same as public GET
router.get('/:id', async (req, res) => {
    const {id} = req.params;

    const sql = `
        SELECT Commission_ID,
               Title,
               Description,
               Category,
               Style,
               Size,
               Format,
               Price,
               ReferenceImage,
               Image2,
               Image3,
               Image4,
               Image5,
               Customer_ID,
               Creator_ID,
               Status,
               Type,
               Created_At,
               Updated_At,
               is_paid,
               ResultImage
        FROM commissions
        WHERE Commission_ID = ?
        LIMIT 1
    `;

    try {
        const [rows] = await db.query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({success: false, message: 'Commission not found'});
        }

        const commission = rows[0];

        // Доступ: учасники бачать усе; інші — лише відкриті публічні комішени (без результату).
        const userId = getSessionUserId(req);
        const role = getRole(commission, userId);
        const isOpenPublic = String(commission.Type || '').toLowerCase() === 'public'
            && String(commission.Status || '').toLowerCase() === 'open';
        if (!role && !isOpenPublic) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        // Готовий результат — виконавцю завжди, замовнику лише після оплати.
        const canSeeResult = role === 'creator' || (role === 'customer' && Boolean(commission.is_paid));

        // normalize any stored image value to a data URI or public URL (same logic as list endpoint)
        const toDataUri = (value) => {
            if (!value) return null;
            try {
                let valueAsString = null;

                // 1. Спершу спробуємо перетворити на рядок, якщо це буфер
                if (Buffer.isBuffer(value)) {
                    valueAsString = value.toString('utf8');
                } else if (typeof value === 'string') {
                    valueAsString = value;
                }

                // 2. Тепер обробляємо рядок
                if (valueAsString) {
                    const trimmed = valueAsString.trim();

                    // 2a. Це ВЖЕ готовий Data URI?
                    if (trimmed.startsWith('data:image')) {
                        return trimmed;
                    }

                    // 2b. Це "чистий" Base64 рядок без префікса?
                    const cleaned = trimmed.replace(/[\r\n\s]+/g, '');
                    if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length > 50) {
                        return `data:image/png;base64,${cleaned}`;
                    }

                    // 2c. Це шлях до файлу?
                    const fileConverted = filePathToDataUri(trimmed);
                    if (fileConverted) return fileConverted;

                    // 2d. Це URL?
                    if (/^https?:\/\//i.test(trimmed)) return trimmed;
                }

                // 3. (Fallback) Якщо це був буфер, але не схожий на рядок,
                //    спробуємо обробити його як "сирі" дані зображення.
                if (Buffer.isBuffer(value)) {
                    return bufferToDataUri(value, 'png'); // Виклик вашого bufferToDataUri згори
                }

                return null;
            } catch (err) {
                console.error(`[toDataUri] error converting image value for commission ${id}:`, err);
                return null;
            }
        };

        const image1 = toDataUri(commission.ReferenceImage);
        const image2 = toDataUri(commission.Image2);
        const image3 = toDataUri(commission.Image3);
        const image4 = toDataUri(commission.Image4);
        const image5 = toDataUri(commission.Image5);
        const resultImageUri = canSeeResult ? toDataUri(commission.ResultImage) : null;

        const images = [image1, image2, image3, image4, image5].filter(Boolean);

        console.log(`[GET /${id}] images normalized: ${images.length}`);

        // normalize status too (source may be Status or status)
        const sourceStatus = commission.Status ?? commission.status ?? '';
        const rawStatus = String(sourceStatus || '').toLowerCase();
        const normalizedStatus =
            rawStatus === 'sketch' ? 'Sketch' :
            rawStatus === 'edits' ? 'Edits' :
            rawStatus === 'completed' ? 'Completed' :
            rawStatus === 'cancelled' ? 'Cancelled' :
            'Open';

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
                resultImage: resultImageUri,
                Customer_ID: commission.Customer_ID,
                Creator_ID: commission.Creator_ID,
                status: normalizedStatus,
                Status: normalizedStatus,
                images,   // array of normalized image sources (data: URIs or URLs)
                image1,   // individual normalized fields (may be null)
                image2,
                image3,
                image4,
                image5
            }
        });
    } catch (err) {
        console.error('Error fetching commission details:', err);
        res.status(500).json({success: false, message: 'Error fetching commission details'});
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
        console.error('Error accepting commission:', err);
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
        console.error(err);
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

        // 3. Збираємо файли
        const filesToZip = [];

        // Допоміжна функція
        const addFile = (buffer, filename) => {
            if (buffer) filesToZip.push({ name: filename, buffer: buffer });
        };

        // --- ИСПРАВЛЕНИЕ: Берем ResultImage ---
        // Если есть ResultImage (наше новое поле), берем его
        if (commission.ResultImage) {
            addFile(commission.ResultImage, 'Final_Result.png');
        }
        // Если ResultImage пустое (старые заказы), пробуем взять из Image2-Image5
        else {
            if (commission.Image2) addFile(commission.Image2, 'result_1.png');
            if (commission.Image3) addFile(commission.Image3, 'result_2.png');
            if (commission.Image4) addFile(commission.Image4, 'result_3.png');
            if (commission.Image5) addFile(commission.Image5, 'result_4.png');
        }

        // Если все еще пусто — возможно, это просто Image (если логика сохраняла туда)
        if (filesToZip.length === 0 && commission.Image) {
            // Но осторожно, Image может быть референсом. Проверьте логику.
            // Обычно для Completed ResultImage должно быть заполнено.
        }

        // Якщо нічого не знайдено
        if (filesToZip.length === 0) {
            return res.status(404).send('No finished files found to download (ResultImage is empty).');
        }

        // 4. Віддаємо файли
        if (filesToZip.length === 1) {
            // Якщо файл один - віддаємо його напряму
            const file = filesToZip[0];
            res.set('Content-Type', 'image/png');
            res.set('Content-Disposition', `attachment; filename="${file.name}"`);
            return res.send(file.buffer);
        } else {
            // Якщо файлів декілька - пакуємо в ZIP
            const zip = new AdmZip();
            filesToZip.forEach(f => {
                zip.addFile(f.name, f.buffer);
            });

            const zipBuffer = zip.toBuffer();
            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', `attachment; filename="commission_${commissionId}_files.zip"`);
            return res.send(zipBuffer);
        }

    } catch (err) {
        console.error('Download error:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

