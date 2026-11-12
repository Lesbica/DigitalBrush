// Shared setup for API integration tests (node:test).
// Runs the real Express app in-process against the LOCAL database from server/.env.
// Every test file creates its own users/paintings/commissions and removes them afterwards.
const path = require('path');
const http = require('http');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

// Test-only overrides: plain-HTTP cookies and the public WayForPay test merchant.
Object.assign(process.env, {
    LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
    COOKIE_SECURE: 'false',
    PAYMENT_PROVIDER: 'wayforpay',
    WAYFORPAY_MERCHANT_ACCOUNT: 'test_merch_n1',
    WAYFORPAY_SECRET_KEY: 'flk3409refn54t54t*FNJRET',
    WAYFORPAY_DOMAIN: 'test.local',
    API_URL: 'https://api.test/api',
    APP_URL: 'http://app.test',
});

const bcrypt = require('bcrypt');
const signature = require('cookie-signature');
const db = require('../config/db');
const wayforpay = require('../payments/providers/wayforpay');

const PASSWORD = 'Test-pass-1';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// ---------- WayForPay mock (no network) ----------
const realFetch = globalThis.fetch;
const wfp = {
    statuses: {},      // orderReference -> { transactionStatus, amount }
    lastPurchase: null,
    sign: wayforpay._internal.sign,
    callback(orderReference, amount, transactionStatus = 'Approved', { badSignature = false } = {}) {
        const d = {
            merchantAccount: 'test_merch_n1', orderReference, amount, currency: 'UAH',
            authCode: '541963', cardPan: '41****8217', transactionStatus, reasonCode: 1100,
        };
        d.merchantSignature = badSignature ? 'deadbeef' : wayforpay._internal.sign(wayforpay._internal.statusSignatureValues(d));
        return d;
    },
};
globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://secure.wayforpay.com/pay')) {
        const params = new URLSearchParams(opts.body);
        wfp.lastPurchase = { ...Object.fromEntries(params), productPrice: params.getAll('productPrice[]') };
        return { status: 200, text: async () => JSON.stringify({ url: 'https://secure.wayforpay.com/page?vkh=test' }) };
    }
    if (u === 'https://api.wayforpay.com/api') {
        const req = JSON.parse(opts.body);
        const st = wfp.statuses[req.orderReference] || { transactionStatus: 'InProcessing', amount: 0 };
        const d = {
            merchantAccount: 'test_merch_n1', orderReference: req.orderReference, amount: st.amount, currency: 'UAH',
            authCode: '541963', cardPan: '41****8217', transactionStatus: st.transactionStatus, reasonCode: 1100,
        };
        d.merchantSignature = wayforpay._internal.sign(wayforpay._internal.statusSignatureValues(d));
        return { json: async () => d };
    }
    return realFetch(url, opts);
};

// ---------- app ----------
async function startApp() {
    const app = require('../app');
    const { init } = require('../socket');
    const server = http.createServer(app);
    init(server, { sessionMiddleware: app.locals.sessionMiddleware, corsOrigin: app.locals.corsOrigin });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    return { server, base, api: base + '/api', app };
}

// Closes everything that would keep the test process alive.
async function stopApp(running) {
    try { require('../socket').getIO().close(); } catch { /* not started */ }
    await new Promise((resolve) => running.server.close(() => resolve()));
    await running.app.locals.sessionStore.close();
    await db.end();
}

function client(api) {
    return async function call(method, url, { cookie, json, form, raw, contentType } = {}) {
        const headers = {};
        if (cookie) headers.cookie = cookie;
        let body;
        if (json !== undefined) { headers['content-type'] = contentType || 'application/json'; body = JSON.stringify(json); }
        else if (form instanceof FormData) body = form;
        else if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
        else if (raw !== undefined) { headers['content-type'] = contentType || 'text/plain'; body = raw; }
        const r = await realFetch(api + url, { method, headers, body, redirect: 'manual' });
        const buf = Buffer.from(await r.arrayBuffer());
        let data = null;
        try { data = JSON.parse(buf.toString('utf8')); } catch { /* not JSON */ }
        return { status: r.status, data, buf, headers: r.headers };
    };
}

function formWith(fields = {}, files = []) {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
    for (const [field, buffer, name, type] of files) f.append(field, new Blob([buffer], { type }), name);
    return f;
}

