// Перетворення збережених у БД зображень на data URI для фронтенду.
// Нові дані зберігаються як бінарні BLOB; старі записи можуть містити data URI або base64 як текст.
const { detectImageMime } = require('../config/multerConfig');

function imageToDataUri(value) {
    if (!value) return null;

    if (Buffer.isBuffer(value)) {
        const mime = detectImageMime(value);
        if (mime) return `data:${mime};base64,${value.toString('base64')}`;
        value = value.toString('utf8'); // legacy: текст (data URI / base64 / URL) у BLOB
    }
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const cleaned = trimmed.replace(/\s+/g, '');
    if (cleaned.length > 50 && /^[A-Za-z0-9+/=]+$/.test(cleaned)) {
        const mime = detectImageMime(Buffer.from(cleaned.slice(0, 64), 'base64'));
        if (mime) return `data:${mime};base64,${cleaned}`;
    }
    // Шляхи до файлів на диску більше не читаємо (це дозволяло б читати довільні файли сервера).
    return null;
}

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

// Бінарні дані + розширення для скачування (з урахуванням legacy data URI).
function imageToFile(value) {
    if (!value) return null;
    let buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
    let mime = detectImageMime(buffer);
    if (!mime) {
        const text = buffer.toString('utf8').trim();
        const m = /^data:(image\/[a-z+.-]+);base64,(.*)$/is.exec(text);
        if (!m) return null;
        buffer = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
        mime = detectImageMime(buffer) || m[1];
    }
    return { buffer, mime, ext: EXT_BY_MIME[mime] || 'png' };
}

module.exports = { imageToDataUri, imageToFile };
