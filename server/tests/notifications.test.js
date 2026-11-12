// Phase 5: notifications (stored, live over socket.io, important ones by email).
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, PNG, startApp, stopApp, client, formWith, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');
const { sent } = require('../utils/mailer');

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

const list = async (cookie) => (await call('GET', '/notifications', { cookie })).data;
const mailsTo = (email) => sent.filter((m) => m.to === email);

describe('commission events notify the other side', () => {
    test('new direct order → artist (in-app + email)', async () => {
        const before = mailsTo(f.artist.email).length;
        const r = await call('POST', '/commissions/create', { cookie: as.customer, form: formWith({ title: `${f.tag} notify`, description: 'd', creatorId: f.artist.id }) });
        assert.equal(r.status, 201);
        const n = await list(as.artist);
        assert.equal(n.notifications[0].type, 'new_order');
        assert.equal(n.notifications[0].link, `/profile?commission=${r.data.commissionId}`);
        assert.ok(n.unread >= 1);
        assert.equal(mailsTo(f.artist.email).length, before + 1);
    });

    test('accept and decline → customer', async () => {
        const accepted = await call('PATCH', `/commissions/${f.commissions.openPublic}/accept`, { cookie: as.artist });
        assert.equal(accepted.status, 200);
        assert.equal((await list(as.customer)).notifications[0].type, 'commission_accepted');

        await call('PATCH', `/commissions/${f.commissions.directOpen}/decline`, { cookie: as.artist });
        assert.equal((await list(as.customer)).notifications[0].type, 'commission_declined');
    });

    test('chat messages are grouped into one unread notification per commission', async () => {
        const url = `/commissions/chat/${f.commissions.inProgress}/messages`;
        await call('POST', url, { cookie: as.customer, json: { type: 'text', content: 'first' } });
        await call('POST', url, { cookie: as.customer, json: { type: 'text', content: 'second' } });
        const msgs = (await list(as.artist)).notifications.filter((n) => n.type === 'message' && n.commissionId === f.commissions.inProgress);
        assert.equal(msgs.length, 1);
        assert.equal(msgs[0].body, 'second');
    });

    test('stage submitted → customer; review → artist; completion → customer', async () => {
        const id = f.commissions.inProgress;
        await db.query("UPDATE commissions SET status = 'Final' WHERE Commission_ID = ?", [id]);
        await call('POST', `/commissions/chat/${id}/submit-stage`, { cookie: as.artist, json: { image: 'data:image/png;base64,' + PNG.toString('base64') } });
        assert.equal((await list(as.customer)).notifications[0].type, 'stage_submitted');

        await call('POST', `/commissions/chat/${id}/review`, { cookie: as.customer, json: { decision: 'approve' } });
        assert.equal((await list(as.artist)).notifications[0].type, 'stage_approved');
        assert.equal((await list(as.customer)).notifications[0].type, 'commission_completed');
    });
});

describe('notification API', () => {
    test('read one, read all, and only own notifications', async () => {
        const mine = await list(as.customer);
        const first = mine.notifications.find((n) => !n.read);
        assert.equal((await call('PATCH', `/notifications/${first.id}/read`, { cookie: as.outsider })).status, 404);
        assert.equal((await call('PATCH', `/notifications/${first.id}/read`, { cookie: as.customer })).status, 200);
        assert.equal((await list(as.customer)).unread, mine.unread - 1);

        assert.equal((await call('POST', '/notifications/read-all', { cookie: as.customer })).status, 200);
        assert.equal((await call('GET', '/notifications/unread-count', { cookie: as.customer })).data.unread, 0);
        assert.equal((await call('GET', '/notifications')).status, 401);
    });

    test('notifications arrive live over the socket', async () => {
        const { io } = require('socket.io-client');
        const s = io(app.base, { transports: ['websocket'], extraHeaders: { cookie: as.artist }, reconnection: false, forceNew: true });
        await new Promise((resolve) => s.on('connect', resolve));
        const received = new Promise((resolve) => s.on('notification', resolve));
        await call('POST', `/commissions/chat/${f.commissions.paid}/messages`, { cookie: as.customer, json: { type: 'text', content: 'live?' } });
        const n = await Promise.race([received, new Promise((_, rej) => setTimeout(() => rej(new Error('no live notification')), 3000))]);
        s.close();
        assert.equal(n.type, 'message');
        assert.equal(n.body, 'live?');
    });
});
