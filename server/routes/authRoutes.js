const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Preload default avatar from project assets (frontend repo) once
let DEFAULT_AVATAR_BUFFER = null;
let DEFAULT_AVATAR_DATA_URI = null;
try {
    const candidatePaths = [
        // typical location in this project
        path.join(__dirname, '..', '..', 'src', 'assets', 'baseAvatar.png'),
        // fallback: if copied to server/public later
        path.join(__dirname, '..', 'public', 'baseAvatar.png')
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            const buf = fs.readFileSync(p);
            DEFAULT_AVATAR_BUFFER = buf;
            DEFAULT_AVATAR_DATA_URI = `data:image/png;base64,${buf.toString('base64')}`;
            break;
        }
    }
} catch (e) {
    console.warn('Default avatar preload failed:', e.message);
}

function detectImageMime(buffer) {
    if (!buffer || buffer.length < 4) return 'image/jpeg';
    // JPEG magic: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    // PNG magic: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    // GIF magic: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif';
    return 'image/jpeg';
}

// Register
router.post('/register', async (req, res) => {
    const { username, email, password, birthday } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        // Insert with default avatar image (if available)
        const sql = `INSERT INTO creators (Name, Email, Password, Birthday, Image) VALUES (?, ?, ?, ?, ?)`;
        await db.query(sql, [username, email, hash, birthday || null, DEFAULT_AVATAR_BUFFER]);
        res.status(201).json({ success: true, message: 'User registered' });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ success: false, message: 'Database error during registration' });
    }
});

// Check email
router.post('/check-email', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT Email FROM creators WHERE Email = ?', [req.body.email]);
        res.json({ exists: rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Database error while checking email' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Додаємо вибірку нових полів: styles, languages, likes
        const [rows] = await db.query('SELECT * FROM creators WHERE Email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'User not found' });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.Password);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect password' });

        const imageData = user.Image;
        let profileImage;
        if (Buffer.isBuffer(imageData)) {
            // If DB stores a data URI string as BLOB, prefer using it directly
            try {
                const asString = imageData.toString('utf8');
                if (asString.startsWith('data:image')) {
                    profileImage = asString;
                } else {
                    const mime = detectImageMime(imageData);
                    profileImage = `data:${mime};base64,${imageData.toString('base64')}`;
                }
            } catch {
                const mime = detectImageMime(imageData);
                profileImage = `data:${mime};base64,${imageData.toString('base64')}`;
            }
        } else if (typeof imageData === 'string' && imageData.trim()) {
            profileImage = imageData;
        } else {
            profileImage = DEFAULT_AVATAR_DATA_URI || 'img/icons/profile.jpg';
        }

        // ПАРСИНГ масивів (як ми робили раніше)
        let userStyles = [];
        let userLanguages = [];
        try {
            if (user.styles) userStyles = (typeof user.styles === 'string') ? JSON.parse(user.styles) : user.styles;
            if (user.languages) userLanguages = (typeof user.languages === 'string') ? JSON.parse(user.languages) : user.languages;
        } catch (e) {
            console.error("JSON parse error:", e);
        }

        // Нова сесія після логіну (захист від session fixation)
        await new Promise((resolve, reject) => req.session.regenerate(err => (err ? reject(err) : resolve())));

        // ВАЖЛИВО: Не зберігаємо _imageBlob у сесії! Це вбиває пам'ять.
        req.session.user = {
            id: user.Creator_ID,
            name: user.Name,
            email: user.Email,
            bio: user.Other_Details || '',
            profileImage, // Залишаємо Base64 (для аватарки це допустимо)
            // _imageBlob: ... <-- ВИДАЛЕНО! Не зберігайте буфер у сесії
            styles: userStyles,
            languages: userLanguages,
            likes: user.likes || 0
        };

        res.json({ success: true, message: 'Login successful', user: req.session.user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Перевірка сесії
router.get('/check-session', async (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, user: req.session.user });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ success: false });
        res.clearCookie(req.app.locals.sessionCookieName || 'bestart.sid');
        res.json({ success: true, message: 'Logout successful' });
    });
});

module.exports = router;