// User notifications: stored in the DB, pushed live to the user's socket room (user_<id>),
// and for important events also sent by email. Never throws — a failed notification must not
// break the action that caused it.
const db = require('../config/db');
const logger = require('../utils/logger');
const { sendMail, appUrl } = require('../utils/mailer');

function io() {
    try {
        return require('../socket').getIO();
    } catch {
        return null;
    }
}

const commissionLink = (commissionId) => `/profile?commission=${commissionId}`;

/**
 * @param userId  recipient
 * @param n       { type, title, body?, link?, commissionId?, email?: boolean, coalesce?: boolean }
 *                coalesce: refresh an existing unread notification of the same type/commission
 *                instead of adding another one (used for chat messages)
 */
async function notify(userId, n) {
    if (!userId) return null;
    try {
        let id = null;
        if (n.coalesce && n.commissionId) {
            const [r] = await db.query(
                `UPDATE notifications SET Title = ?, Body = ?, Created_At = NOW()
                  WHERE User_ID = ? AND Type = ? AND Commission_ID = ? AND Read_At IS NULL
                  ORDER BY Notification_ID DESC LIMIT 1`,
                [n.title, n.body || null, userId, n.type, n.commissionId]
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
                'INSERT INTO notifications (User_ID, Type, Title, Body, Link, Commission_ID) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, n.type, n.title, n.body || null, n.link || null, n.commissionId || null]
            );
            id = r.insertId;
        }

        const payload = { id, type: n.type, title: n.title, body: n.body || null, link: n.link || null, commissionId: n.commissionId || null, createdAt: new Date(), read: false };
        const sock = io();
        if (sock) sock.to(`user_${userId}`).emit('notification', payload);

        if (n.email) {
            const [[user]] = await db.query('SELECT Email, Name FROM creators WHERE Creator_ID = ?', [userId]);
            if (user && user.Email) {
                const link = n.link ? `\n\n${appUrl()}${n.link}` : '';
                // not awaited: SMTP can be slow and the request should not wait for it
                sendMail({ to: user.Email, subject: n.title, text: `Hi ${user.Name},\n\n${n.body || n.title}${link}` });
            }
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

const commissionEvents = {
    async newDirectOrder(c) {
        const title = await commissionTitle(c);
        return notify(c.Creator_ID, { type: 'new_order', title: 'New commission request', body: `You have a new commission request: "${title}".`, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async accepted(c) {
        const title = await commissionTitle(c);
        return notify(c.Customer_ID, { type: 'commission_accepted', title: 'Your commission was accepted', body: `An artist started working on "${title}".`, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async declined(c) {
        const title = await commissionTitle(c);
        return notify(c.Customer_ID, { type: 'commission_declined', title: 'Commission declined', body: `The artist declined "${title}".`, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async cancelled(c, byUserId) {
        const title = await commissionTitle(c);
        const other = Number(byUserId) === Number(c.Customer_ID) ? c.Creator_ID : c.Customer_ID;
        return notify(other, { type: 'commission_cancelled', title: 'Commission cancelled', body: `"${title}" was cancelled.`, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async message(c, senderId, text) {
        const title = await commissionTitle(c);
        const receiver = Number(senderId) === Number(c.Customer_ID) ? c.Creator_ID : c.Customer_ID;
        const preview = text ? String(text).slice(0, 120) : 'Sent an image';
        return notify(receiver, { type: 'message', title: `New message in "${title}"`, body: preview, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, coalesce: true });
    },
    async stageSubmitted(c, stage) {
        const title = await commissionTitle(c);
        return notify(c.Customer_ID, { type: 'stage_submitted', title: `${stage} is ready for review`, body: `The artist submitted the ${String(stage).toLowerCase()} for "${title}". Approve it or request changes.`, link: commissionLink(c.Commission_ID), commissionId: c.Commission_ID, email: true });
    },
    async stageReviewed(c, { decision, nextStatus, auto }) {
        const title = await commissionTitle(c);
        const link = commissionLink(c.Commission_ID);
        if (decision === 'reject') {
            return notify(c.Creator_ID, { type: 'changes_requested', title: 'Changes requested', body: `The customer asked for changes in "${title}".`, link, commissionId: c.Commission_ID, email: true });
        }
        await notify(c.Creator_ID, {
            type: auto ? 'stage_auto_approved' : 'stage_approved',
            title: auto ? 'Stage approved automatically' : 'Stage approved',
            body: nextStatus === 'Completed'
                ? `"${title}" is completed.`
                : `"${title}" moved to ${nextStatus}${auto ? ' (the customer did not respond in time)' : ''}.`,
            link, commissionId: c.Commission_ID, email: true,
        });
        if (nextStatus === 'Completed') {
            await notify(c.Customer_ID, { type: 'commission_completed', title: 'Your commission is ready', body: `"${title}" is completed. Pay to download the final files.`, link, commissionId: c.Commission_ID, email: true });
        }
        return null;
    },
    async reviewReceived(c, rating) {
        const title = await commissionTitle(c);
        return notify(c.Creator_ID, { type: 'review', title: `New review: ${'★'.repeat(rating)}`, body: `The customer rated "${title}".`, link: '/profile', commissionId: c.Commission_ID });
    },
};

module.exports = { notify, commissionEvents, commissionLink };
