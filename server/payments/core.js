// Логіка оплати, що не залежить від платіжного провайдера:
// розрахунок суми з БД, створення замовлення, фіксація результату.
const crypto = require('crypto');
const db = require('../config/db');
const { getIO } = require('../socket');

const CURRENCY = 'UAH';
const MAX_CART_ITEMS = 50;

// Ціни в БД — DECIMAL у гривнях; у payment_orders.Amount зберігаємо копійки.
function toMinorUnits(price) {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return Math.round(n * 100);
}

function parsePositiveInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

// Рахує кошик за цінами з БД. Клієнтській сумі не довіряємо.
async function priceCart(userId, rawPaintingIds) {
    if (!Array.isArray(rawPaintingIds) || rawPaintingIds.length === 0) {
        return { error: 'painting_ids_required', status: 400 };
    }
    const ids = [...new Set(rawPaintingIds.map(parsePositiveInt))];
    if (ids.includes(null)) return { error: 'invalid_painting_id', status: 400 };
    if (ids.length > MAX_CART_ITEMS) return { error: 'too_many_items', status: 400 };

    const [paintings] = await db.query(
        'SELECT Painting_ID, Title, Price, Creator_ID FROM paintings WHERE Painting_ID IN (?)',
        [ids]
    );
    if (paintings.length !== ids.length) return { error: 'painting_not_found', status: 404 };
    if (paintings.some((p) => Number(p.Creator_ID) === Number(userId))) {
        return { error: 'cannot_buy_own_painting', status: 400 };
    }

    const [owned] = await db.query(
        'SELECT Painting_ID FROM user_purchases WHERE User_ID = ? AND Painting_ID IN (?)',
        [userId, ids]
    );
    if (owned.length > 0) {
        return { error: 'already_purchased', status: 409, paintingIds: owned.map((r) => r.Painting_ID) };
    }

    const items = paintings.map((p) => ({
        name: p.Title || `Painting #${p.Painting_ID}`,
        amount: toMinorUnits(p.Price),
    }));
    const amount = items.reduce((sum, i) => sum + i.amount, 0);
    if (!Number.isFinite(amount) || amount <= 0 || items.some((i) => i.amount <= 0)) {
        return { error: 'invalid_amount', status: 400 };
    }

    return { type: 'cart', amount, items, paintingIds: ids, targetId: 0, description: 'Покупка картин' };
}

// Сума комішену — з БД; платити може лише замовник.
async function priceCommission(userId, rawCommissionId) {
    const commissionId = parsePositiveInt(rawCommissionId);
    if (!commissionId) return { error: 'invalid_commission_id', status: 400 };

    const [rows] = await db.query(
        'SELECT Customer_ID, Title, Price, is_paid, Status FROM commissions WHERE Commission_ID = ?',
        [commissionId]
    );
    if (rows.length === 0) return { error: 'commission_not_found', status: 404 };

    const commission = rows[0];
    if (Number(commission.Customer_ID) !== Number(userId)) return { error: 'forbidden', status: 403 };
    if (commission.is_paid) return { error: 'already_paid', status: 409 };
    if (String(commission.Status || '').toLowerCase() === 'cancelled') {
        return { error: 'commission_cancelled', status: 400 };
    }

    const amount = toMinorUnits(commission.Price);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'invalid_amount', status: 400 };

    const description = `Оплата комішену #${commissionId}`;
    return {
        type: 'commission',
        amount,
        items: [{ name: commission.Title || description, amount }],
        paintingIds: [],
        targetId: commissionId,
        description,
    };
}

async function createOrder(userId, priced, provider) {
    const orderId = 'order_' + crypto.randomBytes(16).toString('hex');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'INSERT INTO payment_orders (Order_ID, User_ID, Status, Type, Target_ID, Amount, Currency, Provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [orderId, userId, 'pending', priced.type, priced.targetId, priced.amount, CURRENCY, provider]
        );
        if (priced.paintingIds.length > 0) {
            await conn.query(
                'INSERT INTO payment_order_items (Order_ID, Painting_ID) VALUES ?',
                [priced.paintingIds.map((pid) => [orderId, pid])]
            );
        }
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
    return orderId;
}

