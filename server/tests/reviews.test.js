// Phase 5: reviews, ratings, artist availability and artist filters.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, startApp, stopApp, client, formWith, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');

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

describe('reviews', () => {
    test('validation and permissions', async () => {
        const post = (cookie, body) => call('POST', '/reviews', { cookie, json: body });
        assert.equal((await post(undefined, { commissionId: f.commissions.paid, rating: 5 })).status, 401);
        assert.equal((await post(as.customer, { commissionId: f.commissions.paid, rating: 6 })).status, 400);
        assert.equal((await post(as.customer, { commissionId: f.commissions.paid, rating: 4.5 })).status, 400);
        assert.equal((await post(as.outsider, { commissionId: f.commissions.paid, rating: 5 })).status, 403);
        assert.equal((await post(as.artist, { commissionId: f.commissions.paid, rating: 5 })).status, 403);
        assert.equal((await post(as.customer, { commissionId: f.commissions.inProgress, rating: 5 })).status, 409);
    });

    test('customer reviews a completed commission once', async () => {
        const before = await call('GET', `/commissions/${f.commissions.paid}`, { cookie: as.customer });
        assert.equal(before.data.commission.canReview, true);
        assert.equal(before.data.commission.review, null);

        const r = await call('POST', '/reviews', { cookie: as.customer, json: { commissionId: f.commissions.paid, rating: 4, text: '  Great work  ' } });
        assert.equal(r.status, 201);
        assert.equal((await call('POST', '/reviews', { cookie: as.customer, json: { commissionId: f.commissions.paid, rating: 5 } })).status, 409);

        const after = await call('GET', `/commissions/${f.commissions.paid}`, { cookie: as.customer });
        assert.equal(after.data.commission.canReview, false);
        assert.equal(after.data.commission.review.rating, 4);
        assert.equal(after.data.commission.review.text, 'Great work');
    });

    test('artist page shows the rating and the reviews list', async () => {
        const list = await call('GET', `/reviews/artist/${f.artist.id}`);
        assert.deepEqual(list.data.summary, { average: 4, count: 1 });
        assert.equal(list.data.reviews[0].customer.name, f.customer.name);
        assert.match(list.data.reviews[0].customer.avatar, /\/images\/avatar\//);

        const artist = await call('GET', `/artists/artist/${f.artist.id}`);
        assert.equal(artist.data.ratingAvg, 4);
        assert.equal(artist.data.ratingCount, 1);
        assert.equal(artist.data.availability, 'open');
    });
});

describe('availability and artist filters', () => {
    test('artist sets availability in profile settings', async () => {
        const bad = await call('POST', '/profile/update-profile', { cookie: as.artist, form: formWith({ availability: 'sleeping' }) });
        assert.equal(bad.status, 400);
        const ok = await call('POST', '/profile/update-profile', { cookie: as.artist, form: formWith({ availability: 'busy' }) });
        assert.equal(ok.status, 200, JSON.stringify(ok.data));
        assert.equal(ok.data.user.availability, 'busy');
        const [[row]] = await db.query('SELECT Availability FROM creators WHERE Creator_ID = ?', [f.artist.id]);
        assert.equal(row.Availability, 'busy');
    });

    test('getartists filters by rating, availability, price and name', async () => {
        const ids = async (qs) => (await call('GET', `/artists/getartists?q=${f.tag}&${qs}`)).data.map((a) => a.Creator_ID);
        assert.deepEqual(await ids('minRating=4'), [f.artist.id]);
        assert.deepEqual(await ids('minRating=4.5'), []);
        assert.deepEqual(await ids('availability=busy'), [f.artist.id]);
        assert.deepEqual(await ids('availability=open'), [f.customer.id, f.outsider.id]);
        assert.deepEqual(await ids('maxPrice=79'), [f.customer.id]); // customer's own painting costs 50
        assert.deepEqual(await ids('maxPrice=100'), [f.customer.id, f.artist.id]);
        const sorted = await ids('sort=rating');
        assert.equal(sorted[0], f.artist.id);
    });
});
