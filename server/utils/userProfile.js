// Дані поточного користувача для фронтенду.
// У сесії зберігаємо лише id/name/email; решту (зокрема аватар) читаємо з БД при кожному запиті,
// щоб сесія лишалась маленькою і не містила застарілих даних.
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { avatarUrl, imageVersion } = require('./imageUrls');

// Default avatar for accounts without their own image (served by /api/images/avatar/:id)
let DEFAULT_AVATAR_BUFFER = null;
try {
    DEFAULT_AVATAR_BUFFER = fs.readFileSync(path.join(__dirname, '..', 'assets', 'baseAvatar.png'));
} catch { /* no default avatar: the image route answers 404 */ }

function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Avatar bytes are not loaded here: only a short hash that versions the avatar URL
const USER_COLUMNS = 'Creator_ID, Name, Email, Other_Details, LEFT(MD5(Image), 8) AS imageVersion, styles, languages, likes, Instagram, Behance, TikTok, Availability, Role, Email_Verified, Language';

function toUserPayload(row) {
    return {
        id: row.Creator_ID,
        name: row.Name,
        email: row.Email,
        bio: row.Other_Details || '',
        // URL of /api/images/avatar/:id (default avatar is served there when none is set)
        profileImage: avatarUrl(row.Creator_ID, row.imageVersion || imageVersion(row.Image) || 'default'),
        styles: parseJsonArray(row.styles),
        languages: parseJsonArray(row.languages),
        likes: row.likes || 0,
        instagram: row.Instagram || '',
        behance: row.Behance || '',
        tiktok: row.TikTok || '',
        availability: row.Availability || 'open',
        role: row.Role || 'customer',
        emailVerified: Boolean(row.Email_Verified),
        language: row.Language || 'uk',
    };
}

async function loadUserPayload(userId) {
    const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM creators WHERE Creator_ID = ?`, [userId]);
    return rows[0] ? toUserPayload(rows[0]) : null;
}

// Мінімум, що лежить у сесії.
function toSessionUser(payload) {
    return { id: payload.id, name: payload.name, email: payload.email };
}

module.exports = { DEFAULT_AVATAR_BUFFER, toUserPayload, loadUserPayload, toSessionUser };
