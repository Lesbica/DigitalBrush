// Phase 5: wallet — earnings from sales and commissions (escrow), withdrawals.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, PNG, wfp, startApp, stopApp, client, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');
const wallet = require('../services/wallet');

let app, call, f, as;

// IBAN with a valid checksum (UA21 3223 1300 0002 6007 2335 6600 1 — the standard example)
const VALID_IBAN = 'UA213223130000026007233566001';

before(async () => {
    process.env.PLATFORM_FEE_PERCENT = '10';
    app = await startApp();
    call = client(app.api);
    f = await createFixtures();
    as = {
        customer: await sessionFor(f, f.customer),
        artist: await sessionFor(f, f.artist),
        outsider: await sessionFor(f, f.outsider),
    };
});

after(async () => {
    delete process.env.PLATFORM_FEE_PERCENT;
    await cleanupFixtures(f);
    await stopApp(app);
});

const getWallet = async (cookie) => (await call('GET', '/wallet', { cookie })).data;

async function payFor(cookie, body) {
    const r = await call('POST', '/payments/create-session', { cookie, json: body });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const [[o]] = await db.query('SELECT Amount FROM payment_orders WHERE Order_ID = ?', [r.data.orderId]);
    const cb = await call('POST', '/payments/callback/wayforpay', { json: wfp.callback(r.data.orderId, o.Amount / 100) });
    assert.equal(cb.status, 200);
    return r.data.orderId;
}

describe('earnings', () => {
    test('painting sale is credited to the artist minus the platform fee', async () => {
        await payFor(as.outsider, { paintingIds: [f.paintings.a] }); // 123.00 UAH, fee 10%
        const w = await getWallet(as.artist);
        assert.equal(w.balance.available, 110.7);
        assert.equal(w.transactions[0].type, 'sale');
        assert.equal(w.transactions[0].fee, 12.3);
        assert.equal(w.transactions[0].payer, f.outsider.name);
        const [[n]] = await db.query("SELECT COUNT(*) AS n FROM notifications WHERE User_ID = ? AND Type = 'painting_sold'", [f.artist.id]);
        assert.equal(n.n, 1);
    });

    test('a repeated payment callback does not credit twice', async () => {
        const before = (await getWallet(as.artist)).balance.available;
        const orderId = await payFor(as.outsider, { paintingIds: [f.paintings.b] });
        await call('POST', '/payments/callback/wayforpay', { json: wfp.callback(orderId, 123) });
        assert.equal((await getWallet(as.artist)).balance.available, Math.round((before + 110.7) * 100) / 100);
    });

    test('commission paid before completion stays in escrow until the final stage is approved', async () => {
        const id = f.commissions.inProgress; // 300 UAH, status Sketch
        const before = (await getWallet(as.artist)).balance;
        await payFor(as.customer, { type: 'commission', commissionId: id });
        let w = await getWallet(as.artist);
        assert.equal(w.balance.escrow, 270);
        assert.equal(w.balance.available, before.available);

        await db.query("UPDATE commissions SET status = 'Final' WHERE Commission_ID = ?", [id]);
        await call('POST', `/commissions/chat/${id}/submit-stage`, { cookie: as.artist, json: { image: 'data:image/png;base64,' + PNG.toString('base64') } });
        await call('POST', `/commissions/chat/${id}/review`, { cookie: as.customer, json: { decision: 'approve' } });
        w = await getWallet(as.artist);
        assert.equal(w.balance.escrow, 0);
        assert.equal(w.balance.available, Math.round((before.available + 270) * 100) / 100);
    });

    test('a wallet is private', async () => {
        assert.equal((await call('GET', '/wallet')).status, 401);
        assert.equal((await getWallet(as.customer)).balance.available, 0);
    });
});

describe('withdrawals', () => {
    test('IBAN, minimum and balance are checked', async () => {
        const req = (body) => call('POST', '/wallet/withdrawals', { cookie: as.artist, json: body });
        assert.equal((await req({ amount: 150, iban: 'UA00 0000' })).status, 400);
        assert.equal((await req({ amount: 150, iban: VALID_IBAN.replace(/1$/, '2') })).status, 400, 'bad checksum');
        assert.equal((await req({ amount: 50, iban: VALID_IBAN })).status, 400, 'below minimum');
        assert.equal((await req({ amount: 100000, iban: VALID_IBAN })).status, 409, 'more than available');
    });

    test('request reserves the amount; rejection returns it, payment completes it', async () => {
        const start = (await getWallet(as.artist)).balance.available;
        const r = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 200, iban: `UA21 3223 1300 0002 6007 2335 6600 1` } });
        assert.equal(r.status, 201, JSON.stringify(r.data));
        let w = await getWallet(as.artist);
        assert.equal(w.balance.available, Math.round((start - 200) * 100) / 100);
        assert.equal(w.balance.withdrawing, 200);
        assert.equal(w.withdrawals[0].destination, 'UA21 •••• 6001');

        await wallet.processWithdrawal(r.data.withdrawal.id, 'rejected', 'test');
        w = await getWallet(as.artist);
        assert.equal(w.balance.available, start);
        assert.equal(w.withdrawals[0].status, 'rejected');

        const r2 = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 100, iban: VALID_IBAN } });
        await wallet.processWithdrawal(r2.data.withdrawal.id, 'paid');
        w = await getWallet(as.artist);
        assert.equal(w.balance.available, Math.round((start - 100) * 100) / 100);
        assert.equal(w.balance.withdrawing, 0);
        assert.equal(await wallet.processWithdrawal(r2.data.withdrawal.id, 'rejected'), null, 'already processed');
    });

    test('two simultaneous requests cannot overdraw the balance', async () => {
        const available = (await getWallet(as.artist)).balance.available;
        const half = Math.floor(available * 0.6);
        const results = await Promise.all([1, 2].map(() =>
            call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: half, iban: VALID_IBAN } })));
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    });
});
