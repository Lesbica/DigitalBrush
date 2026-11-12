// Background jobs of the API process.
const logger = require('../utils/logger');
const { runAutoApprove } = require('./commissionStages');
const events = require('./commissionEvents');
const { commissionEvents: notifyCommission } = require('./notifications');

// Hooks other features can attach to (e.g. notifications) when a stage is auto-approved
const onAutoApproved = [];

async function autoApproveTick() {
    return runAutoApprove({
        onApproved: async (commissionId, r) => {
            const commission = { Commission_ID: commissionId, Customer_ID: r.customerId, Creator_ID: r.creatorId };
            events.stageReviewed(commission, { messageId: r.messageId, decision: 'approve', nextStatus: r.nextStatus, auto: true });
            await notifyCommission.stageReviewed(commission, { decision: 'approve', nextStatus: r.nextStatus, auto: true });
            for (const hook of onAutoApproved) await hook(commission, r);
        },
    });
}

function start() {
    if (process.env.AUTO_APPROVE_DISABLED === 'true') return null;
    const minutes = Math.max(Number(process.env.AUTO_APPROVE_INTERVAL_MINUTES) || 15, 1);
    const run = () => autoApproveTick().catch((err) => logger.error('[scheduler] auto-approve failed:', err));
    run();
    const timer = setInterval(run, minutes * 60 * 1000);
    timer.unref();
    logger.info(`[scheduler] auto-approve every ${minutes} min`);
    return timer;
}

module.exports = { start, autoApproveTick, onAutoApproved };
