// Phase 3: image URLs instead of base64, image endpoints (resize, cache, access), pagination.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { db, startApp, stopApp, client, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');

let app, call, f, as, bigPng;
const PUBLIC_BASE = 'https://api.test/api'; // API_URL set in helpers
const local = (url) => url.replace(PUBLIC_BASE, '');
const widthOf = async (buf) => (await sharp(buf).metadata()).width;

before(async () => {
    app = await startApp();
    call = client(app.api);
    f = await createFixtures();
    as = {
        customer: await sessionFor(f, f.customer),
        artist: await sessionFor(f, f.artist),
        outsider: await sessionFor(f, f.outsider),
    };
    bigPng = await sharp({ create: { width: 2000, height: 20, channels: 3, background: '#888888' } }).png().toBuffer();
    // an additional image for painting A and a big main image for painting B
    const [[a]] = await db.query('SELECT Batch_ID FROM paintings WHERE Painting_ID = ?', [f.paintings.a]);
    await db.query('INSERT INTO painting_images (Batch_ID, Image) VALUES (?, ?)', [a.Batch_ID, bigPng]);
    await db.query('UPDATE paintings SET Image = ? WHERE Painting_ID = ?', [bigPng, f.paintings.b]);
});

after(async () => {
    await cleanupFixtures(f);
    await stopApp(app);
});

describe('responses contain image URLs, not base64', () => {
    test('painting list', async () => {
        const r = await call('GET', '/paintings');
        assert.equal(r.status, 200);
        assert.ok(!r.buf.toString().includes('base64'), 'no base64 in the list');
        const a = r.data.paintings.find((p) => p.id === f.paintings.a);
        assert.equal(a.image, `${PUBLIC_BASE}/images/painting/${f.paintings.a}?w=600`);
    });
    test('painting details: main image, gallery and author avatar', async () => {
        const r = await call('GET', `/paintings/${f.paintings.a}`);
        assert.ok(!r.buf.toString().includes('base64'));
        assert.match(r.data.painting.mainImage, new RegExp(`/images/painting/${f.paintings.a}\\?w=1600$`));
        assert.equal(r.data.painting.gallery.length, 1);
        assert.match(r.data.painting.gallery[0], new RegExp(`/images/painting/${f.paintings.a}/extra/\\d+`));
        assert.match(r.data.painting.author_avatar, new RegExp(`/images/avatar/${f.artist.id}\\?w=200&v=`));
    });
    test('artists, profile, chat, commissions', async () => {
        const artists = await call('GET', '/artists/getartists');
        assert.ok(!artists.buf.toString().includes('base64'));
        const artist = artists.data.find((x) => x.Creator_ID === f.artist.id);
        assert.match(artist.avatar, /\/images\/avatar\//);
        assert.equal(artist.paintings.length, 4);
        assert.ok(artist.paintings.every((p) => p.image_url && !('Image' in p)));

        const me = await call('GET', '/auth/check-session', { cookie: as.customer });
        assert.match(me.data.user.profileImage, new RegExp(`/images/avatar/${f.customer.id}\\?w=200&v=default`));

        for (const url of ['/profile/getuserpaintings', '/commissions/my']) {
            const r = await call('GET', url, { cookie: as.artist });
            assert.equal(r.status, 200, url);
            assert.ok(!r.buf.toString().includes('base64'), url);
        }
    });
});

describe('image endpoints', () => {
    test('painting preview: WebP, resized, cacheable, 304 on matching ETag', async () => {
        const r = await call('GET', `/images/painting/${f.paintings.b}?w=600`);
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('content-type'), 'image/webp');
        assert.match(r.headers.get('cache-control'), /public/);
        assert.equal(await widthOf(r.buf), 600);
        const etag = r.headers.get('etag');
        const again = await realGet(`/images/painting/${f.paintings.b}?w=600`, { 'if-none-match': etag });
        assert.equal(again.status, 304);
    });
    test('public preview never exceeds 1600px, odd widths snap to allowed sizes', async () => {
        assert.equal(await widthOf((await call('GET', `/images/painting/${f.paintings.b}?w=5000`)).buf), 1600);
        assert.equal(await widthOf((await call('GET', `/images/painting/${f.paintings.b}?w=650`)).buf), 800);
    });
    test('extra image belongs to its painting only', async () => {
        const d = await call('GET', `/paintings/${f.paintings.a}`);
        const extraPath = local(d.data.painting.gallery[0]);
        assert.equal((await call('GET', extraPath)).status, 200);
        assert.equal((await call('GET', extraPath.replace(`/painting/${f.paintings.a}/`, `/painting/${f.paintings.b}/`))).status, 404);
    });
    test('default avatar is served for users without one', async () => {
        const r = await call('GET', `/images/avatar/${f.customer.id}`);
        assert.equal(r.status, 200);
        assert.ok(r.buf.length > 0);
    });
    test('commission images follow commission access rules', async () => {
        assert.equal((await call('GET', `/images/commission/${f.commissions.openPublic}/ref`)).status, 200);
        assert.equal((await call('GET', `/images/commission/${f.commissions.inProgress}/ref`)).status, 403);
        assert.equal((await call('GET', `/images/commission/${f.commissions.inProgress}/ref`, { cookie: as.customer })).status, 200);
        // result: unpaid customer no, artist yes, paid customer yes
        assert.equal((await call('GET', `/images/commission/${f.commissions.inProgress}/result`, { cookie: as.customer })).status, 403);
        assert.equal((await call('GET', `/images/commission/${f.commissions.inProgress}/result`, { cookie: as.artist })).status, 200);
        const paid = await call('GET', `/images/commission/${f.commissions.paid}/result`, { cookie: as.customer });
        assert.equal(paid.status, 200);
        assert.match(paid.headers.get('cache-control'), /private/);
        assert.equal((await call('GET', `/images/commission/${f.commissions.paid}/bogus`)).status, 400);
    });
    test('stage image: participants only, reduced copy for the unpaid customer', async () => {
        const sub = await call('POST', `/commissions/chat/${f.commissions.inProgress}/submit-stage`, {
            cookie: as.artist, json: { image: 'data:image/png;base64,' + bigPng.toString('base64') },
        });
        assert.equal(sub.status, 201, JSON.stringify(sub.data));
        const path = local(sub.data.message.image);
        assert.match(path, /^\/images\/message\/\d+/);
        assert.equal((await call('GET', path)).status, 401);
        assert.equal((await call('GET', path, { cookie: as.outsider })).status, 403);
        assert.equal(await widthOf((await call('GET', path, { cookie: as.customer })).buf), 800);
        assert.equal(await widthOf((await call('GET', path, { cookie: as.artist })).buf), 1600);
    });
});

