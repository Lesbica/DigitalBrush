// Спільні перевірки доступу до комішенів (HTTP-роути та socket.io).
const db = require('../config/db');

function getSessionUserId(req) {
    const id = req?.session?.user?.Creator_ID ?? req?.session?.user?.id;
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadCommissionAccess(commissionId) {
    const id = Number(commissionId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const [rows] = await db.query(
        'SELECT Commission_ID, Customer_ID, Creator_ID, Status, Type, is_paid FROM commissions WHERE Commission_ID = ?',
        [id]
    );
    return rows[0] || null;
}

function getRole(commission, userId) {
    if (!commission || !userId) return null;
    if (Number(commission.Customer_ID) === Number(userId)) return 'customer';
    if (commission.Creator_ID !== null && Number(commission.Creator_ID) === Number(userId)) return 'creator';
    return null;
}

/**
 * Express middleware: пускає далі лише замовника або виконавця комішену з req.params[paramName].
 * Кладе в req.commission та req.commissionRole.
 */
function requireCommissionParticipant(paramName = 'commissionId') {
    return async (req, res, next) => {
        try {
            const userId = getSessionUserId(req);
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Not authenticated' });
            }
            const commission = await loadCommissionAccess(req.params[paramName]);
            if (!commission) {
                return res.status(404).json({ success: false, message: 'Commission not found' });
            }
            const role = getRole(commission, userId);
            if (!role) {
                return res.status(403).json({ success: false, message: 'Forbidden: You are not part of this commission' });
            }
            req.commission = commission;
            req.commissionRole = role;
            req.userId = userId;
            next();
        } catch (err) {
            next(err);
        }
    };
}

// Сповіщення учасникам комішену: у кімнату чату та в особисті кімнати user_<id>.
function emitToCommission(io, commission, event, payload) {
    const rooms = [`commission_${commission.Commission_ID}`];
    if (commission.Customer_ID) rooms.push(`user_${commission.Customer_ID}`);
    if (commission.Creator_ID) rooms.push(`user_${commission.Creator_ID}`);
    io.to(rooms).emit(event, payload);
}

module.exports = {
    getSessionUserId,
    loadCommissionAccess,
    getRole,
    requireCommissionParticipant,
    emitToCommission,
};
