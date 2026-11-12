// Current user's wallet: balance, earnings/withdrawal history, withdrawal requests.
// Amounts in responses are in UAH (2 decimals); the DB stores kopecks.
const express = require('express');
const db = require('../config/db');
const logger = require('../utils/logger');
const auth = require('../middleware/authMiddleware');
const wallet = require('../services/wallet');
const { getSessionUserId } = require('../utils/commissionAccess');

const router = express.Router();
router.use(auth);

const uah = (kopecks) => Math.round(Number(kopecks)) / 100;

// GET /api/wallet → { balance, transactions, withdrawals, feePercent, minWithdrawal }
router.get('/', async (req, res) => {
    const userId = getSessionUserId(req);
    try {
        const b = await wallet.balance(userId);
        const [txns] = await db.query(
            `SELECT t.Txn_ID, t.Type, t.Amount, t.Fee, t.Status, t.Description, t.Created_At,
                    t.Commission_ID, t.Painting_ID, t.Withdrawal_ID, p.Name AS payer_name
               FROM wallet_transactions t
               LEFT JOIN creators p ON p.Creator_ID = t.Payer_ID
              WHERE t.User_ID = ?
              ORDER BY t.Created_At DESC, t.Txn_ID DESC
              LIMIT 200`,
            [userId]
        );
        const [withdrawals] = await db.query(
            `SELECT Withdrawal_ID, Amount, Destination, Status, Note, Created_At, Processed_At
               FROM withdrawals WHERE User_ID = ? ORDER BY Created_At DESC LIMIT 50`,
            [userId]
        );
        res.json({
            success: true,
            balance: { available: uah(b.available), escrow: uah(b.escrow), withdrawing: uah(b.withdrawing) },
            feePercent: wallet.feePercent(),
            minWithdrawal: wallet.minWithdrawal() / 100,
            transactions: txns.map((t) => ({
                id: t.Txn_ID,
                type: t.Type,
                amount: uah(t.Amount),
                fee: uah(t.Fee),
                status: t.Status,
                description: t.Description || '',
                payer: t.payer_name || null,
                commissionId: t.Commission_ID,
                paintingId: t.Painting_ID,
                withdrawalId: t.Withdrawal_ID,
                createdAt: t.Created_At,
            })),
            withdrawals: withdrawals.map((w) => ({
                id: w.Withdrawal_ID,
                amount: uah(w.Amount),
                // only the end of the account number is shown back
                destination: `${w.Destination.slice(0, 4)} •••• ${w.Destination.slice(-4)}`,
                status: w.Status,
                note: w.Note || '',
                createdAt: w.Created_At,
                processedAt: w.Processed_At,
            })),
        });
    } catch (err) {
        logger.error('Wallet error:', err);
        res.status(500).json({ success: false, message: 'Error loading the wallet' });
    }
});

// POST /api/wallet/withdrawals { amount (UAH), iban }
router.post('/withdrawals', async (req, res) => {
    const amountUah = Number(req.body?.amount);
    if (!Number.isFinite(amountUah) || amountUah <= 0) {
        return res.status(400).json({ success: false, message: 'Enter the amount to withdraw' });
    }
    try {
        const result = await wallet.requestWithdrawal(getSessionUserId(req), Math.round(amountUah * 100), req.body?.iban);
        if (result.error) return res.status(result.status).json({ success: false, message: result.error });
        res.status(201).json({ success: true, withdrawal: { ...result.withdrawal, amount: uah(result.withdrawal.amount) } });
    } catch (err) {
        logger.error('Withdrawal error:', err);
        res.status(500).json({ success: false, message: 'Error creating the withdrawal request' });
    }
});

module.exports = router;
