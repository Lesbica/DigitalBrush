// Phase 4: security headers, rate limits, request body limits.
// Separate file (= separate process), so exhausting the login limit does not affect other suites.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, client, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');

let app, call, f, as;

before(async () => {
    app = await startApp();
    call = client(app.api);
    f = await createFixtures();
    as = { customer: await sessionFor(f, f.customer) };
});

after(async () => {
    await cleanupFixtures(f);
    await stopApp(app);
});

describe('security headers', () => {
    test('helmet headers are set; images may be loaded by the same site', async () => {
        const r = await call('GET', '/paintings');
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.ok(r.headers.get('strict-transport-security'));
        assert.equal(r.headers.get('x-powered-by'), null);
        const img = await call('GET', `/images/painting/${f.paintings.a}`);
        assert.equal(img.headers.get('cross-origin-resource-policy'), 'same-site');
    });
});

describe('body size limits', () => {
    test('regular JSON endpoints reject bodies over 1 MB', async () => {
        const r = await call('POST', '/auth/login', { json: { email: 'x@example.test', password: 'x'.repeat(1.2 * 1024 * 1024) } });
        assert.equal(r.status, 413);
    });
    test('malformed JSON is a 400, not a 500', async () => {
        const r = await call('POST', '/auth/check-email', { raw: '{"email": ', contentType: 'application/json' });
        assert.equal(r.status, 400);
    });
    test('chat still accepts large image payloads (up to the 10 MB image check)', async () => {
        const big = 'data:image/png;base64,' + Buffer.alloc(3 * 1024 * 1024).toString('base64');
        const r = await call('POST', `/commissions/chat/${f.commissions.inProgress}/messages`, {
            cookie: as.customer, json: { type: 'image', content: big },
        });
        // not 413 from the parser: the payload reaches the route, which rejects it as "not an image"
        assert.equal(r.status, 415);
    });
});

describe('rate limits', () => {
    test('login is limited to 20 attempts per 15 minutes per IP', async () => {
        const statuses = [];
        for (let i = 0; i < 22; i += 1) {
            statuses.push((await call('POST', '/auth/login', { json: { email: f.customer.email, password: 'wrong' } })).status);
        }
        // other tests in this file also call /auth/login, so the limit may be reached a bit earlier
        const firstBlocked = statuses.indexOf(429);
        assert.ok(firstBlocked >= 15 && firstBlocked <= 20, `first 429 at attempt ${firstBlocked + 1}`);
        assert.deepEqual([...new Set(statuses.slice(0, firstBlocked))], [401]);
        assert.ok(statuses.slice(firstBlocked).every((s) => s === 429));
    });
});