// ---------- fixtures ----------
async function createFixtures() {
    const tag = 'apitest-' + crypto.randomBytes(4).toString('hex');
    const hash = await bcrypt.hash(PASSWORD, 4);
    const f = { tag, sessionIds: [], extraEmails: [] };

    const user = async (role) => {
        const email = `${tag}-${role}@example.test`;
        const [r] = await db.query(
            'INSERT INTO creators (Name, Email, Password, styles, languages) VALUES (?, ?, ?, ?, ?)',
            [`${tag}-${role}`, email, hash, JSON.stringify(role === 'artist' ? ['Retro', `${tag}-style`] : []), '[]']
        );
        return { id: r.insertId, email, name: `${tag}-${role}` };
    };
    f.customer = await user('customer');
    f.artist = await user('artist');
    f.outsider = await user('outsider');

    const painting = async (owner, price, title) => {
        const [b] = await db.query('INSERT INTO painting_batches () VALUES ()');
        const [r] = await db.query(
            'INSERT INTO paintings (Title, Author, Creator_ID, Price, Image, Batch_ID, Creation_Date) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [title, owner.name, owner.id, price, PNG, b.insertId]
        );
        return r.insertId;
    };
    f.paintings = {
        a: await painting(f.artist, '123.00', `${tag} A`),
        b: await painting(f.artist, '123.00', `${tag} B`),
        c: await painting(f.artist, '123.00', `${tag} C`),
        sold: await painting(f.artist, '80.00', `${tag} sold`),
        customerOwn: await painting(f.customer, '50.00', `${tag} own`),
    };
    await db.query('INSERT INTO user_purchases (User_ID, Painting_ID) VALUES (?, ?)', [f.customer.id, f.paintings.sold]);

    const commission = async (fields) => {
        const c = {
            Title: `${tag} commission`, Description: 'test', Price: '300.00', Type: 'public', status: 'Open',
            Customer_ID: f.customer.id, Creator_ID: null, is_paid: 0, ReferenceImage: PNG, ResultImage: null, ...fields,
        };
        const [r] = await db.query(
            `INSERT INTO commissions (Title, Description, Price, Type, status, Customer_ID, Creator_ID, is_paid, ReferenceImage, Image2, ResultImage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.Title, c.Description, c.Price, c.Type, c.status, c.Customer_ID, c.Creator_ID, c.is_paid, c.ReferenceImage, c.Image2 || null, c.ResultImage]
        );
        return r.insertId;
    };
    f.commissions = {
        openPublic: await commission({ Price: '200.00' }),
        inProgress: await commission({ Type: 'direct', status: 'Sketch', Creator_ID: f.artist.id, ResultImage: PNG, Image2: PNG }),
        paid: await commission({ status: 'Completed', Creator_ID: f.artist.id, is_paid: 1, ResultImage: PNG }),
        directOpen: await commission({ Type: 'direct', Creator_ID: f.artist.id, Price: '150.00' }),
        legacy: await commission({ ReferenceImage: Buffer.from('data:image/png;base64,' + PNG.toString('base64')) }),
    };
    const [m] = await db.query(
        'INSERT INTO messages (senderId, receiverId, commissionId, type, content, status) VALUES (?, ?, ?, ?, ?, ?)',
        [f.customer.id, f.artist.id, f.commissions.inProgress, 'text', 'hello', 'unread']
    );
    f.messageId = m.insertId;
    return f;
}

// Session row for a fixture user, so tests can act as them without the login form.
async function sessionFor(f, u) {
    const sid = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 3600e3);
    const data = { cookie: { originalMaxAge: 3600e3, expires: expires.toISOString(), httpOnly: true, path: '/', sameSite: 'lax' }, user: { id: u.id, name: u.name, email: u.email } };
    await db.query('INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)', [sid, Math.floor(expires / 1000), JSON.stringify(data)]);
    f.sessionIds.push(sid);
    return `bestart.sid=${encodeURIComponent('s:' + signature.sign(sid, process.env.SESSION_SECRET))}`;
}

function sessionIdFromSetCookie(setCookie) {
    const value = decodeURIComponent(setCookie.split(';')[0].split('=')[1]);
    return signature.unsign(value.slice(2), process.env.SESSION_SECRET);
}

async function cleanupFixtures(f) {
    if (!f) return;
    const [users] = await db.query('SELECT Creator_ID FROM creators WHERE Email LIKE ?', [`${f.tag}-%`]);
    const extra = f.extraEmails.length ? (await db.query('SELECT Creator_ID FROM creators WHERE Email IN (?)', [f.extraEmails]))[0] : [];
    const ids = [...users, ...extra].map((u) => u.Creator_ID);
    if (ids.length) {
        const [comms] = await db.query('SELECT Commission_ID FROM commissions WHERE Customer_ID IN (?) OR Creator_ID IN (?)', [ids, ids]);
        const cids = comms.map((c) => c.Commission_ID);
        if (cids.length) {
            await db.query('DELETE FROM messages WHERE commissionId IN (?)', [cids]);
            await db.query('DELETE FROM commissions WHERE Commission_ID IN (?)', [cids]);
        }
        const [orders] = await db.query('SELECT Order_ID FROM payment_orders WHERE User_ID IN (?)', [ids]);
        if (orders.length) {
            const oids = orders.map((o) => o.Order_ID);
            await db.query('DELETE FROM payment_order_items WHERE Order_ID IN (?)', [oids]);
            await db.query('DELETE FROM payment_orders WHERE Order_ID IN (?)', [oids]);
        }
        const [paintings] = await db.query('SELECT Painting_ID, Batch_ID FROM paintings WHERE Creator_ID IN (?)', [ids]);
        if (paintings.length) {
            await db.query('DELETE FROM paintings WHERE Painting_ID IN (?)', [paintings.map((p) => p.Painting_ID)]);
            const bids = paintings.map((p) => p.Batch_ID).filter(Boolean);
            if (bids.length) await db.query('DELETE FROM painting_batches WHERE Batch_ID IN (?)', [bids]);
        }
        await db.query('DELETE FROM creators WHERE Creator_ID IN (?)', [ids]); // purchases/likes cascade
    }
    if (f.sessionIds.length) await db.query('DELETE FROM sessions WHERE session_id IN (?)', [f.sessionIds]);
}

module.exports = {
    db, PNG, PASSWORD, wfp, realFetch,
    startApp, stopApp, client, formWith,
    createFixtures, sessionFor, sessionIdFromSetCookie, cleanupFixtures,
};