describe('pagination and filters', () => {
    test('paintings: page/limit, total and filters', async () => {
        const r = await call('GET', `/paintings?creatorId=${f.artist.id}&page=1&limit=2&sort=price_asc`);
        assert.equal(r.data.total, 4);
        assert.equal(r.data.totalPages, 2);
        assert.equal(r.data.paintings.length, 2);
        assert.equal(Number(r.data.paintings[0].price), 80);
        const p2 = await call('GET', `/paintings?creatorId=${f.artist.id}&page=2&limit=2&sort=price_asc`);
        assert.equal(p2.data.paintings.length, 2);
        const q = await call('GET', `/paintings?q=${encodeURIComponent(`${f.tag} B`)}`);
        assert.deepEqual(q.data.paintings.map((p) => p.id), [f.paintings.b]);
    });
    test('limit is capped at 100', async () => {
        assert.equal((await call('GET', '/paintings?limit=10000')).data.limit, 100);
    });
    test('public commissions: totalPages for the frontend pager', async () => {
        const r = await call('GET', '/commissions/public?page=1&limit=1');
        assert.equal(r.data.commissions.length, 1);
        assert.ok(r.data.totalPages >= 2);
        const q = await call('GET', `/commissions/public?q=${encodeURIComponent(f.tag)}`);
        assert.ok(q.data.commissions.every((c) => c.Title.startsWith(f.tag)));
    });
    test('chat history pages backwards with before/hasMore', async () => {
        const url = `/commissions/chat/${f.commissions.inProgress}/messages`;
        await call('POST', url, { cookie: as.customer, json: { type: 'text', content: 'second' } });
        const last = await call('GET', `${url}?limit=1`, { cookie: as.customer });
        assert.equal(last.data.messages.length, 1);
        assert.equal(last.data.hasMore, true);
        const older = await call('GET', `${url}?limit=50&before=${last.data.messages[0].id}`, { cookie: as.customer });
        assert.ok(older.data.messages.every((m) => m.id < last.data.messages[0].id));
        assert.equal(older.data.messages[0].content, 'hello');
    });
});

// GET with custom headers (the shared client only sets cookies)
async function realGet(path, headers) {
    const { realFetch } = require('./helpers');
    return realFetch(app.api + path, { headers });
}
