const multer = require('multer');

// Вимоги ТЗ: JPG/PNG/GIF до 10 МБ (WEBP теж приймаємо — його віддають більшість редакторів).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Визначає тип за вмістом файлу, а не за тим, що заявив браузер.
function detectImageMime(buffer) {
    if (!buffer || buffer.length < 12) return null;
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
}

class UploadError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Файли тримаємо в пам'яті й пишемо в БД; на диск сервера нічого не потрапляє.
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new UploadError(415, 'Only JPG, PNG, GIF or WEBP images are allowed'));
        }
        cb(null, true);
    },
});

/**
 * Обгортає multer-middleware: помилки завантаження → зрозуміла JSON-відповідь замість 500,
 * плюс перевірка сигнатури кожного файлу.
 */
function withImageUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
                    const message = err.code === 'LIMIT_FILE_SIZE'
                        ? 'Image is larger than 10 MB'
                        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
                            ? `Too many images (max ${MAX_FILES})`
                            : err.message;
                    return res.status(status).json({ success: false, message });
                }
                if (err instanceof UploadError) {
                    return res.status(err.status).json({ success: false, message: err.message });
                }
                return next(err);
            }

            const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
            for (const f of files) {
                const real = detectImageMime(f.buffer);
                if (!real) {
                    return res.status(415).json({ success: false, message: `${f.originalname} is not a valid image` });
                }
                f.detectedMime = real;
            }
            next();
        });
    };
}

module.exports = { imageUpload, withImageUpload, detectImageMime, MAX_IMAGE_BYTES, MAX_FILES };
