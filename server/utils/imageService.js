// Sends stored images over HTTP: resized WebP previews (sharp), ETag/304, cache headers,
// and a small in-memory cache of resized results.
const crypto = require('crypto');
const sharp = require('sharp');
const { detectImageMime } = require('../config/multerConfig');
const { imageToFile } = require('./images');

const ALLOWED_WIDTHS = [200, 400, 600, 800, 1200, 1600];
const CACHE_BUDGET_BYTES = 64 * 1024 * 1024;

// LRU by insertion order of a Map; evicts oldest entries once over the byte budget
const cache = new Map();
let cacheBytes = 0;
function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    cache.delete(key);
    cache.set(key, hit);
    return hit;
}
function cacheSet(key, value) {
    if (value.data.length > CACHE_BUDGET_BYTES / 4) return;
    if (cache.has(key)) cacheBytes -= cache.get(key).data.length;
    cache.set(key, value);
    cacheBytes += value.data.length;
    for (const [k, v] of cache) {
        if (cacheBytes <= CACHE_BUDGET_BYTES) break;
        cache.delete(k);
        cacheBytes -= v.data.length;
    }
}

function pickWidth(requested, maxWidth) {
    const n = Number.parseInt(requested, 10);
    const wanted = Number.isFinite(n) && n > 0 ? n : maxWidth;
    const limit = Math.min(wanted, maxWidth);
    // smallest allowed width that is >= limit (so arbitrary values cannot blow up the cache)
    return ALLOWED_WIDTHS.find((w) => w >= limit && w <= maxWidth) || ALLOWED_WIDTHS.filter((w) => w <= maxWidth).pop() || ALLOWED_WIDTHS[0];
}

/**
 * @param stored   Buffer from the DB (binary, or legacy data-URI text)
 * @param options  { cacheControl, maxWidth = 1600 }
 */
async function sendImage(req, res, stored, { cacheControl, maxWidth = 1600 } = {}) {
    const file = imageToFile(stored);
    if (!file) return res.status(404).json({ success: false, message: 'Image not found' });

    const width = pickWidth(req.query.w, maxWidth);
    const etag = `"${crypto.createHash('md5').update(file.buffer).digest('hex')}-${width}"`;

    res.set('Cache-Control', cacheControl);
    res.set('ETag', etag);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Vary', 'Cookie');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    let out = cacheGet(etag);
    if (!out) {
        try {
            const data = await sharp(file.buffer, { failOn: 'none' })
                .rotate()
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();
            out = { type: 'image/webp', data };
        } catch (err) {
            // Unreadable for sharp: send the original bytes with their real type
            out = { type: detectImageMime(file.buffer) || file.mime, data: file.buffer };
        }
        cacheSet(etag, out);
    }
    res.set('Content-Type', out.type);
    return res.send(out.data);
}

module.exports = { sendImage, pickWidth, ALLOWED_WIDTHS };
