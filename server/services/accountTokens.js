// One-time tokens for email confirmation and password reset.
// The raw token only travels in the email link; the DB stores its SHA-256 hash.
const crypto = require('crypto');
const db = require('../config/db');
const { sendMail, appUrl } = require('../utils/mailer');
const i18n = require('../i18n');

const TTL_HOURS = { verify_email: 48, reset_password: 1 };
const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// `newEmail` is set only for an email change: the address the token proves ownership of
async function createToken(userId, purpose, newEmail = null) {
    const token = crypto.randomBytes(32).toString('hex');
    // a new token replaces older unused ones of the same purpose
    await db.query('DELETE FROM user_tokens WHERE User_ID = ? AND Purpose = ? AND Used_At IS NULL', [userId, purpose]);
    await db.query(
        'INSERT INTO user_tokens (Token_Hash, User_ID, Purpose, New_Email, Expires_At) VALUES (?, ?, ?, ?, NOW() + INTERVAL ? HOUR)',
        [hash(token), userId, purpose, newEmail, TTL_HOURS[purpose]]
    );
    return token;
}

/**
 * Marks the token used and returns { userId, newEmail }, or null if it is unknown, used or expired.
 * `newEmail` is null unless the token was issued for an email change.
 */
async function consumeTokenDetails(token, purpose) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
    const [r] = await db.query(
        `UPDATE user_tokens SET Used_At = NOW()
          WHERE Token_Hash = ? AND Purpose = ? AND Used_At IS NULL AND Expires_At > NOW()`,
        [hash(token), purpose]
    );
    if (r.affectedRows === 0) return null;
    const [[row]] = await db.query('SELECT User_ID, New_Email FROM user_tokens WHERE Token_Hash = ?', [hash(token)]);
    return row ? { userId: row.User_ID, newEmail: row.New_Email || null } : null;
}

/** Marks the token used and returns its user id, or null if it is unknown, used or expired. */
async function consumeToken(token, purpose) {
    const details = await consumeTokenDetails(token, purpose);
    return details ? details.userId : null;
}

// `lang` is the language of the page the request came from (uk | en).
// `newEmail`: the confirmation is for an email change; `user.email` is then the new address it is sent to.
async function sendVerificationEmail(user, lang, newEmail = null) {
    const token = await createToken(user.id, 'verify_email', newEmail);
    const link = `${appUrl()}/verify-email?token=${token}`;
    return sendMail({
        to: user.email,
        subject: i18n.t(lang, 'email.verify.subject'),
        text: `${i18n.t(lang, 'email.greeting', { name: user.name })}\n\n${i18n.t(lang, 'email.verify.text', { link, hours: TTL_HOURS.verify_email })}`,
    });
}

async function sendPasswordResetEmail(user, lang) {
    const token = await createToken(user.id, 'reset_password');
    const link = `${appUrl()}/reset-password?token=${token}`;
    return sendMail({
        to: user.email,
        subject: i18n.t(lang, 'email.reset.subject'),
        text: `${i18n.t(lang, 'email.greeting', { name: user.name })}\n\n${i18n.t(lang, 'email.reset.text', { link, hours: TTL_HOURS.reset_password })}`,
    });
}

module.exports = { createToken, consumeToken, consumeTokenDetails, sendVerificationEmail, sendPasswordResetEmail };
