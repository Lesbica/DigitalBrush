// Sign in with Google (the token endpoint is replaced by a test double in helpers.js).
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, google, startApp, stopApp, client, createFixtures, cleanupFixtures, sessionIdFromSetCookie } = require('./helpers');

let app, call, f;

before(async () => {
    app = await startApp();
    call = client(app.api);
    f = await createFixtures();
});

after(async () => {
    await cleanupFixtures(f);
    await stopApp(app);
});

const cookieOf = (r) => r.headers.get('set-cookie').split(';')[0];

const claimsFor = (email, sub, extra = {}) => ({
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 600,
    sub,
    email,
    email_verified: true,
    name: `${f.tag} Google`,
    ...extra,
});

// Starts the flow, lets "Google" answer with `claims`, returns the callback response
async function signIn(claims, { next, lang, tamperState = false } = {}) {
    const start = await call('GET', `/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`, { lang });
    assert.equal(start.status, 302);
    const target = new URL(start.headers.get('location'));
    assert.equal(target.origin + target.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(target.searchParams.get('redirect_uri'), 'https://api.test/api/auth/google/callback');
    assert.equal(target.searchParams.get('scope'), 'openid email profile');
    const cookie = cookieOf(start);
    f.sessionIds.push(sessionIdFromSetCookie(start.headers.get('set-cookie')));

    const code = `code-${Math.random().toString(36).slice(2)}`;
    google.codes[code] = claims;
    const state = tamperState ? 'forged-state-value-000000000000000' : target.searchParams.get('state');
    const cb = await call('GET', `/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`, { cookie });
    if (cb.headers.get('set-cookie')) f.sessionIds.push(sessionIdFromSetCookie(cb.headers.get('set-cookie')));
    return { cb, cookie: cb.headers.get('set-cookie') ? cookieOf(cb) : cookie };
}

describe('sign in with Google', () => {
    test('the login form learns that Google is available', async () => {
        assert.deepEqual((await call('GET', '/auth/providers')).data, { google: true });
    });

    test('a new Google user gets a confirmed customer account and is logged in', async () => {
        const email = `${f.tag}-new-google@example.test`;
        const { cb, cookie } = await signIn(claimsFor(email, `${f.tag}-sub-new`), { next: '/checkout', lang: 'uk' });
        assert.equal(cb.headers.get('location'), 'http://app.test/checkout');
        assert.equal(google.lastTokenRequest.client_secret, 'test-google-secret');
        assert.equal(google.lastTokenRequest.grant_type, 'authorization_code');

        const me = await call('GET', '/auth/check-session', { cookie });
        assert.equal(me.data.loggedIn, true);
        assert.equal(me.data.user.email, email);
        assert.equal(me.data.user.role, 'customer');
        assert.equal(me.data.user.emailVerified, true);
        assert.equal(me.data.user.language, 'uk');
    });

    test('an existing account with the same email is linked, not duplicated', async () => {
        const { cb, cookie } = await signIn(claimsFor(f.artist.email, `${f.tag}-sub-artist`));
        assert.equal(cb.headers.get('location'), 'http://app.test/profile');
        const me = await call('GET', '/auth/check-session', { cookie });
        assert.equal(me.data.user.id, f.artist.id);
        const [[row]] = await db.query('SELECT Google_ID FROM creators WHERE Creator_ID = ?', [f.artist.id]);
        assert.equal(row.Google_ID, `${f.tag}-sub-artist`);
        // next time the Google id alone is enough, even if the Google email changed
        const again = await signIn(claimsFor(`${f.tag}-renamed@example.test`, `${f.tag}-sub-artist`));
        assert.equal((await call('GET', '/auth/check-session', { cookie: again.cookie })).data.user.id, f.artist.id);
    });

    test('a forged state, an unconfirmed email or a token for another app is refused', async () => {
        const email = `${f.tag}-refused@example.test`;
        const cases = [
            [claimsFor(email, `${f.tag}-sub-x`), { tamperState: true }],
            [claimsFor(email, `${f.tag}-sub-x`, { email_verified: false }), {}],
            [claimsFor(email, `${f.tag}-sub-x`, { aud: 'someone-else' }), {}],
            [claimsFor(email, `${f.tag}-sub-x`, { exp: Math.floor(Date.now() / 1000) - 10 }), {}],
        ];
        for (const [claims, opts] of cases) {
            const { cb, cookie } = await signIn(claims, opts);
            assert.equal(cb.headers.get('location'), 'http://app.test/profile?authError=google');
            assert.equal((await call('GET', '/auth/check-session', { cookie })).data.loggedIn, false);
        }
        const [[n]] = await db.query('SELECT COUNT(*) AS n FROM creators WHERE Email = ?', [email]);
        assert.equal(n.n, 0);
    });

    test('a return path to another site is ignored', async () => {
        const { cb } = await signIn(claimsFor(f.customer.email, `${f.tag}-sub-customer`), { next: '//evil.example/x' });
        assert.equal(cb.headers.get('location'), 'http://app.test/profile');
    });

    test('without keys Google sign-in is off', async () => {
        const saved = process.env.GOOGLE_CLIENT_SECRET;
        delete process.env.GOOGLE_CLIENT_SECRET;
        try {
            assert.deepEqual((await call('GET', '/auth/providers')).data, { google: false });
            assert.equal((await call('GET', '/auth/google')).status, 404);
        } finally {
            process.env.GOOGLE_CLIENT_SECRET = saved;
        }
    });
});
