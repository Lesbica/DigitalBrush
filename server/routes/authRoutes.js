const express = require('express');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { DEFAULT_AVATAR_BUFFER, toUserPayload, loadUserPayload, toSessionUser } = require('../utils/userProfile');
const { consumeToken, sendVerificationEmail, sendPasswordResetEmail } = require('../services/accountTokens');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6; // як minLength у формі реєстрації
const ROLES = ['artist', 'customer'];

// Email confirmation is required to log in unless explicitly turned off (e.g. for a demo)
const verificationRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';

const validPassword = (p) => typeof p === 'string' && p.length >= MIN_PASSWORD_LENGTH && p.length <= 72;

function validateRegistration(body) {
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const birthday = body.birthday ? String(body.birthday) : null;
    const role = body.role === undefined || body.role === '' ? 'customer' : String(body.role);

    if (!username || username.length > 50) return { error: 'Username is required (max 50 characters)' };
    if (!EMAIL_RE.test(email) || email.length > 255) return { error: 'Invalid email address' };
    if (!validPassword(password)) {
        return { error: `Password must be ${MIN_PASSWORD_LENGTH}–72 characters long` };
    }
    if (birthday && (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(Date.parse(birthday)))) {
        return { error: 'Invalid birthday date' };
    }
    if (!ROLES.includes(role)) return { error: 'Role must be artist or customer' };
    return { values: { username, email, password, birthday, role } };
}

// POST /api/auth/register { username, email, password, birthday?, role? }
// Creates an unverified account and emails a confirmation link.
router.post('/register', async (req, res) => {
    const { values, error } = validateRegistration(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    const { username, email, password, birthday, role } = values;
    try {
        const [existing] = await db.query('SELECT 1 FROM creators WHERE Email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const verified = verificationRequired() ? 0 : 1;
        const [result] = await db.query(
            'INSERT INTO creators (Name, Email, Password, Role, Email_Verified, Birthday, Image, Language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, email, hash, role, verified, birthday, DEFAULT_AVATAR_BUFFER, req.lang]
        );
        if (!verified) await sendVerificationEmail({ id: result.insertId, name: username, email }, req.lang);

        res.status(201).json({
            success: true,
            verificationRequired: !verified,
            message: verified ? 'User registered' : 'Check your email to confirm the account',
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }
        logger.error('Error registering user:', err);
        res.status(500).json({ success: false, message: 'Database error during registration' });
    }
});

// POST /api/auth/verify-email { token }
router.post('/verify-email', async (req, res) => {
    try {
        const userId = await consumeToken(req.body?.token, 'verify_email');
        if (!userId) return res.status(400).json({ success: false, message: 'The link is invalid or has expired' });
        await db.query('UPDATE creators SET Email_Verified = 1 WHERE Creator_ID = ?', [userId]);
        res.json({ success: true, message: 'Email confirmed. You can log in now.' });
    } catch (err) {
        logger.error('verify-email error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// POST /api/auth/resend-verification { email } — same answer whether or not the account exists
router.post('/resend-verification', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    try {
        const [[user]] = await db.query('SELECT Creator_ID, Name, Email, Email_Verified FROM creators WHERE Email = ?', [email]);
        if (user && !user.Email_Verified) {
            await sendVerificationEmail({ id: user.Creator_ID, name: user.Name, email: user.Email }, req.lang);
        }
        res.json({ success: true, message: 'If the account exists and is not confirmed yet, we sent a new link.' });
    } catch (err) {
        logger.error('resend-verification error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// POST /api/auth/forgot-password { email } — same answer whether or not the account exists
router.post('/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    try {
        const [[user]] = await db.query('SELECT Creator_ID, Name, Email FROM creators WHERE Email = ?', [email]);
        if (user) await sendPasswordResetEmail({ id: user.Creator_ID, name: user.Name, email: user.Email }, req.lang);
        res.json({ success: true, message: 'If an account with this email exists, we sent a password reset link.' });
    } catch (err) {
        logger.error('forgot-password error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// POST /api/auth/reset-password { token, password }
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body || {};
    if (!validPassword(password)) {
        return res.status(400).json({ success: false, message: `Password must be ${MIN_PASSWORD_LENGTH}–72 characters long` });
    }
    try {
        const userId = await consumeToken(token, 'reset_password');
        if (!userId) return res.status(400).json({ success: false, message: 'The link is invalid or has expired' });
        const hash = await bcrypt.hash(password, 10);
        // Following the emailed link proves access to the mailbox, so the email counts as confirmed
        await db.query('UPDATE creators SET Password = ?, Email_Verified = 1 WHERE Creator_ID = ?', [hash, userId]);
        res.json({ success: true, message: 'Password changed. You can log in with the new password.' });
    } catch (err) {
        logger.error('reset-password error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
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
        const [rows] = await db.query('SELECT * FROM creators WHERE Email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.Password);
        if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        // Only after the password is right, so this does not reveal which emails exist
        if (!user.Email_Verified && verificationRequired()) {
            return res.status(403).json({
                success: false,
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please confirm your email first. We can send the link again.',
            });
        }

        // Notifications and emails for this user follow the language of the page they log in from
        if (user.Language !== req.lang) {
            await db.query('UPDATE creators SET Language = ? WHERE Creator_ID = ?', [req.lang, user.Creator_ID]);
            user.Language = req.lang;
        }

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
