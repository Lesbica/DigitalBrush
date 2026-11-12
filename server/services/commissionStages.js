// Commission work stages and their review (customer approves or requests changes).
//   Open --accept--> Sketch -> Lineart -> Color -> Final -> Completed
//   Open --decline--> Declined, any unpaid unfinished --cancel--> Cancelled
const db = require('../config/db');
const logger = require('../utils/logger');
const { releaseCommission } = require('./wallet');

const STAGES = ['Sketch', 'Lineart', 'Color', 'Final'];
const NEXT_STATUS = { Sketch: 'Lineart', Lineart: 'Color', Color: 'Final', Final: 'Completed' };
const ALL_STATUSES = ['Open', ...STAGES, 'Completed', 'Cancelled', 'Declined'];
const TERMINAL = ['Completed', 'Cancelled', 'Declined'];

// Days the customer has to review a submitted stage before it is approved automatically
const autoApproveDays = () => Math.max(Number(process.env.AUTO_APPROVE_DAYS) || 3, 1);

function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (raw === 'edits') return 'Lineart'; // legacy name
    return ALL_STATUSES.find((s) => s.toLowerCase() === raw) || 'Open';
}

const isStage = (status) => STAGES.includes(normalizeStatus(status));

// Latest stage submission that has not been reviewed yet (by message id order), or null
async function findPendingStage(conn, commissionId) {
    const [[row]] = await conn.query(
        `SELECT s.id
           FROM messages s
          WHERE s.commissionId = ? AND s.type = 'stage'
            AND s.id > COALESCE((SELECT MAX(r.id) FROM messages r
                                  WHERE r.commissionId = s.commissionId
                                    AND r.type IN ('stage-approve', 'stage-reject')), 0)
          ORDER BY s.id DESC LIMIT 1`,
        [commissionId]
    );
    return row ? row.id : null;
}

/**
 * Applies the customer's decision (or the automatic approval) to the latest submitted stage.
 * decision: 'approve' | 'reject'. Returns { messageId, nextStatus, reviewMessageId } or { error, status }.
 */
async function reviewStage(commissionId, { decision, messageId, auto = false }) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[c]] = await conn.query(
            'SELECT Customer_ID, Creator_ID, status FROM commissions WHERE Commission_ID = ? FOR UPDATE',
            [commissionId]
        );
        if (!c) { await conn.rollback(); return { error: 'Commission not found', status: 404 }; }
        const current = normalizeStatus(c.status);
        if (!isStage(current)) {
            await conn.rollback();
            return { error: `Nothing to review in status ${current}`, status: 409 };
        }

        const pendingId = await findPendingStage(conn, commissionId);
        const targetId = messageId ? Number(messageId) : pendingId;
        if (!pendingId || targetId !== pendingId) {
            await conn.rollback();
            return { error: 'No stage submission waiting for review', status: 400 };
        }

        const [ins] = await conn.query(
            'INSERT INTO messages (senderId, receiverId, commissionId, type, content, status) VALUES (?, ?, ?, ?, ?, ?)',
            [c.Customer_ID, c.Creator_ID, commissionId, decision === 'approve' ? 'stage-approve' : 'stage-reject',
                auto ? `${targetId}:auto` : String(targetId), 'unread']
        );

        let nextStatus = null;
        if (decision === 'approve') {
            nextStatus = NEXT_STATUS[current];
            await conn.query(
                `UPDATE commissions SET status = ?, Review_State = 'none', Stage_Submitted_At = NULL, Updated_At = NOW()
                  WHERE Commission_ID = ?`,
                [nextStatus, commissionId]
            );
            if (nextStatus === 'Completed') {
                // The approved final stage is the result the customer downloads after payment
                await conn.query(
                    'UPDATE commissions c JOIN messages m ON m.id = ? SET c.ResultImage = m.image WHERE c.Commission_ID = ?',
                    [targetId, commissionId]
                );
                // a payment made before completion is released from escrow to the artist
                await releaseCommission(conn, commissionId);
            }
        } else {
            await conn.query(
                `UPDATE commissions SET Review_State = 'changes_requested', Stage_Submitted_At = NULL, Updated_At = NOW()
                  WHERE Commission_ID = ?`,
                [commissionId]
            );
        }
        await conn.commit();
        return { messageId: targetId, nextStatus, reviewMessageId: ins.insertId, customerId: c.Customer_ID, creatorId: c.Creator_ID };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Approves stages the customer has not reviewed within AUTO_APPROVE_DAYS.
 * Returns the list of { commissionId, nextStatus } that were approved.
 */
async function runAutoApprove({ onApproved } = {}) {
    const [rows] = await db.query(
        `SELECT Commission_ID FROM commissions
          WHERE Review_State = 'pending' AND Stage_Submitted_At IS NOT NULL
            AND Stage_Submitted_At < NOW() - INTERVAL ? DAY`,
        [autoApproveDays()]
    );
    const approved = [];
    for (const { Commission_ID: id } of rows) {
        try {
            const r = await reviewStage(id, { decision: 'approve', auto: true });
            if (r.error) continue;
            approved.push({ commissionId: id, ...r });
            if (onApproved) await onApproved(id, r);
        } catch (err) {
            logger.error(`[auto-approve] commission ${id}:`, err);
        }
    }
    if (approved.length) logger.info(`[auto-approve] approved ${approved.length} stage(s)`);
    return approved;
}

module.exports = {
    STAGES,
    NEXT_STATUS,
    ALL_STATUSES,
    TERMINAL,
    autoApproveDays,
    normalizeStatus,
    isStage,
    findPendingStage,
    reviewStage,
    runAutoApprove,
};
