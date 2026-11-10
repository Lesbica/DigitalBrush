// Phase 0 regressions: data leaks, access control, payments, sessions, sockets.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
    db, PASSWORD, wfp, realFetch, startApp, stopApp, client,
    createFixtures, sessionFor, sessionIdFromSetCookie, cleanupFixtures,
} = require('./helpers');

let app, call, f, as;

before(async () => {
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
    await cleanupFixtures(f);
    await stopApp(app);
});

const purchasesOf = async (userId) =>
    (await db.query('SELECT Painting_ID FROM user_purchases WHERE User_ID = ? ORDER BY Painting_ID', [userId]))[0].map((r) => r.Painting_ID);

describe('no private user data in public endpoints', () => {
    test('artists list hides Password/Email/Birthday', async () => {
        const r = await call('GET', '/artists/getartists');
        assert.equal(r.status, 200);
        for (const a of r.data) for (const k of ['Password', 'Email', 'Birthday', 'email']) assert.ok(!(k in a), `leaked ${k}`);
    });
    test('single artist hides Password/Email', async () => {
        const r = await call('GET', `/artists/artist/${f.artist.id}`);
        assert.equal(r.status, 200);
        assert.ok(!('Password' in r.data) && !('Email' in r.data) && !('email' in r.data));
    });
    test('public commissions have no customer_email', async () => {
        const r = await call('GET', '/commissions/public');
        const mine = r.data.commissions.find((c) => c.id === f.commissions.openPublic);
        assert.ok(mine && !('customer_email' in mine));
    });
});

describe('commission access control', () => {
    test('anonymous can see an open public commission', async () => {
        assert.equal((await call('GET', `/commissions/${f.commissions.openPublic}`)).status, 200);
    });
    test('anonymous cannot see a commission in progress', async () => {
        assert.equal((await call('GET', `/commissions/${f.commissions.inProgress}`)).status, 403);
    });
    test('anonymous status change is rejected', async () => {
        assert.equal((await call('PATCH', `/commissions/${f.commissions.inProgress}/status`, { json: { status: 'Completed' } })).status, 401);
    });
    test('outsider cannot read chat, change status or see a completed commission', async () => {
        assert.equal((await call('GET', `/commissions/chat/${f.commissions.inProgress}/messages`, { cookie: as.outsider })).status, 403);
        assert.equal((await call('PATCH', `/commissions/${f.commissions.inProgress}/status`, { cookie: as.outsider, json: { status: 'Cancelled' } })).status, 403);
        assert.equal((await call('GET', `/commissions/${f.commissions.paid}`, { cookie: as.outsider })).status, 403);
    });
    test('outsider cannot accept a direct commission addressed to another artist', async () => {
        assert.equal((await call('PATCH', `/commissions/${f.commissions.directOpen}/accept`, { cookie: as.outsider })).status, 404);
        const [[c]] = await db.query('SELECT Creator_ID FROM commissions WHERE Commission_ID = ?', [f.commissions.directOpen]);
        assert.equal(c.Creator_ID, f.artist.id);
    });
    test('unread counter only for own account; read mark only by receiver', async () => {
        assert.equal((await call('GET', `/commissions/chat/unread-count/${f.customer.id}`)).status, 401);
        assert.equal((await call('GET', `/commissions/chat/unread-count/${f.customer.id}`, { cookie: as.outsider })).status, 403);
        assert.equal((await call('PATCH', `/commissions/chat/${f.commissions.inProgress}/messages/${f.messageId}/read`, { cookie: as.outsider })).status, 403);
        assert.equal((await call('PATCH', `/commissions/chat/${f.commissions.inProgress}/messages/${f.messageId}/read`, { cookie: as.artist })).status, 200);
        const [[m]] = await db.query('SELECT status FROM messages WHERE id = ?', [f.messageId]);
        assert.equal(m.status, 'read');
    });
    test('participant reads chat', async () => {
        const r = await call('GET', `/commissions/chat/${f.commissions.inProgress}/messages`, { cookie: as.customer });
        assert.equal(r.status, 200);
        assert.equal(r.data.messages.length, 1);
    });
    test('result image: hidden from unpaid customer, visible to artist and paid customer', async () => {
        assert.equal((await call('GET', `/commissions/${f.commissions.inProgress}`, { cookie: as.customer })).data.commission.resultImage, null);
        assert.ok((await call('GET', `/commissions/${f.commissions.inProgress}`, { cookie: as.artist })).data.commission.resultImage);
        assert.ok((await call('GET', `/commissions/${f.commissions.paid}`, { cookie: as.customer })).data.commission.resultImage);
    });
    test('status endpoint only allows cancellation', async () => {
        assert.equal((await call('PATCH', `/commissions/${f.commissions.inProgress}/status`, { cookie: as.customer, json: { status: 'Completed' } })).status, 400);
        assert.equal((await call('PATCH', `/commissions/${f.commissions.paid}/status`, { cookie: as.customer, json: { status: 'Cancelled' } })).status, 409);
    });
});

