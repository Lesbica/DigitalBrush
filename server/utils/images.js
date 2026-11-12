// Читання збережених у БД зображень (для скачування та /api/images).
// Нові дані зберігаються як бінарні BLOB; старі записи можуть містити data URI або base64 як текст.
const { detectImageMime } = require('../config/multerConfig');

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

module.exports = { imageToFile };
