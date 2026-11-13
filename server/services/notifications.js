// User notifications: stored in the DB, pushed live to the user's socket room (user_<id>),
// and for important events also sent by email. Never throws — a failed notification must not
// break the action that caused it.
//
// Texts are keys from server/i18n (notifications.*): they are rendered in the recipient's language
// for the socket push and the email, and stored as keys (Content) so the list endpoint can show
// them in whatever language the reader uses now.
const db = require('../config/db');
const logger = require('../utils/logger');
const { sendMail, appUrl } = require('../utils/mailer');
const i18n = require('../i18n');

function io() {
    try {
        return require('../socket').getIO();
    } catch {
        return null;
    }
}

const commissionLink = (commissionId) => `/profile?commission=${commissionId}`;

// Amounts are kopecks
function formatMoney(lang, kopecks) {
    return new Intl.NumberFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
        style: 'currency', currency: 'UAH', currencyDisplay: lang === 'uk' ? 'narrowSymbol' : 'code',
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(kopecks) / 100);
}

// A text part: { key, params } or { text } (user content such as a chat message preview).
// Param values may be { key } (translated word) or { money: kopecks }.
function renderPart(lang, part) {
    if (!part) return null;
    if (part.text !== undefined) return String(part.text);
    const params = {};
    for (const [name, value] of Object.entries(part.params || {})) {
        if (value && typeof value === 'object' && value.key) params[name] = i18n.t(lang, value.key);
        else if (value && typeof value === 'object' && value.money !== undefined) params[name] = formatMoney(lang, value.money);
        else params[name] = value;
    }
    return i18n.t(lang, part.key, params);
}

function renderContent(lang, content) {
    const c = typeof content === 'string' ? JSON.parse(content) : content;
    return { title: renderPart(lang, c.title), body: renderPart(lang, c.body) };
}

