// Automatic payouts to a card through WayForPay (Card Verify + Account2Card), with a WayForPay double.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, wfp, startApp, stopApp, client, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');
const payouts = require('../services/payouts');
const { sent } = require('../utils/mailer');

let app, call, f, as;
const TOKEN = 'rec-token-0123456789abcdef';

before(async () => {
    process.env.PAYOUTS = 'wayforpay';
    app = await startApp();
    call = client(app.api);
    f = await createFixtures();
    as = { artist: await sessionFor(f, f.artist), customer: await sessionFor(f, f.customer) };
    // 1000 UAH available to the artist
    await db.query(
        `INSERT INTO wallet_transactions (User_ID, Type, Amount, Status, Ref, Description)
         VALUES (?, 'adjustment', 100000, 'completed', ?, 'test balance')`,
        [f.artist.id, `${f.tag}-balance`]
    );
});

after(async () => {
    delete process.env.PAYOUTS;
    await cleanupFixtures(f);
    await stopApp(app);
});

const available = async () => (await call('GET', '/wallet', { cookie: as.artist })).data.balance.available;

// A WayForPay notification signed like the real ones
function notification(fields) {
    const d = {
        merchantAccount: 'test_merch_n1', amount: 0, currency: 'UAH', authCode: '541963', cardPan: '41****8217',
        cardType: 'Visa', transactionStatus: 'Approved', reasonCode: 1100, reason: 'Ok', ...fields,
    };
    d.merchantSignature = fields.merchantSignature || wfp.sign(
        [d.merchantAccount, d.orderReference, d.amount, d.currency, d.authCode, d.cardPan, d.transactionStatus, d.reasonCode]);
    return d;
}

describe('linking a payout card', () => {
    let orderReference;

    test('artists get a signed Card Verify form; customers cannot', async () => {
        assert.deepEqual((await call('GET', '/payouts/card', { cookie: as.artist })).data, { success: true, enabled: true, card: null });
        const r = await call('POST', '/payouts/card/verify', { cookie: as.artist, lang: 'uk' });
        assert.equal(r.status, 200);
        assert.equal(r.data.action, 'https://secure.wayforpay.com/verify');
        const fl = r.data.fields;
        orderReference = fl.orderReference;
        assert.match(orderReference, /^vrf_[0-9a-f]{32}$/);
        assert.equal(fl.amount, '0');
        assert.equal(fl.language, 'UA');
        assert.equal(fl.serviceUrl, 'https://api.test/api/payouts/callback/wayforpay');
        assert.equal(fl.merchantSignature, wfp.sign([fl.merchantAccount, fl.merchantDomainName, orderReference, '0', 'UAH']));
        assert.equal((await call('POST', '/payouts/card/verify', { cookie: as.customer })).status, 403);
    });

    test('a notification with a wrong signature links nothing', async () => {
        const forged = notification({ orderReference, recToken: 'attacker-token', merchantSignature: 'deadbeef' });
        assert.equal((await call('POST', '/payouts/callback/wayforpay', { json: forged })).status, 400);
        assert.equal((await call('GET', '/payouts/card', { cookie: as.artist })).data.card, null);
        assert.ok((await call('GET', `/payouts/card/return?order=${orderReference}`)).headers.get('location').endsWith('card=pending'));
    });

    test('the signed result links the card; only the encrypted token and the mask are stored', async () => {
        const r = await call('POST', '/payouts/callback/wayforpay', { raw: JSON.stringify(notification({ orderReference, recToken: TOKEN })) });
        assert.equal(r.status, 200);
        assert.equal(r.data.status, 'accept');
        assert.equal(r.data.signature, wfp.sign([orderReference, 'accept', r.data.time]));

        const card = (await call('GET', '/payouts/card', { cookie: as.artist })).data.card;
        assert.equal(card.mask, '41****8217');
        const [[row]] = await db.query('SELECT Token_Enc FROM payout_cards WHERE User_ID = ?', [f.artist.id]);
        assert.ok(!row.Token_Enc.includes(TOKEN));
        assert.equal(payouts._internal.decryptToken(row.Token_Enc), TOKEN);
        assert.equal((await call('GET', `/payouts/card/return?order=${orderReference}`)).headers.get('location'),
            'http://app.test/profile?tab=wallet&card=ok');
        assert.ok((await call('GET', '/payouts/card/return?order=junk')).headers.get('location').endsWith('card=fail'));
    });
});

