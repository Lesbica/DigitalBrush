// Sign in with Google (OAuth 2.0 authorization code flow, OpenID Connect).
// Turned on by GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; redirect URI: ${API_URL}/auth/google/callback.
//
// GET /api/auth/google?next=/checkout   → Google consent screen
// GET /api/auth/google/callback         → logs in (existing account by Google id or verified email,
//                                          otherwise a new customer account) and returns to the app
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const logger = require('../utils/logger');
const { fetch, publicApiBase, publicAppBase } = require('../payments/httpClient');
const { DEFAULT_AVATAR_BUFFER, toUserPayload, toSessionUser } = require('../utils/userProfile');

const router = express.Router();

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const isConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = () => `${publicApiBase()}/auth/google/callback`;
// Only same-site paths as the place to return to
const safeNext = (value) => (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value.slice(0, 200) : '/profile');
const backToApp = (res, path) => res.redirect(302, publicAppBase() + path);
const fail = (res, reason) => {
    logger.warn(`[google] sign-in failed: ${reason}`);
    return backToApp(res, '/profile?authError=google');
};

function decodeJwtPayload(jwt) {
    const parts = String(jwt || '').split('.');
    if (parts.length !== 3) return null;
    try {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

// The ID token comes straight from Google's token endpoint over TLS (authenticated with our client
// secret), so its claims are checked without verifying the signature, as Google's OIDC guide allows.
function checkIdToken(claims) {
    if (!claims) return 'no id token';
    if (claims.aud !== process.env.GOOGLE_CLIENT_ID) return 'wrong audience';
    if (!ISSUERS.includes(claims.iss)) return 'wrong issuer';
    if (!claims.exp || claims.exp * 1000 < Date.now()) return 'expired token';
    if (!claims.sub) return 'no subject';
    if (!claims.email || claims.email_verified !== true) return 'email not verified by Google';
    return null;
}

async function uniqueName(base) {
    const clean = String(base || 'User').replace(/\s+/g, ' ').trim().slice(0, 40) || 'User';
    for (let i = 0; i < 20; i++) {
        const candidate = i === 0 ? clean : `${clean} ${crypto.randomInt(1000, 9999)}`;
        const [[taken]] = await db.query('SELECT 1 AS x FROM creators WHERE Name = ?', [candidate]);
        if (!taken) return candidate;
    }
    return `${clean.slice(0, 30)} ${crypto.randomBytes(4).toString('hex')}`;
}

// Existing account by Google id, then by email (Google confirmed it), else a new customer account
async function findOrCreateUser(claims, lang) {
    const email = String(claims.email).toLowerCase();
    const [[byGoogle]] = await db.query('SELECT * FROM creators WHERE Google_ID = ?', [claims.sub]);
    if (byGoogle) return byGoogle;

    const [[byEmail]] = await db.query('SELECT * FROM creators WHERE Email = ?', [email]);
    if (byEmail) {
        if (byEmail.Google_ID && byEmail.Google_ID !== claims.sub) return null; // linked to another Google account
        await db.query('UPDATE creators SET Google_ID = ?, Email_Verified = 1 WHERE Creator_ID = ?', [claims.sub, byEmail.Creator_ID]);
        return { ...byEmail, Google_ID: claims.sub, Email_Verified: 1 };
    }

    // No password is known: a random one; the user can set their own with "Forgot password"
    const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const name = await uniqueName(claims.name || email.split('@')[0]);
    const [r] = await db.query(
        `INSERT INTO creators (Name, Email, Password, Role, Email_Verified, Google_ID, Image, Language)
         VALUES (?, ?, ?, 'customer', 1, ?, ?, ?)`,
        [name, email, hash, claims.sub, DEFAULT_AVATAR_BUFFER, lang]
    );
    const [[created]] = await db.query('SELECT * FROM creators WHERE Creator_ID = ?', [r.insertId]);
    logger.info(`[google] new account ${r.insertId}`);
    return created;
}

// GET /api/auth/providers — which sign-in methods the login form shows
router.get('/providers', (req, res) => res.json({ google: isConfigured() }));

router.get('/google', (req, res) => {
    if (!isConfigured()) return res.status(404).json({ success: false, error: 'google_disabled' });
    const state = crypto.randomBytes(24).toString('base64url');
    req.session.googleAuth = { state, next: safeNext(req.query.next), lang: req.lang, at: Date.now() };
    req.session.save((err) => {
        if (err) return fail(res, 'session save');
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri(),
            response_type: 'code',
            scope: 'openid email profile',
            state,
            prompt: 'select_account',
        });
        return res.redirect(302, `${AUTH_URL}?${params}`);
    });
});

router.get('/google/callback', async (req, res) => {
    if (!isConfigured()) return fail(res, 'not configured');
    const pending = req.session.googleAuth;
    delete req.session.googleAuth;
    const state = String(req.query.state || '');
    if (!pending || !state || pending.state.length !== state.length
        || !crypto.timingSafeEqual(Buffer.from(pending.state), Buffer.from(state))) {
        return fail(res, 'state mismatch');
    }
    if (Date.now() - pending.at > 10 * 60 * 1000) return fail(res, 'state expired');
    if (req.query.error || !req.query.code) return fail(res, `google answered ${req.query.error || 'without a code'}`);

    try {
        const tokenRes = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: String(req.query.code),
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri(),
                grant_type: 'authorization_code',
            }).toString(),
        });
        const tokens = await tokenRes.json();
        if (!tokenRes.ok || !tokens.id_token) return fail(res, `token endpoint ${tokenRes.status} ${tokens.error || ''}`);

        const claims = decodeJwtPayload(tokens.id_token);
        const problem = checkIdToken(claims);
        if (problem) return fail(res, problem);

        const user = await findOrCreateUser(claims, pending.lang);
        if (!user) return fail(res, 'email linked to another Google account');

        // New session (no session fixation), as in the password login
        await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
        req.session.user = toSessionUser(toUserPayload(user));
        await new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
        return backToApp(res, pending.next);
    } catch (err) {
        logger.error('[google] callback error:', err);
        return fail(res, 'exception');
    }
});

module.exports = router;
module.exports._internal = { checkIdToken, decodeJwtPayload, isConfigured };
