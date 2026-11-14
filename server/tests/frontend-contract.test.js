// Contract between the API and the redesigned frontend: every field the pages read
// (home, shop, artwork dialog, artists, artist profile, commission board, profile, checkout)
// is present, images are URLs, private user data is never exposed, and likes / purchases work.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, startApp, stopApp, client, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');

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

const IMAGE_URL = /\/images\/painting\/\d+/;
const PRIVATE_KEYS = ['Password', 'password', 'Email', 'email', 'Birthday', 'birthday', 'Image'];
const assertNoPrivateData = (obj, where) => {
    for (const key of PRIVATE_KEYS) assert.equal(key in obj, false, `${where} must not expose ${key}`);
};

describe('shop and home: GET /paintings', () => {
    test('cards carry every field the art card and the home page read', async () => {
        const r = await call('GET', `/paintings?q=${f.tag}&page=1&limit=10`);
        assert.equal(r.status, 200);
        assert.equal(r.data.success, true);
        for (const key of ['paintings', 'total', 'page', 'limit', 'totalPages']) assert.ok(key in r.data, key);
        assert.equal(r.data.total, 5);

        const card = r.data.paintings.find((p) => p.id === f.paintings.a);
        assert.ok(card, 'fixture painting is listed');
        for (const key of ['id', 'title', 'author_name', 'Creator_ID', 'price', 'likes', 'category', 'style', 'description', 'image']) {
            assert.ok(key in card, `card has ${key}`);
        }
        assert.equal(card.title, `${f.tag} A`);
        assert.equal(card.author_name, f.artist.name);
        assert.equal(card.Creator_ID, f.artist.id);
        assert.equal(Number(card.price), 123);
        assert.match(card.image, IMAGE_URL);
        assertNoPrivateData(card, 'painting card');
    });

    test('pagination is capped and pages do not overlap', async () => {
        const page1 = await call('GET', `/paintings?q=${f.tag}&page=1&limit=2`);
        const page2 = await call('GET', `/paintings?q=${f.tag}&page=2&limit=2`);
        assert.equal(page1.data.paintings.length, 2);
        assert.equal(page1.data.totalPages, 3);
        const ids1 = page1.data.paintings.map((p) => p.id);
        assert.equal(page2.data.paintings.some((p) => ids1.includes(p.id)), false);

        const big = await call('GET', '/paintings?page=1&limit=5000');
        assert.equal(big.data.limit, 100);
    });

    test('search, price filter and sorting used by the shop', async () => {
        const none = await call('GET', `/paintings?q=${f.tag}-nothing-matches`);
        assert.equal(none.data.total, 0);
        assert.deepEqual(none.data.paintings, []);

        const cheap = await call('GET', `/paintings?q=${f.tag}&maxPrice=60`);
        assert.deepEqual(cheap.data.paintings.map((p) => p.id), [f.paintings.customerOwn]);

        const asc = await call('GET', `/paintings?q=${f.tag}&sort=price_asc`);
        const prices = asc.data.paintings.map((p) => Number(p.price));
        assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

        // wildcard characters are searched literally
        const pct = await call('GET', '/paintings?q=%25');
        assert.equal(pct.status, 200);
    });

    test('painting image is served as a picture, not JSON', async () => {
        const list = await call('GET', `/paintings?q=${f.tag}&page=1&limit=1`);
        const url = list.data.paintings[0].image.replace(/^.*\/api/, '');
        const img = await call('GET', url);
        assert.equal(img.status, 200);
        assert.match(img.headers.get('content-type'), /^image\//);
    });
});

describe('artwork dialog: GET /paintings/:id', () => {
    test('detail has the fields the dialog shows', async () => {
        const r = await call('GET', `/paintings/${f.paintings.a}`);
        assert.equal(r.status, 200);
        const p = r.data.painting;
        for (const key of ['id', 'title', 'description', 'author_name', 'author_avatar', 'artistId', 'price',
            'style', 'likes', 'likedByCurrentUser', 'category', 'format', 'size', 'mainImage', 'gallery']) {
            assert.ok(key in p, `detail has ${key}`);
        }
        assert.equal(p.artistId, f.artist.id);
        assert.match(p.mainImage, IMAGE_URL);
        assert.ok(Array.isArray(p.gallery));
        assert.equal(p.likedByCurrentUser, false);
    });

    test('bad and unknown ids', async () => {
        assert.equal((await call('GET', '/paintings/abc')).status, 400);
        assert.equal((await call('GET', '/paintings/0')).status, 400);
        assert.equal((await call('GET', '/paintings/999999999')).status, 404);
    });
});

describe('likes: POST /paintings/:id/like', () => {
    test('needs a signed-in user', async () => {
        assert.equal((await call('POST', `/paintings/${f.paintings.b}/like`)).status, 401);
    });

    test('toggles per user and keeps the counter in step', async () => {
        const like = await call('POST', `/paintings/${f.paintings.b}/like`, { cookie: as.customer });
        assert.equal(like.status, 200);
        assert.deepEqual({ liked: like.data.liked, likes: like.data.likes }, { liked: true, likes: 1 });

        const second = await call('POST', `/paintings/${f.paintings.b}/like`, { cookie: as.outsider });
        assert.equal(second.data.likes, 2);

        const detail = await call('GET', `/paintings/${f.paintings.b}`, { cookie: as.customer });
        assert.equal(detail.data.painting.likedByCurrentUser, true);
        assert.equal(detail.data.painting.likes, 2);

        const unlike = await call('POST', `/paintings/${f.paintings.b}/like`, { cookie: as.customer });
        assert.deepEqual({ liked: unlike.data.liked, likes: unlike.data.likes }, { liked: false, likes: 1 });

        const list = await call('GET', `/paintings?q=${f.tag}`);
        assert.equal(list.data.paintings.find((p) => p.id === f.paintings.b).likes, 1);
    });

    test('unknown painting', async () => {
        assert.equal((await call('POST', '/paintings/999999999/like', { cookie: as.customer })).status, 404);
    });
});

describe('artists page and artist profile', () => {
    test('GET /artists/getartists returns what the artists rows read', async () => {
        const r = await call('GET', `/artists/getartists?q=${f.tag}`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.data.map((a) => a.Creator_ID), [f.artist.id]); // customers are not artists
        const a = r.data[0];
        for (const key of ['id', 'name', 'avatar', 'paintings', 'stylesArray', 'likesCount', 'availability', 'ratingAvg', 'ratingCount']) {
            assert.ok(key in a, `artist has ${key}`);
        }
        assert.match(a.avatar, /\/images\/avatar\//);
        assert.equal(a.paintings.length, 4);
        assert.match(a.paintings[0].image_url, IMAGE_URL);
        assertNoPrivateData(a, 'artist');
        for (const p of a.paintings) assert.equal('Image' in p, false, 'no BLOB in artist paintings');
    });

    test('GET /artists/artist/:id feeds the profile page', async () => {
        const r = await call('GET', `/artists/artist/${f.artist.id}`);
        assert.equal(r.status, 200);
        assert.equal(r.data.name, f.artist.name);
        assert.ok(r.data.stylesArray.includes('Retro'));
        assert.ok(Array.isArray(r.data.languagesArray));
        assertNoPrivateData(r.data, 'artist profile');
    });
});

describe('commission board: GET /commissions/public', () => {
    test('only open public requests, with the card fields', async () => {
        const r = await call('GET', `/commissions/public?q=${encodeURIComponent(f.tag)}&page=1&limit=50`);
        assert.equal(r.status, 200);
        const ids = r.data.commissions.map((c) => c.Commission_ID);
        assert.ok(ids.includes(f.commissions.openPublic));
        assert.equal(ids.includes(f.commissions.inProgress), false);
        assert.equal(ids.includes(f.commissions.directOpen), false);
        assert.equal(ids.includes(f.commissions.paid), false);

        const card = r.data.commissions.find((c) => c.Commission_ID === f.commissions.openPublic);
        for (const key of ['Commission_ID', 'Title', 'Description', 'Price', 'imageUrl']) assert.ok(key in card, key);
        assert.equal(Number(card.Price), 200);
        assert.match(card.imageUrl, /\/images\/commission\//);
        assert.equal('ReferenceImage' in card, false);
    });
});

describe('session and profile pages', () => {
    test('check-session tells guests and users apart, with the role for the "+" menu', async () => {
        const guest = await call('GET', '/auth/check-session');
        assert.deepEqual(guest.data, { loggedIn: false });

        const artist = await call('GET', '/auth/check-session', { cookie: as.artist });
        assert.equal(artist.data.loggedIn, true);
        assert.equal(artist.data.user.role, 'artist');
        assert.equal('password' in artist.data.user || 'Password' in artist.data.user, false);

        const customer = await call('GET', '/auth/check-session', { cookie: as.customer });
        assert.equal(customer.data.user.role, 'customer');
    });

    test('my images: only my own paintings', async () => {
        assert.equal((await call('GET', '/profile/getuserpaintings')).status, 401);
        const r = await call('GET', '/profile/getuserpaintings', { cookie: as.artist });
        assert.equal(r.status, 200);
        const ids = r.data.paintings.map((p) => p.id).sort();
        assert.deepEqual(ids, [f.paintings.a, f.paintings.b, f.paintings.c, f.paintings.sold].sort());
        assert.match(r.data.paintings[0].image_url, IMAGE_URL);
    });

    test('bought paintings, ownership check and download', async () => {
        const bought = await call('GET', '/profile/getboughtpaintings', { cookie: as.customer });
        assert.deepEqual(bought.data.paintings.map((p) => p.id), [f.paintings.sold]);
        assert.equal(bought.data.paintings[0].artistId, f.artist.id);

        const owned = await call('GET', `/profile/check-ownership/${f.paintings.sold}`, { cookie: as.customer });
        assert.equal(owned.data.owned, true);
        const notOwned = await call('GET', `/profile/check-ownership/${f.paintings.a}`, { cookie: as.customer });
        assert.equal(notOwned.data.owned, false);

        const download = await call('GET', `/profile/download/${f.paintings.sold}`, { cookie: as.customer });
        assert.equal(download.status, 200);
        assert.ok(download.buf.length > 0);
        const denied = await call('GET', `/profile/download/${f.paintings.sold}`, { cookie: as.outsider });
        assert.equal(denied.status, 403);
        assert.equal((await call('GET', `/profile/download/${f.paintings.sold}`)).status, 401);
    });

    test('a sold painting cannot be deleted by its artist', async () => {
        const r = await call('DELETE', `/paintings/delete/${f.paintings.sold}`, { cookie: as.artist });
        assert.equal(r.status, 409);
        const [[row]] = await db.query('SELECT COUNT(*) AS n FROM paintings WHERE Painting_ID = ?', [f.paintings.sold]);
        assert.equal(row.n, 1);
    });
});
