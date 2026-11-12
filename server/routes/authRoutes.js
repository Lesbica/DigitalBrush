const express = require('express');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { DEFAULT_AVATAR_BUFFER, toUserPayload, loadUserPayload, toSessionUser } = require('../utils/userProfile');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6; // як minLength у формі реєстрації

function validateRegistration(body) {
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const birthday = body.birthday ? String(body.birthday) : null;

    if (!username || username.length > 50) return { error: 'Username is required (max 50 characters)' };
    if (!EMAIL_RE.test(email) || email.length > 255) return { error: 'Invalid email address' };
    if (password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
        return { error: `Password must be ${MIN_PASSWORD_LENGTH}–72 characters long` };
    }
    if (birthday && (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(Date.parse(birthday)))) {
        return { error: 'Invalid birthday date' };
    }
    return { values: { username, email, password, birthday } };
}

router.post('/register', async (req, res) => {
    const { values, error } = validateRegistration(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    const { username, email, password, birthday } = values;
    try {
        const [existing] = await db.query('SELECT 1 FROM creators WHERE Email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }

        const hash = await bcrypt.hash(password, 10);
        // Insert with default avatar image (if available)
        const sql = `INSERT INTO creators (Name, Email, Password, Birthday, Image) VALUES (?, ?, ?, ?, ?)`;
        await db.query(sql, [username, email, hash, birthday, DEFAULT_AVATAR_BUFFER]);
        res.status(201).json({ success: true, message: 'User registered' });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }
        logger.error('Error registering user:', err);
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
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    try {
        // Додаємо вибірку нових полів: styles, languages, likes
        const [rows] = await db.query('SELECT * FROM creators WHERE Email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.Password);
        if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        // Нова сесія після логіну (захист від session fixation)
        await new Promise((resolve, reject) => req.session.regenerate(err => (err ? reject(err) : resolve())));

        // У сесії — лише id/name/email; аватар і профіль віддаємо з БД (сесія лишається маленькою).
        const payload = toUserPayload(user);
        req.session.user = toSessionUser(payload);

        res.json({ success: true, message: 'Login successful', user: payload });
    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Перевірка сесії
router.get('/check-session', async (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    try {
        const payload = await loadUserPayload(req.session.user.id);
        if (!payload) {
            // Акаунт видалено — сесія більше не дійсна
            return req.session.destroy(() => res.json({ loggedIn: false }));
        }
        // Старі сесії могли містити base64-аватар — замінюємо на мінімальний набір полів
        req.session.user = toSessionUser(payload);
        res.json({ loggedIn: true, user: payload });
    } catch (err) {
        logger.error('check-session error:', err);
        res.status(500).json({ loggedIn: false, message: 'Internal server error' });
    }
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