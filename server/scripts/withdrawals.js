#!/usr/bin/env node
// Manual processing of withdrawal requests (the money is sent from the bank by hand).
//   node server/scripts/withdrawals.js list
//   node server/scripts/withdrawals.js pay <id> [note]
//   node server/scripts/withdrawals.js reject <id> [note]   (the amount returns to the artist's balance)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const db = require('../config/db');
const wallet = require('../services/wallet');
const { walletEvents } = require('../services/notifications');

async function main() {
    const [cmd, id, ...noteParts] = process.argv.slice(2);
    const note = noteParts.join(' ') || null;

    if (cmd === 'list') {
        const [rows] = await db.query(
            // IBAN requests wait to be paid by hand; card payouts are listed only while their result is unknown
            `SELECT w.Withdrawal_ID AS id, c.Name AS artist, c.Email AS email, w.Amount / 100 AS uah, w.Method AS method,
                    w.Destination AS destination, w.Status AS status, w.Provider_Status AS provider, w.Created_At AS created
               FROM withdrawals w JOIN creators c ON c.Creator_ID = w.User_ID
              WHERE w.Status IN ('pending', 'processing') ORDER BY w.Created_At`
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
        if (cmd === 'pay') await walletEvents.withdrawalPaid(w.User_ID, { amount: w.Amount });
        else await walletEvents.withdrawalRejected(w.User_ID, { amount: w.Amount, note });
        console.log(`Withdrawal ${id} marked ${w.Status}`);
        return;
    }
    console.log('Usage: withdrawals.js list | pay <id> [note] | reject <id> [note]');
    process.exitCode = 1;
}

main()
    .catch((err) => { console.error(err.message); process.exitCode = 1; })
    .finally(() => db.end());