describe('payments (WayForPay)', () => {
    test('outsider cannot pay for somebody else\'s commission', async () => {
        assert.equal((await call('POST', '/payments/create-session', { cookie: as.outsider, json: { type: 'commission', commissionId: f.commissions.inProgress } })).status, 403);
    });
    test('cannot buy own painting or an already purchased one', async () => {
        assert.equal((await call('POST', '/payments/create-session', { cookie: as.customer, json: { paintingIds: [f.paintings.customerOwn] } })).status, 400);
        assert.equal((await call('POST', '/payments/create-session', { cookie: as.customer, json: { paintingIds: [f.paintings.sold] } })).status, 409);
    });

    let orderId;
    test('client amount is ignored; DB prices are sent and stored', async () => {
        const r = await call('POST', '/payments/create-session', { cookie: as.outsider, json: { amount: 1, paintingIds: [f.paintings.a, f.paintings.b] } });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        assert.equal(r.data.checkoutUrl, 'https://secure.wayforpay.com/page?vkh=test');
        orderId = r.data.orderId;
        assert.equal(wfp.lastPurchase.amount, '246.00');
        assert.deepEqual(wfp.lastPurchase.productPrice, ['123.00', '123.00']);
        assert.equal(wfp.lastPurchase.serviceUrl, 'https://api.test/api/payments/callback/wayforpay');
        const [[o]] = await db.query('SELECT Amount, Currency, Status, Provider FROM payment_orders WHERE Order_ID = ?', [orderId]);
        assert.deepEqual({ ...o }, { Amount: 24600, Currency: 'UAH', Status: 'pending', Provider: 'wayforpay' });
    });
    test('return while payment is still processing grants nothing', async () => {
        const r = await call('GET', `/payments/return/wayforpay?order=${orderId}`);
        assert.ok(r.headers.get('location').endsWith('/fail'));
        assert.deepEqual(await purchasesOf(f.outsider.id), []);
    });
    test('callback with a forged signature is rejected', async () => {
        assert.equal((await call('POST', '/payments/callback/wayforpay', { json: wfp.callback(orderId, 246, 'Approved', { badSignature: true }) })).status, 400);
        assert.deepEqual(await purchasesOf(f.outsider.id), []);
    });
    test('signed callback with a lower amount is not accepted', async () => {
        assert.equal((await call('POST', '/payments/callback/wayforpay', { json: wfp.callback(orderId, 1) })).status, 200);
        assert.deepEqual(await purchasesOf(f.outsider.id), []);
        const [[o]] = await db.query('SELECT Status FROM payment_orders WHERE Order_ID = ?', [orderId]);
        assert.equal(o.Status, 'amount_mismatch');
    });
    test('signed callback grants the purchase once and answers with a signed accept', async () => {
        const r = await call('POST', '/payments/create-session', { cookie: as.outsider, json: { paintingIds: [f.paintings.a, f.paintings.b] } });
        const order2 = r.data.orderId;
        // WayForPay may send the JSON body with a form or text content type
        const res1 = await call('POST', '/payments/callback/wayforpay', { json: wfp.callback(order2, 246), contentType: 'application/x-www-form-urlencoded' });
        assert.equal(res1.status, 200);
        assert.equal(res1.data.status, 'accept');
        assert.equal(res1.data.signature, wfp.sign([order2, 'accept', res1.data.time]));
        const res2 = await call('POST', '/payments/callback/wayforpay', { raw: JSON.stringify(wfp.callback(order2, 246)) });
        assert.equal(res2.status, 200);
        assert.deepEqual(await purchasesOf(f.outsider.id), [f.paintings.a, f.paintings.b].sort((x, y) => x - y));
    });
    test('return after CHECK_STATUS Approved grants the purchase', async () => {
        const r = await call('POST', '/payments/create-session', { cookie: as.outsider, json: { paintingIds: [f.paintings.c] } });
        wfp.statuses[r.data.orderId] = { transactionStatus: 'Approved', amount: 123 };
        const ret = await call('POST', `/payments/return/wayforpay?order=${r.data.orderId}`, { form: { transactionStatus: 'Approved' } });
        assert.ok(ret.headers.get('location').endsWith('/success'));
        assert.ok((await purchasesOf(f.outsider.id)).includes(f.paintings.c));
    });
    test('commission price comes from the DB', async () => {
        const r = await call('POST', '/payments/create-session', { cookie: as.customer, json: { type: 'commission', commissionId: f.commissions.inProgress, amount: 1 } });
        assert.equal(r.status, 200);
        assert.equal(wfp.lastPurchase.amount, '300.00');
    });
    test('junk order reference and unsigned legacy Fondy return go to /fail', async () => {
        assert.ok((await call('GET', '/payments/return/wayforpay?order=../../x')).headers.get('location').endsWith('/fail'));
        assert.ok((await call('GET', '/fondy/return?order_status=approved&order_id=x')).headers.get('location').endsWith('/fail'));
    });
});

