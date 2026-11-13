// Outgoing email. With SMTP_HOST set, mail goes through that SMTP server; otherwise (local
// development) messages are only written to the log, so links can be opened from there.
// The last messages are kept in memory (`sent`) — tests read tokens from them.
const nodemailer = require('nodemailer');
const logger = require('./logger');

const sent = [];
let transport = null;

function getTransport() {
    if (transport) return transport;
    if (process.env.SMTP_HOST) {
        transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
        });
    } else {
        transport = nodemailer.createTransport({ jsonTransport: true });
    }
    return transport;
}

/**
 * Sends an email. Never throws: a failed delivery is logged (callers are request handlers
 * whose main action already succeeded).
 */
async function sendMail({ to, subject, text, html }) {
    const message = { from: process.env.MAIL_FROM || 'DigitalBrush <no-reply@digitalbrush.local>', to, subject, text, html };
    sent.push({ ...message, at: new Date() });
    if (sent.length > 50) sent.shift();
    try {
        await getTransport().sendMail(message);
        if (!process.env.SMTP_HOST) logger.info(`[mail] (not sent, no SMTP) to=${to} subject="${subject}"\n${text}`);
        return true;
    } catch (err) {
        logger.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
        return false;
    }
}

const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

module.exports = { sendMail, sent, appUrl };
