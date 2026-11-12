// Real-time events about commissions (socket.io). Called by routes and background jobs.
const logger = require('../utils/logger');
const { emitToCommission } = require('../utils/commissionAccess');

function io() {
    try {
        return require('../socket').getIO();
    } catch {
        return null; // socket.io not started (e.g. in scripts)
    }
}

function stageReviewed(commission, { messageId, decision, nextStatus, auto = false }) {
    const sock = io();
    if (!sock) return;
    try {
        const id = Number(commission.Commission_ID);
        sock.to(`commission_${id}`).emit('stageReview', { commissionId: id, messageId: Number(messageId), decision, nextStatus, auto });
        if (nextStatus) emitToCommission(sock, commission, 'statusUpdated', { commissionId: id, status: nextStatus });
    } catch (e) {
        logger.warn('[events] stageReview emit failed:', e.message);
    }
}

function statusChanged(commission, status) {
    const sock = io();
    if (!sock) return;
    try {
        emitToCommission(sock, commission, 'statusUpdated', { commissionId: Number(commission.Commission_ID), status });
    } catch (e) {
        logger.warn('[events] statusUpdated emit failed:', e.message);
    }
}

module.exports = { stageReviewed, statusChanged };