const clip = (s, max) => (s && s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * @param userId  recipient
 * @param n       { type, title: part, body?: part, link?, commissionId?, email?: boolean, coalesce?: boolean }
 *                part = { key, params } | { text }
 *                coalesce: refresh an existing unread notification of the same type/commission
 *                instead of adding another one (used for chat messages)
 */
async function notify(userId, n) {
    if (!userId) return null;
    try {
        const [[user]] = await db.query('SELECT Email, Name, Language FROM creators WHERE Creator_ID = ?', [userId]);
        if (!user) return null;
        const lang = i18n.normalizeLanguage(user.Language) || i18n.DEFAULT_USER_LANGUAGE;
        const content = { title: n.title, body: n.body || null };
        const { title, body } = renderContent(lang, content);
        const stored = [clip(title, 200), clip(body, 500), JSON.stringify(content)];

        let id = null;
        if (n.coalesce && n.commissionId) {
            const [r] = await db.query(
                `UPDATE notifications SET Title = ?, Body = ?, Content = ?, Created_At = NOW()
                  WHERE User_ID = ? AND Type = ? AND Commission_ID = ? AND Read_At IS NULL
                  ORDER BY Notification_ID DESC LIMIT 1`,
                [...stored, userId, n.type, n.commissionId]
            );
            if (r.affectedRows) {
                const [[row]] = await db.query(
                    'SELECT Notification_ID FROM notifications WHERE User_ID = ? AND Type = ? AND Commission_ID = ? AND Read_At IS NULL ORDER BY Notification_ID DESC LIMIT 1',
                    [userId, n.type, n.commissionId]
                );
                id = row && row.Notification_ID;
            }
        }
        if (!id) {
            const [r] = await db.query(
                'INSERT INTO notifications (User_ID, Type, Title, Body, Content, Link, Commission_ID) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, n.type, ...stored, n.link || null, n.commissionId || null]
            );
            id = r.insertId;
        }

        const payload = { id, type: n.type, title, body, link: n.link || null, commissionId: n.commissionId || null, createdAt: new Date(), read: false };
        const sock = io();
        if (sock) sock.to(`user_${userId}`).emit('notification', payload);

        if (n.email && user.Email) {
            const link = n.link ? `\n\n${appUrl()}${n.link}` : '';
            // not awaited: SMTP can be slow and the request should not wait for it
            sendMail({ to: user.Email, subject: title, text: `${i18n.t(lang, 'email.greeting', { name: user.Name })}\n\n${body || title}${link}` });
        }
        return payload;
    } catch (err) {
        logger.error('[notify] failed:', err);
        return null;
    }
}

// Ready-made notifications for commission events. `c` has Commission_ID, Customer_ID, Creator_ID, Title.
async function commissionTitle(c) {
    if (c.Title) return c.Title;
    const [[row]] = await db.query('SELECT Title FROM commissions WHERE Commission_ID = ?', [c.Commission_ID]);
    return row ? row.Title : `#${c.Commission_ID}`;
}

const k = (key, params) => ({ key, params });
const stageWord = (stage) => ({ key: `stages.${stage}` });

const commissionEvents = {
    async newDirectOrder(c) {
        const title = await commissionTitle(c);
        return notify(c.Creator_ID, { type: 'new_order', title: k('notifications.new_order.title'), body: k('notifications.new_order.body', { title }), link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async accepted(c) {
        const title = await commissionTitle(c);
        return notify(c.Customer_ID, { type: 'commission_accepted', title: k('notifications.commission_accepted.title'), body: k('notifications.commission_accepted.body', { title }), link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async declined(c) {
        const title = await commissionTitle(c);
        return notify(c.Customer_ID, { type: 'commission_declined', title: k('notifications.commission_declined.title'), body: k('notifications.commission_declined.body', { title }), link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async cancelled(c, byUserId) {
        const title = await commissionTitle(c);
        const other = Number(byUserId) === Number(c.Customer_ID) ? c.Creator_ID : c.Customer_ID;
        return notify(other, { type: 'commission_cancelled', title: k('notifications.commission_cancelled.title'), body: k('notifications.commission_cancelled.body', { title }), link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async message(c, senderId, text) {
        const title = await commissionTitle(c);
        const receiver = Number(senderId) === Number(c.Customer_ID) ? c.Creator_ID : c.Customer_ID;
        const body = text ? { text: String(text).slice(0, 120) } : k('notifications.message.image');
        return notify(receiver, { type: 'message', title: k('notifications.message.title', { title }), body, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, coalesce: true });
    },
    async stageSubmitted(c, stage) {
        const title = await commissionTitle(c);
        return notify(c.Customer_ID, {
            type: 'stage_submitted',
            title: k('notifications.stage_submitted.title', { stage: stageWord(stage) }),
            body: k('notifications.stage_submitted.body', { title, stage: stageWord(stage), stageLower: String(stage).toLowerCase() }),
            link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true,
        });
    },
    async stageReviewed(c, { decision, nextStatus, auto }) {
        const title = await commissionTitle(c);
        const link = commissionLink(c.Commission_ID);
        if (decision === 'reject') {
            return notify(c.Creator_ID, { type: 'changes_requested', title: k('notifications.changes_requested.title'), body: k('notifications.changes_requested.body', { title }), link, commissionId: c.Commission_ID, email: true });
        }
        const bodyKey = nextStatus === 'Completed' ? 'completed' : auto ? 'movedAuto' : 'moved';
        await notify(c.Creator_ID, {
            type: auto ? 'stage_auto_approved' : 'stage_approved',
            title: k(auto ? 'notifications.stage_auto_approved.title' : 'notifications.stage_approved.title'),
            body: k(`notifications.stage_approved.${bodyKey}`, { title, stage: stageWord(nextStatus) }),
            link, commissionId: c.Commission_ID, email: true,
        });
        if (nextStatus === 'Completed') {
            await notify(c.Customer_ID, { type: 'commission_completed', title: k('notifications.commission_completed.title'), body: k('notifications.commission_completed.body', { title }), link, commissionId: c.Commission_ID, email: true });
        }
        return null;
    },
    async reviewReceived(c, rating) {
        const title = await commissionTitle(c);
        return notify(c.Creator_ID, { type: 'review', title: k('notifications.review.title', { stars: '★'.repeat(rating) }), body: k('notifications.review.body', { title }), link: '/profile', commissionId: c.Commission_ID });
    },
};

// Wallet events; amounts in kopecks
const walletLink = '/profile?tab=wallet';
const walletEvents = {
    paintingSold(artistId, { title, net }) {
        return notify(artistId, { type: 'painting_sold', title: k('notifications.painting_sold.title'), body: k('notifications.painting_sold.body', { title, amount: { money: net } }), link: walletLink, email: true });
    },
    commissionPaid(artistId, { title, net, pending, commissionId }) {
        return notify(artistId, {
            type: 'commission_paid',
            title: k('notifications.commission_paid.title'),
            body: k(pending ? 'notifications.commission_paid.bodyEscrow' : 'notifications.commission_paid.body', { title, amount: { money: net } }),
            link: commissionLink(commissionId), commissionId, email: true,
        });
    },
    withdrawalPaid(userId, { amount }) {
        return notify(userId, { type: 'withdrawal_paid', title: k('notifications.withdrawal_paid.title'), body: k('notifications.withdrawal_paid.body', { amount: { money: amount } }), link: walletLink, email: true });
    },
    withdrawalRejected(userId, { amount, note }) {
        return notify(userId, {
            type: 'withdrawal_rejected',
            title: k('notifications.withdrawal_rejected.title'),
            body: k(note ? 'notifications.withdrawal_rejected.bodyNote' : 'notifications.withdrawal_rejected.body', { amount: { money: amount }, note: note || '' }),
            link: walletLink, email: true,
        });
    },
};

module.exports = { notify, commissionEvents, walletEvents, commissionLink, renderContent, formatMoney };