/**
 * Фіксує результат оплати. Викликати ЛИШЕ з даними, автентичність яких провайдер уже перевірив.
 * result: { orderId, status: 'approved'|'declined'|'expired'|'refunded'|'pending', amount (копійки), currency }
 * Ідемпотентно: повторне сповіщення для вже оплаченого замовлення нічого не змінює.
 */
async function applyPaymentResult(provider, result) {
    const { orderId, status } = result;
    if (!orderId) return { applied: false, reason: 'no_order_id' };

    const [orders] = await db.query('SELECT * FROM payment_orders WHERE Order_ID = ?', [orderId]);
    if (orders.length === 0) {
        console.warn(`[payments] unknown order ${orderId}`);
        return { applied: false, reason: 'unknown_order' };
    }
    const order = orders[0];

    if (order.Provider && order.Provider !== provider) {
        console.error(`[payments] ${orderId}: provider mismatch (${provider} vs ${order.Provider})`);
        return { applied: false, reason: 'provider_mismatch' };
    }

    if (status !== 'approved') {
        if (['declined', 'expired', 'refunded'].includes(status)) {
            await db.query(
                'UPDATE payment_orders SET Status = ? WHERE Order_ID = ? AND Status = ?',
                [status, orderId, 'pending']
            );
        }
        if (status === 'refunded' && order.Status === 'approved') {
            console.warn(`[payments] ${orderId} was refunded after approval — review manually`);
        }
        return { applied: false, reason: status };
    }

    // Звіряємо суму й валюту з тим, що ми самі порахували при створенні замовлення.
    if (order.Amount === null || order.Amount === undefined
        || Number(result.amount) !== Number(order.Amount)
        || String(result.currency || '').toUpperCase() !== String(order.Currency || CURRENCY).toUpperCase()) {
        console.error(`[payments] ${orderId}: amount/currency mismatch: got ${result.amount} ${result.currency}, expected ${order.Amount} ${order.Currency}`);
        await db.query('UPDATE payment_orders SET Status = ? WHERE Order_ID = ? AND Status = ?', ['amount_mismatch', orderId, 'pending']);
        return { applied: false, reason: 'amount_mismatch' };
    }

    const conn = await db.getConnection();
    let commissionToNotify = null;
    try {
        await conn.beginTransaction();

        // Атомарний перехід pending → approved; якщо вже approved — нічого не робимо.
        const [upd] = await conn.query(
            'UPDATE payment_orders SET Status = ? WHERE Order_ID = ? AND Status = ?',
            ['approved', orderId, 'pending']
        );
        if (upd.affectedRows === 0) {
            await conn.rollback();
            return { applied: false, reason: 'already_processed' };
        }

        if (order.Type === 'commission') {
            if (order.Target_ID) {
                await conn.query('UPDATE commissions SET is_paid = 1 WHERE Commission_ID = ?', [order.Target_ID]);
                commissionToNotify = order.Target_ID;
            }
        } else {
            const [itemRows] = await conn.query('SELECT Painting_ID FROM payment_order_items WHERE Order_ID = ?', [orderId]);
            if (itemRows.length > 0) {
                const values = itemRows.map((r) => [order.User_ID, r.Painting_ID]);
                await conn.query('INSERT IGNORE INTO user_purchases (User_ID, Painting_ID) VALUES ?', [values]);
            }
        }

        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }

    console.log(`[payments] order ${orderId} approved (${order.Type}, ${provider})`);

    if (commissionToNotify) {
        try {
            getIO().to(`commission_${commissionToNotify}`).emit('paymentUpdate', {
                commissionId: commissionToNotify,
                is_paid: 1,
            });
        } catch (e) {
            console.warn('[payments] socket emit error:', e.message);
        }
    }
    return { applied: true };
}

module.exports = {
    CURRENCY,
    toMinorUnits,
    priceCart,
    priceCommission,
    createOrder,
    applyPaymentResult,
};
