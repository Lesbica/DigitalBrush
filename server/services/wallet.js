// Artist wallet: earnings ledger and withdrawal requests (amounts in kopecks).
//   available  = completed earnings − completed and pending withdrawals
//   escrow     = commission earnings waiting for the commission to be completed
const db = require('../config/db');

const feePercent = () => Math.min(Math.max(Number(process.env.PLATFORM_FEE_PERCENT) || 0, 0), 50);
const minWithdrawal = () => Math.max(Number(process.env.MIN_WITHDRAWAL_UAH) || 100, 1) * 100;

function split(gross) {
    const fee = Math.round((gross * feePercent()) / 100);
    return { net: gross - fee, fee };
}

// Called inside the payment transaction (conn). INSERT IGNORE + unique Ref = idempotent.
async function creditSale(conn, { orderId, paintingId, artistId, payerId, gross, title }) {
    const { net, fee } = split(gross);
    await conn.query(
        `INSERT IGNORE INTO wallet_transactions
           (User_ID, Type, Amount, Fee, Status, Ref, Order_ID, Painting_ID, Payer_ID, Description)
         VALUES (?, 'sale', ?, ?, 'completed', ?, ?, ?, ?, ?)`,
        [artistId, net, fee, `order:${orderId}:painting:${paintingId}`, orderId, paintingId, payerId, title || null]
    );
    return { net, fee };
}

async function creditCommission(conn, { orderId, commissionId, artistId, payerId, gross, completed, title }) {
    const { net, fee } = split(gross);
    await conn.query(
        `INSERT IGNORE INTO wallet_transactions
           (User_ID, Type, Amount, Fee, Status, Ref, Order_ID, Commission_ID, Payer_ID, Description)
         VALUES (?, 'commission', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [artistId, net, fee, completed ? 'completed' : 'pending', `order:${orderId}:commission`, orderId, commissionId, payerId, title || null]
    );
    return { net, fee };
}

// Commission completed → its escrowed payment becomes available to the artist
async function releaseCommission(conn, commissionId) {
    const [r] = await conn.query(
        `UPDATE wallet_transactions SET Status = 'completed'
          WHERE Commission_ID = ? AND Type = 'commission' AND Status = 'pending'`,
        [commissionId]
    );
    return r.affectedRows;
}

async function balance(userId, conn = db) {
    const [[b]] = await conn.query(
        `SELECT
            COALESCE(SUM(CASE WHEN Status = 'completed' AND Type <> 'withdrawal' THEN Amount END), 0) AS earned,
            COALESCE(SUM(CASE WHEN Type = 'withdrawal' AND Status IN ('pending', 'completed') THEN Amount END), 0) AS withdrawn,
            COALESCE(SUM(CASE WHEN Type = 'withdrawal' AND Status = 'pending' THEN -Amount END), 0) AS withdrawing,
            COALESCE(SUM(CASE WHEN Type = 'commission' AND Status = 'pending' THEN Amount END), 0) AS escrow
           FROM wallet_transactions WHERE User_ID = ?`,
        [userId]
    );
    return {
        available: Number(b.earned) + Number(b.withdrawn), // withdrawn is negative
        escrow: Number(b.escrow),
        withdrawing: Number(b.withdrawing),
    };
}

// Ukrainian IBAN: UA + 2 check digits + 25 digits, verified with the ISO 13616 mod-97 check
function normalizeIban(value) {
    const iban = String(value || '').replace(/\s+/g, '').toUpperCase();
    if (!/^UA\d{27}$/.test(iban)) return null;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
    return remainder === 1 ? iban : null;
}

/**
 * Creates a withdrawal request. Returns { withdrawal } or { error, status }.
 * destination: an IBAN string (paid by hand) or { method: 'card', cardMask } (paid out automatically).
 */
async function requestWithdrawal(userId, amount, destination) {
    const toCard = destination && typeof destination === 'object' && destination.method === 'card';
    const target = toCard ? String(destination.cardMask || '') : normalizeIban(destination);
    if (!target) {
        return toCard
            ? { error: 'Link a card for payouts first', status: 400 }
            : { error: 'Enter a valid Ukrainian IBAN (UA + 27 digits)', status: 400 };
    }
    if (!Number.isInteger(amount) || amount < minWithdrawal()) {
        return { error: `The minimum withdrawal is ${minWithdrawal() / 100} UAH`, status: 400 };
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        // lock the user row so two requests cannot both spend the same balance
        await conn.query('SELECT Creator_ID FROM creators WHERE Creator_ID = ? FOR UPDATE', [userId]);
        const { available } = await balance(userId, conn);
        if (amount > available) {
            await conn.rollback();
            return { error: 'The amount is larger than the available balance', status: 409 };
        }
        const [w] = await conn.query(
            'INSERT INTO withdrawals (User_ID, Amount, Method, Destination) VALUES (?, ?, ?, ?)',
            [userId, amount, toCard ? 'card' : 'iban', target]
        );
        await conn.query(
            `INSERT INTO wallet_transactions (User_ID, Type, Amount, Status, Ref, Withdrawal_ID, Description)
             VALUES (?, 'withdrawal', ?, 'pending', ?, ?, ?)`,
            [userId, -amount, `withdrawal:${w.insertId}`, w.insertId, toCard ? `Withdrawal to card ${target}` : `Withdrawal to ${target.slice(0, 6)}…${target.slice(-4)}`]
        );
        await conn.commit();
        return { withdrawal: { id: w.insertId, amount, method: toCard ? 'card' : 'iban', destination: target, status: 'pending' } };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Marks a pending (or, for card payouts, processing) withdrawal paid or rejected; rejected money returns
 * to the balance. Used by the admin script and by automatic card payouts. Returns null if already done.
 */
async function processWithdrawal(withdrawalId, outcome, note = null, providerStatus = null) {
    if (!['paid', 'rejected'].includes(outcome)) throw new Error('outcome must be paid or rejected');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [r] = await conn.query(
            `UPDATE withdrawals SET Status = ?, Note = ?, Provider_Status = COALESCE(?, Provider_Status), Processed_At = NOW()
              WHERE Withdrawal_ID = ? AND Status IN ('pending', 'processing')`,
            [outcome, note, providerStatus, withdrawalId]
        );
        if (!r.affectedRows) { await conn.rollback(); return null; }
        await conn.query(
            'UPDATE wallet_transactions SET Status = ? WHERE Withdrawal_ID = ? AND Type = \'withdrawal\'',
            [outcome === 'paid' ? 'completed' : 'rejected', withdrawalId]
        );
        const [[w]] = await conn.query('SELECT * FROM withdrawals WHERE Withdrawal_ID = ?', [withdrawalId]);
        await conn.commit();
        return w;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    feePercent, minWithdrawal, split,
    creditSale, creditCommission, releaseCommission,
    balance, normalizeIban, requestWithdrawal, processWithdrawal,
};