describe('card withdrawals', () => {
    test('an approved payout is paid at once with the card token', async () => {
        const before = await available();
        const mailsBefore = sent.length;
        const r = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 200, method: 'card' } });
        assert.equal(r.status, 201, JSON.stringify(r.data));
        assert.equal(r.data.withdrawal.status, 'paid');
        const req = wfp.lastCredit;
        assert.equal(req.orderReference, `payout_${r.data.withdrawal.id}`);
        assert.equal(req.amount, '200.00');
        assert.equal(req.rec2Token, TOKEN);
        assert.equal(req.cardBeneficiary, undefined);
        assert.equal(req.merchantSignature, wfp.sign(['test_merch_n1', req.orderReference, '200.00', 'UAH', '', TOKEN]));
        assert.equal(await available(), Math.round((before - 200) * 100) / 100);
        assert.ok(sent.slice(mailsBefore).some((m) => m.to === f.artist.email));
        const w = (await call('GET', '/wallet', { cookie: as.artist })).data.withdrawals.find((x) => x.id === r.data.withdrawal.id);
        assert.equal(w.method, 'card');
        assert.equal(w.destination, '41****8217');
    });

    test('a declined payout returns the money to the balance', async () => {
        const before = await available();
        wfp.nextCredits.push({ transactionStatus: 'Declined', reason: 'Card is blocked', reasonCode: 1101 });
        const r = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 150, method: 'card' } });
        assert.equal(r.data.withdrawal.status, 'rejected');
        assert.equal(await available(), before);
        const [[w]] = await db.query('SELECT Note, Provider_Status FROM withdrawals WHERE Withdrawal_ID = ?', [r.data.withdrawal.id]);
        assert.deepEqual({ ...w }, { Note: 'Card is blocked', Provider_Status: 'Declined' });
    });

    test('an unconfirmed answer keeps it processing until CHECK_STATUS or a notification says otherwise', async () => {
        wfp.nextCredits.push({ transactionStatus: 'Approved', badSignature: true });
        const r = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 100, method: 'card' } });
        const id = r.data.withdrawal.id;
        assert.equal(r.data.withdrawal.status, 'processing');

        // the scheduler asks CHECK_STATUS (only for requests older than a minute)
        await db.query('UPDATE withdrawals SET Created_At = NOW() - INTERVAL 2 MINUTE WHERE Withdrawal_ID = ?', [id]);
        wfp.statuses[`payout_${id}`] = { transactionStatus: 'Approved', amount: 100 };
        const calls = wfp.lastCredit;
        await payouts.payoutTick();
        assert.equal(wfp.lastCredit, calls, 'not sent a second time');
        const [[w]] = await db.query('SELECT Status FROM withdrawals WHERE Withdrawal_ID = ?', [id]);
        assert.equal(w.Status, 'paid');
    });

    test('a payout notification finishes a processing withdrawal', async () => {
        wfp.nextCredits.push({ transactionStatus: 'InProcessing' });
        const r = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 100, method: 'card' } });
        assert.equal(r.data.withdrawal.status, 'processing');
        const n = notification({ orderReference: `payout_${r.data.withdrawal.id}`, amount: 100 });
        assert.equal((await call('POST', '/payouts/callback/wayforpay', { json: n })).status, 200);
        const [[w]] = await db.query('SELECT Status FROM withdrawals WHERE Withdrawal_ID = ?', [r.data.withdrawal.id]);
        assert.equal(w.Status, 'paid');
    });

    test('without a linked card or with payouts off, card withdrawals are refused', async () => {
        const noCard = await call('POST', '/wallet/withdrawals', { cookie: as.customer, json: { amount: 100, method: 'card' } });
        assert.equal(noCard.status, 400);
        assert.equal(noCard.data.message, 'Link a card for payouts first');
        delete process.env.PAYOUTS;
        try {
            const off = await call('POST', '/wallet/withdrawals', { cookie: as.artist, json: { amount: 100, method: 'card' }, lang: 'uk' });
            assert.equal(off.status, 400);
            assert.equal(off.data.message, 'Виплати на картку недоступні');
        } finally {
            process.env.PAYOUTS = 'wayforpay';
        }
    });

    test('removing the card', async () => {
        assert.equal((await call('DELETE', '/payouts/card', { cookie: as.artist })).status, 200);
        assert.equal((await call('GET', '/payouts/card', { cookie: as.artist })).data.card, null);
    });
});
