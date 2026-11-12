const express = require('express');
const logger = require('../utils/logger');
const db = require('../config/db');
const { imageUpload, withImageUpload, detectImageMime } = require('../config/multerConfig');
const auth = require('../middleware/authMiddleware');
const AdmZip = require('adm-zip');
const { loadUserPayload, toSessionUser } = require('../utils/userProfile');
const { sendVerificationEmail } = require('../services/accountTokens');
const { paintingImageUrl } = require('../utils/imageUrls');

const router = express.Router();

router.post('/update-profile', auth, withImageUpload(imageUpload.single('profileImage')), async (req, res) => {
    // 1. Отримуємо ID користувача
    const userId = req.session.user?.Creator_ID || req.session.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    try {
        // 2. Отримуємо дані з фронтенду
        const { username, email, description, instagram, behance, tiktok, styleTags, languageTags, availability, role } = req.body;

        // Валідація (ТЗ: біо до 500 символів)
        if (username !== undefined && String(username).trim().length > 50) {
            return res.status(400).json({ success: false, message: 'Username is too long (max 50)' });
        }
        if (email !== undefined && String(email).trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }
        if (role !== undefined && !['artist', 'customer'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Role must be artist or customer' });
        }
        if (availability !== undefined && !['open', 'busy', 'vacation'].includes(availability)) {
            return res.status(400).json({ success: false, message: 'Availability must be open, busy or vacation' });
        }
        if (description !== undefined && String(description).length > 500) {
            return res.status(400).json({ success: false, message: 'Bio is too long (max 500 characters)' });
        }
        for (const [field, value] of [['instagram', instagram], ['behance', behance], ['tiktok', tiktok]]) {
            if (value !== undefined && String(value).length > 255) {
                return res.status(400).json({ success: false, message: `${field} link is too long` });
            }
        }
        const tagsError = (raw, name) => {
            if (raw === undefined || raw === null || raw === '') return null;
            let arr;
            try { arr = JSON.parse(raw); } catch { return `${name} must be a JSON array`; }
            if (!Array.isArray(arr) || arr.length > 30 || arr.some((t) => typeof t !== 'string' || t.length > 50)) {
                return `${name} must be an array of up to 30 short strings`;
            }
            return null;
        };
        const tagErr = tagsError(styleTags, 'styleTags') || tagsError(languageTags, 'languageTags');
        if (tagErr) return res.status(400).json({ success: false, message: tagErr });

        // 3. Перевіряємо, чи не зайнятий email/username кимось іншим
        const [existingUsers] = await db.query(
            `SELECT Creator_ID, Name, Email FROM creators 
             WHERE (Name = ? OR Email = ?) AND Creator_ID != ?`,
            [username, email, userId]
        );

        if (existingUsers.length > 0) {
            const conflict = existingUsers[0];
            if (conflict.Name === username) {
                return res.status(409).json({ success: false, message: 'This username is already taken.' });
            }
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }

        // 4. Отримуємо поточні дані користувача (щоб не стерти те, що не прийшло)
        const [currentUserResult] = await db.query('SELECT * FROM creators WHERE Creator_ID = ?', [userId]);
        const currentUser = currentUserResult[0];

        if (!currentUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Підготовка даних для запису
        const finalName = username && username.trim() !== '' ? username : currentUser.Name;
        const finalEmail = email && email.trim() !== '' ? email : currentUser.Email;
        const finalBio = description !== undefined ? description : currentUser.Other_Details;

        const finalInsta = instagram !== undefined ? instagram : currentUser.Instagram;
        const finalBehance = behance !== undefined ? behance : currentUser.Behance;
        const finalTikTok = tiktok !== undefined ? tiktok : currentUser.TikTok;

        // Обробка картинки
        const finalImage = req.file ? req.file.buffer : currentUser.Image;

        // ПРОСТЕ ЗБЕРЕЖЕННЯ СТИЛІВ ТА МОВ
        // Фронтенд надсилає їх як рядок '["Retro", "Realism"]', ми так і записуємо в БД.
        // Якщо прийшло undefined, залишаємо старе значення.
        const finalStyles = styleTags ? styleTags : currentUser.styles;
        const finalLanguages = languageTags ? languageTags : currentUser.languages;

        // 5. Оновлюємо таблицю (ОДИН простий запит)
        await db.query(
            `UPDATE creators
             SET Name = ?, Email = ?, Other_Details = ?,
                 Instagram = ?, Behance = ?, TikTok = ?,
                 Image = ?, styles = ?, languages = ?, Availability = ?, Role = ?
             WHERE Creator_ID = ?`,
            [
                finalName, finalEmail, finalBio,
                finalInsta, finalBehance, finalTikTok,
                finalImage, finalStyles, finalLanguages,
                availability || currentUser.Availability || 'open',
                role || currentUser.Role || 'customer',
                userId
            ]
        );

        // Changed email must be confirmed again (unless verification is turned off)
        if (finalEmail.toLowerCase() !== String(currentUser.Email || '').toLowerCase()
            && process.env.REQUIRE_EMAIL_VERIFICATION !== 'false') {
            await db.query('UPDATE creators SET Email_Verified = 0 WHERE Creator_ID = ?', [userId]);
            await sendVerificationEmail({ id: userId, name: finalName, email: finalEmail });
        }

        // 6. Свіжі дані з БД; у сесії — лише id/name/email
        const payload = await loadUserPayload(userId);
        req.session.user = toSessionUser(payload);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: payload
        });

    } catch (err) {
        logger.error('Profile update error:', err);
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// Роут для картин, він не змінювався, але лишаємо його тут
router.get('/getuserpaintings', auth, async (req, res) => {
    const userId = req.session.user?.Creator_ID || req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

    try {
        const [rows] = await db.query(
            `SELECT 
                 Painting_ID AS id,
                 Title AS title,
                 Description AS description,
                 Price AS price,
                 Style AS style,
                 COALESCE(Likes, 0) AS Likes
             FROM paintings 
             WHERE Creator_ID = ?`,
            [userId]
        );

        const paintings = rows.map((row) => {
            const image_url = paintingImageUrl(row.id);
            const likesNum = Number(row.Likes) || 0;
            return {
                id: row.id,
                title: row.title,
                description: row.description,
                price: row.price,
                style: row.style,
                image_url,
                // нормализуем лайки для фронта
                Likes: likesNum,
                likes: likesNum,
            };
        });

        res.json({ success: true, paintings });
    } catch (err) {
        logger.error('Error fetching user paintings:', err);
        res.status(500).json({ success: false, message: 'Error fetching user paintings' });
    }
});

router.get('/getboughtpaintings', auth, async (req, res) => {
    const userId = req.session.user?.Creator_ID || req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

    try {
        // Объединяем user_purchases с paintings
        const [rows] = await db.query(
            `SELECT 
                 p.Painting_ID AS id,
                 p.Title AS title,
                 p.Description AS description,
                 p.Price AS price,
                 p.Style AS style,
                 COALESCE(p.likes, 0) AS likes,
                 c.Name AS artistName,
                 c.Creator_ID AS artistId,
                 p.Category
             FROM user_purchases up
             JOIN paintings p ON up.Painting_ID = p.Painting_ID
             JOIN creators c ON p.Creator_ID = c.Creator_ID
             WHERE up.User_ID = ?`,
            [userId]
        );

        const paintings = rows.map((row) => {
            const image_url = paintingImageUrl(row.id);
            return {
                id: row.id,
                title: row.title,
                description: row.description,
                price: row.price,
                style: row.style,
                image_url,
                likes: row.likes,
                artistName: row.artistName,
                artistId: row.artistId,
                Category: row.Category
            };
        });

        res.json({ success: true, paintings });
    } catch (err) {
        logger.error('Error fetching bought paintings:', err);
        res.status(500).json({ success: false, message: 'Error fetching bought paintings' });
    }
});

// 2. Проверка владения картиной (для модального окна)
router.get('/check-ownership/:paintingId', auth, async (req, res) => {
    const userId = req.session.user?.Creator_ID || req.session.user?.id;
    const { paintingId } = req.params;
    if (!userId) return res.json({ owned: false });

    try {
        const [rows] = await db.query(
            'SELECT 1 FROM user_purchases WHERE User_ID = ? AND Painting_ID = ?',
            [userId, paintingId]
        );
        res.json({ owned: rows.length > 0 });
    } catch (err) {
        logger.error('Ownership check error:', err);
        res.status(500).json({ owned: false });
    }
});

// 3. Скачивание картины (или архива)
router.get('/download/:paintingId', auth, async (req, res) => {
    const userId = req.session.user?.Creator_ID || req.session.user?.id;
    const { paintingId } = req.params;

    try {
        // Проверка: действительно ли пользователь купил эту картину
        const [ownership] = await db.query(
            'SELECT 1 FROM user_purchases WHERE User_ID = ? AND Painting_ID = ?',
            [userId, paintingId]
        );

        if (ownership.length === 0) {
            return res.status(403).send('Access denied: You have not purchased this painting.');
        }

        // Получаем данные о картине (включая Batch_ID для поиска доп. изображений)
        const [paintingRows] = await db.query(
            'SELECT Title, Image, Batch_ID FROM paintings WHERE Painting_ID = ?',
            [paintingId]
        );

        if (paintingRows.length === 0) return res.status(404).send('Painting not found');

        const painting = paintingRows[0];
        const imagesToDownload = [];

        // Добавляем основное изображение
        const ext = (buf) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[detectImageMime(buf)] || 'png');
        if (painting.Image) {
            imagesToDownload.push({ name: `${painting.Title}_main.${ext(painting.Image)}`, buffer: painting.Image });
        }

        // Если есть Batch_ID, ищем дополнительные изображения
        if (painting.Batch_ID) {
            const [extraImages] = await db.query(
                'SELECT Image FROM painting_images WHERE Batch_ID = ?',
                [painting.Batch_ID]
            );
            extraImages.forEach((row, index) => {
                imagesToDownload.push({ name: `${painting.Title}_${index + 1}.${ext(row.Image)}`, buffer: row.Image });
            });
        }

        if (imagesToDownload.length === 0) {
            return res.status(404).send('No image data found');
        }

        if (imagesToDownload.length === 1) {
            // Одно изображение - отдаем как файл
            const img = imagesToDownload[0];
            const safeName = img.name;

            // ИСПРАВЛЕНИЕ: кодируем имя файла и для старого параметра filename
            const encodedName = encodeURIComponent(safeName);

            res.set('Content-Type', detectImageMime(img.buffer) || 'application/octet-stream');
            // Используем encodedName в обоих местах, чтобы избежать недопустимых символов
            res.set('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
            return res.send(img.buffer);
        } else {
            // Несколько изображений - пакуем в ZIP
            const zip = new AdmZip();
            imagesToDownload.forEach(img => {
                zip.addFile(img.name, img.buffer);
            });

            const zipBuffer = zip.toBuffer();
            const safeName = `${painting.Title}_files.zip`;

            // ИСПРАВЛЕНИЕ: кодируем имя файла и для старого параметра filename
            const encodedName = encodeURIComponent(safeName);

            res.set('Content-Type', 'application/zip');
            // Используем encodedName в обоих местах
            res.set('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
            return res.send(zipBuffer);
        }

    } catch (err) {
        logger.error('Download error:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;