describe('sessions', () => {
    test('login stores a small session in MySQL; logout removes it', async () => {
        const r = await realFetch(app.api + '/auth/login', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: f.outsider.email, password: PASSWORD }),
        });
        assert.equal(r.status, 200);
        const body = await r.json(); // session is saved before the body ends
        assert.ok(body.user.profileImage);
        const setCookie = r.headers.get('set-cookie');
        assert.match(setCookie, /^bestart\.sid=/);
        assert.match(setCookie, /SameSite=Lax/i);
        assert.match(setCookie, /HttpOnly/i);
        const sid = sessionIdFromSetCookie(setCookie);
        f.sessionIds.push(sid);
        const [[row]] = await db.query('SELECT LENGTH(data) AS len, data FROM sessions WHERE session_id = ?', [sid]);
        assert.ok(row.len < 1000, `session is ${row.len} bytes`);
        assert.ok(!row.data.includes('profileImage'));
        const cookie = setCookie.split(';')[0];
        assert.equal((await call('GET', '/auth/check-session', { cookie })).data.loggedIn, true);
        const out = await call('POST', '/auth/logout', { cookie });
        assert.match(out.headers.get('set-cookie'), /bestart\.sid=;/);
        const [rows] = await db.query('SELECT 1 FROM sessions WHERE session_id = ?', [sid]);
        assert.equal(rows.length, 0);
    });
});

describe('socket.io rooms', () => {
    const { io } = require('socket.io-client');
    const connect = (cookie) => io(app.base, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false, forceNew: true });
    const join = (cookie, room) => new Promise((resolve, reject) => {
        const s = connect(cookie);
        const timer = setTimeout(() => { s.close(); reject(new Error('timeout')); }, 3000);
        s.on('connect', () => s.emit('join', room, (ack) => { clearTimeout(timer); s.close(); resolve(ack); }));
        s.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
    });

    test('anonymous socket is disconnected', async () => {
        await new Promise((resolve, reject) => {
            const s = connect(null);
            const timer = setTimeout(() => { s.close(); reject(new Error('no authError')); }, 3000);
            s.on('authError', () => { clearTimeout(timer); s.close(); resolve(); });
        });
    });
    test('participant joins, outsider is refused', async () => {
        assert.deepEqual(await join(as.customer, `commission_${f.commissions.inProgress}`), { ok: true });
        assert.deepEqual(await join(as.outsider, `commission_${f.commissions.inProgress}`), { ok: false, error: 'forbidden' });
    });
});
