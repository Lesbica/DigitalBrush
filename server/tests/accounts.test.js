// Phase 5: accounts — email confirmation, password reset, roles.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, PNG, startApp, stopApp, client, formWith, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');
const { sent } = require('../utils/mailer');

let app, call, f, as;

before(async () => {
    app = await startApp();
    call = client(app.api);
    f = await createFixtures();
    as = { customer: await sessionFor(f, f.customer), artist: await sessionFor(f, f.artist) };
});

after(async () => {
    await cleanupFixtures(f);
    await stopApp(app);
});

// Token from the last email sent to this address
function tokenFrom(email, kind) {
    const mail = [...sent].reverse().find((m) => m.to === email && m.text.includes(`/${kind}?token=`));
    assert.ok(mail, `no ${kind} email for ${email}`);
    return /token=([0-9a-f]{64})/.exec(mail.text)[1];
}
const login = (email, password) => call('POST', '/auth/login', { json: { email, password } });

describe('email confirmation', () => {
    const email = () => `${f.tag}-reg@example.test`;

    test('registration sends a confirmation link and blocks login until confirmed', async () => {
        f.extraEmails.push(email());
        const r = await call('POST', '/auth/register', { json: { username: 'reg', email: email(), password: 'secret12', role: 'artist' } });
        assert.equal(r.status, 201);
        assert.equal(r.data.verificationRequired, true);

        const blocked = await login(email(), 'secret12');
        assert.equal(blocked.status, 403);
        assert.equal(blocked.data.code, 'EMAIL_NOT_VERIFIED');
        // wrong password still says nothing about verification
        assert.equal((await login(email(), 'wrong-pass')).status, 401);
    });

    test('invalid tokens are rejected; the link works once', async () => {
        assert.equal((await call('POST', '/auth/verify-email', { json: { token: 'abc' } })).status, 400);
        assert.equal((await call('POST', '/auth/verify-email', { json: { token: 'f'.repeat(64) } })).status, 400);

        // resend replaces the first link
        const first = tokenFrom(email(), 'verify-email');
        assert.equal((await call('POST', '/auth/resend-verification', { json: { email: email() } })).status, 200);
        const second = tokenFrom(email(), 'verify-email');
        assert.notEqual(first, second);
        assert.equal((await call('POST', '/auth/verify-email', { json: { token: first } })).status, 400);

        assert.equal((await call('POST', '/auth/verify-email', { json: { token: second } })).status, 200);
        assert.equal((await call('POST', '/auth/verify-email', { json: { token: second } })).status, 400);

        const ok = await login(email(), 'secret12');
        assert.equal(ok.status, 200);
        assert.equal(ok.data.user.role, 'artist');
        assert.equal(ok.data.user.emailVerified, true);
    });

    test('resend for unknown emails answers the same way', async () => {
        const r = await call('POST', '/auth/resend-verification', { json: { email: `${f.tag}-nobody@example.test` } });
        assert.equal(r.status, 200);
    });

    test('the role must be artist or customer', async () => {
        const r = await call('POST', '/auth/register', { json: { username: 'x', email: `${f.tag}-bad@example.test`, password: 'secret12', role: 'admin' } });
        assert.equal(r.status, 400);
    });
});

describe('password reset', () => {
    test('reset link changes the password once; unknown emails get the same answer', async () => {
        const unknown = await call('POST', '/auth/forgot-password', { json: { email: `${f.tag}-ghost@example.test` } });
        assert.equal(unknown.status, 200);

        const r = await call('POST', '/auth/forgot-password', { json: { email: f.outsider.email } });
        assert.equal(r.status, 200);
        assert.equal(r.data.message, unknown.data.message);
        const token = tokenFrom(f.outsider.email, 'reset-password');

        assert.equal((await call('POST', '/auth/reset-password', { json: { token, password: '123' } })).status, 400);
        assert.equal((await call('POST', '/auth/reset-password', { json: { token, password: 'brand-new-pass' } })).status, 200);
        assert.equal((await call('POST', '/auth/reset-password', { json: { token, password: 'another-pass' } })).status, 400);

        assert.equal((await login(f.outsider.email, 'brand-new-pass')).status, 200);
        assert.equal((await login(f.outsider.email, 'Test-pass-1')).status, 401);
    });

    test('expired reset links do not work', async () => {
        await call('POST', '/auth/forgot-password', { json: { email: f.customer.email } });
        const token = tokenFrom(f.customer.email, 'reset-password');
        await db.query("UPDATE user_tokens SET Expires_At = NOW() - INTERVAL 1 MINUTE WHERE User_ID = ? AND Purpose = 'reset_password'", [f.customer.id]);
        assert.equal((await call('POST', '/auth/reset-password', { json: { token, password: 'brand-new-pass' } })).status, 400);
    });
});

describe('roles', () => {
    test('customers cannot upload paintings or accept commissions', async () => {
        const up = await call('POST', '/paintings/upload', { cookie: as.customer, form: formWith({ title: 'x', price: 1 }, [['images', PNG, 'a.png', 'image/png']]) });
        assert.equal(up.status, 403);
        assert.equal(up.data.code, 'ARTIST_ONLY');
        assert.equal((await call('PATCH', `/commissions/${f.commissions.openPublic}/accept`, { cookie: as.customer })).status, 403);
    });

    test('direct commissions go only to artists who are not on vacation', async () => {
        const order = (creatorId) => call('POST', '/commissions/create', { cookie: as.artist, form: formWith({ title: 't', description: 'd', creatorId }) });
        assert.equal((await order(f.customer.id)).status, 400);
        await db.query("UPDATE creators SET Availability = 'vacation' WHERE Creator_ID = ?", [f.artist.id]);
        const vacation = await call('POST', '/commissions/create', { cookie: as.customer, form: formWith({ title: 't', description: 'd', creatorId: f.artist.id }) });
        assert.equal(vacation.status, 409);
        await db.query("UPDATE creators SET Availability = 'open' WHERE Creator_ID = ?", [f.artist.id]);
    });

    test('a customer can switch to artist in settings and then upload', async () => {
        const sw = await call('POST', '/profile/update-profile', { cookie: as.customer, form: formWith({ role: 'artist' }) });
        assert.equal(sw.status, 200);
        assert.equal(sw.data.user.role, 'artist');
        const up = await call('POST', '/paintings/upload', { cookie: as.customer, form: formWith({ title: `${f.tag} switched`, price: 1 }, [['images', PNG, 'a.png', 'image/png']]) });
        assert.equal(up.status, 201);
        assert.equal((await call('POST', '/profile/update-profile', { cookie: as.customer, form: formWith({ role: 'boss' }) })).status, 400);
    });

    test('changing the email requires confirming the new address', async () => {
        const newEmail = `${f.tag}-changed@example.test`;
        const r = await call('POST', '/profile/update-profile', { cookie: as.artist, form: formWith({ email: newEmail }) });
        assert.equal(r.status, 200);
        assert.equal(r.data.user.emailVerified, false);
        assert.ok(tokenFrom(newEmail, 'verify-email'));
        // keep the fixture cleanup (by tag) working: the address still starts with the tag
    });

    test('only artist accounts are listed on the artists page', async () => {
        const list = await call('GET', `/artists/getartists?q=${f.tag}`);
        assert.ok(list.data.every((a) => a.Creator_ID !== f.outsider.id));
    });
});
