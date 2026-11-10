// Дані поточного користувача для фронтенду.
// У сесії зберігаємо лише id/name/email; решту (зокрема аватар) читаємо з БД при кожному запиті,
// щоб сесія лишалась маленькою і не містила застарілих даних.
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { imageToDataUri } = require('./images');

let DEFAULT_AVATAR_BUFFER = null;
for (const p of [
    path.join(__dirname, '..', '..', 'src', 'assets', 'baseAvatar.png'),
    path.join(__dirname, '..', 'public', 'baseAvatar.png'),
]) {
    try {
        if (fs.existsSync(p)) { DEFAULT_AVATAR_BUFFER = fs.readFileSync(p); break; }
    } catch { /* ignore */ }
}
const DEFAULT_AVATAR_DATA_URI = DEFAULT_AVATAR_BUFFER ? imageToDataUri(DEFAULT_AVATAR_BUFFER) : 'img/icons/profile.jpg';

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

const USER_COLUMNS = 'Creator_ID, Name, Email, Other_Details, Image, styles, languages, likes, Instagram, Behance, TikTok';

function toUserPayload(row) {
    return {
        id: row.Creator_ID,
        name: row.Name,
        email: row.Email,
        bio: row.Other_Details || '',
        profileImage: imageToDataUri(row.Image) || DEFAULT_AVATAR_DATA_URI,
        styles: parseJsonArray(row.styles),
        languages: parseJsonArray(row.languages),
        likes: row.likes || 0,
        instagram: row.Instagram || '',
        behance: row.Behance || '',
        tiktok: row.TikTok || '',
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
