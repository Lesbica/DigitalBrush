#!/usr/bin/env node
// Manual processing of withdrawal requests (the money is sent from the bank by hand).
//   node server/scripts/withdrawals.js list
//   node server/scripts/withdrawals.js pay <id> [note]
//   node server/scripts/withdrawals.js reject <id> [note]   (the amount returns to the artist's balance)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const db = require('../config/db');
const wallet = require('../services/wallet');
const { notify } = require('../services/notifications');

async function main() {
    const [cmd, id, ...noteParts] = process.argv.slice(2);
    const note = noteParts.join(' ') || null;

    if (cmd === 'list') {
        const [rows] = await db.query(
            `SELECT w.Withdrawal_ID AS id, c.Name AS artist, c.Email AS email, w.Amount / 100 AS uah, w.Destination AS iban, w.Created_At AS created
               FROM withdrawals w JOIN creators c ON c.Creator_ID = w.User_ID
              WHERE w.Status = 'pending' ORDER BY w.Created_At`
        );
        console.table(rows);
        return;
    }
    if ((cmd === 'pay' || cmd === 'reject') && Number(id) > 0) {
        const w = await wallet.processWithdrawal(Number(id), cmd === 'pay' ? 'paid' : 'rejected', note);
        if (!w) {
            console.log(`Withdrawal ${id} not found or already processed`);
            process.exitCode = 1;
            return;
        }
        await notify(w.User_ID, cmd === 'pay'
            ? { type: 'withdrawal_paid', title: 'Withdrawal sent', body: `${(w.Amount / 100).toFixed(2)} UAH was sent to your account.`, link: '/profile?tab=wallet', email: true }
            : { type: 'withdrawal_rejected', title: 'Withdrawal rejected', body: `Your withdrawal of ${(w.Amount / 100).toFixed(2)} UAH was rejected${note ? `: ${note}` : ''}. The amount is back in your balance.`, link: '/profile?tab=wallet', email: true });
        console.log(`Withdrawal ${id} marked ${w.Status}`);
        return;
    }
    console.log('Usage: withdrawals.js list | pay <id> [note] | reject <id> [note]');
    process.exitCode = 1;
}

main()
    .catch((err) => { console.error(err.message); process.exitCode = 1; })
    .finally(() => db.end());
