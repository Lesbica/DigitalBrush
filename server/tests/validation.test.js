// Phase 1 regressions: input validation, uploads, image storage, search.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, PNG, startApp, stopApp, client, formWith, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');

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

describe('registration and login', () => {
    test('rejects invalid email and short password', async () => {
        assert.equal((await call('POST', '/auth/register', { json: { username: 'x', email: 'nope', password: 'secret12' } })).status, 400);
        assert.equal((await call('POST', '/auth/register', { json: { username: 'x', email: `${f.tag}-new@example.test`, password: '123' } })).status, 400);
    });
    test('registers once; same email in another case → 409', async () => {
        const email = `${f.tag}-new@example.test`;
        f.extraEmails.push(email);
        assert.equal((await call('POST', '/auth/register', { json: { username: 'new', email, password: 'secret12' } })).status, 201);
        assert.equal((await call('POST', '/auth/register', { json: { username: 'new', email: email.toUpperCase(), password: 'secret12' } })).status, 409);
    });
    test('wrong password and unknown email give the same message', async () => {
        const a = await call('POST', '/auth/login', { json: { email: f.customer.email, password: 'wrong-pass' } });
        const b = await call('POST', '/auth/login', { json: { email: `${f.tag}-nobody@example.test`, password: 'x' } });
        assert.equal(a.status, 401);
        assert.equal(a.data.message, 'Invalid email or password');
        assert.equal(b.data.message, a.data.message);
    });
    test('check-session returns the profile with avatar and socials', async () => {
        const r = await call('GET', '/auth/check-session', { cookie: as.customer });
        assert.equal(r.data.loggedIn, true);
        assert.ok(r.data.user.profileImage);
        assert.ok('instagram' in r.data.user);
    });
});

describe('painting uploads', () => {
    const upload = (fields, files) => call('POST', '/paintings/upload', { cookie: as.artist, form: formWith(fields, files) });

    test('rejects files that are not images', async () => {
        assert.equal((await upload({ title: 'x', price: 10 }, [['images', Buffer.from('not an image'), 'x.png', 'image/png']])).status, 415);
        assert.equal((await upload({ title: 'x', price: 10 }, [['images', PNG, 'x.pdf', 'application/pdf']])).status, 415);
    });
    test('rejects files over 10 MB', async () => {
        const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 + 10)]);
        assert.equal((await upload({ title: 'x', price: 10 }, [['images', big, 'big.png', 'image/png']])).status, 413);
    });
    test('rejects negative price and missing title', async () => {
        assert.equal((await upload({ title: 'x', price: -5 }, [['images', PNG, 'a.png', 'image/png']])).status, 400);
        assert.equal((await upload({ price: 5 }, [['images', PNG, 'a.png', 'image/png']])).status, 400);
    });
    test('valid upload stores main + extra image; owner can delete it', async () => {
        const r = await upload({ title: `${f.tag} upload`, price: '12.5', width: 100, height: 50 },
            [['images', PNG, 'a.png', 'image/png'], ['images', PNG, 'b.png', 'image/png']]);
        assert.equal(r.status, 201, JSON.stringify(r.data));
        const [[p]] = await db.query('SELECT Price, Batch_ID FROM paintings WHERE Painting_ID = ?', [r.data.paintingID]);
        assert.equal(Number(p.Price), 12.5);
        const [[n]] = await db.query('SELECT COUNT(*) AS n FROM painting_images WHERE Batch_ID = ?', [p.Batch_ID]);
        assert.equal(n.n, 1);

        assert.equal((await call('DELETE', `/paintings/delete/${r.data.paintingID}`, { cookie: as.artist })).status, 200);
        const [[left]] = await db.query(
            'SELECT (SELECT COUNT(*) FROM paintings WHERE Painting_ID = ?) AS p, (SELECT COUNT(*) FROM painting_images WHERE Batch_ID = ?) AS i',
            [r.data.paintingID, p.Batch_ID]);
        assert.deepEqual({ ...left }, { p: 0, i: 0 });
    });
    test('a purchased painting cannot be deleted', async () => {
        assert.equal((await call('DELETE', `/paintings/delete/${f.paintings.sold}`, { cookie: as.artist })).status, 409);
        const [[n]] = await db.query('SELECT COUNT(*) AS n FROM paintings WHERE Painting_ID = ?', [f.paintings.sold]);
        assert.equal(n.n, 1);
    });
});

describe('commissions', () => {
    test('anonymous cannot create', async () => {
        const r = await call('POST', '/commissions/create', { form: formWith({ title: 't', description: 'd' }, [['referenceImage', PNG, 'r.png', 'image/png']]) });
        assert.equal(r.status, 401);
    });
    test('new commission image is stored as binary', async () => {
        const r = await call('POST', '/commissions/create', {
            cookie: as.customer,
            form: formWith({ title: `${f.tag} new`, description: 'desc', price: 99 }, [['referenceImage', PNG, 'r.png', 'image/png']]),
        });
        assert.equal(r.status, 201, JSON.stringify(r.data));
        const [[c]] = await db.query('SELECT HEX(LEFT(ReferenceImage, 4)) AS h, status FROM commissions WHERE Commission_ID = ?', [r.data.commissionId]);
        assert.equal(c.h, '89504E47');
        assert.equal(c.status, 'Open');
    });
    test('direct commission to an unknown artist → 404', async () => {
        const r = await call('POST', '/commissions/create', { cookie: as.customer, form: formWith({ title: 't', description: 'd', creatorId: 999999999 }) });
        assert.equal(r.status, 404);
    });
    test('binary and legacy data-URI images are both served via image URLs', async () => {
        const r = await call('GET', '/commissions/public');
        for (const id of [f.commissions.openPublic, f.commissions.legacy]) {
            const c = r.data.commissions.find((x) => x.id === id);
            assert.ok(c.imageUrl.startsWith(`https://api.test/api/images/commission/${id}/ref`), `commission ${id}`);
            const img = await call('GET', c.imageUrl.replace('https://api.test/api', ''));
            assert.equal(img.status, 200, `image of commission ${id}`);
            assert.equal(img.headers.get('content-type'), 'image/webp');
        }
        const d = await call('GET', `/commissions/${f.commissions.inProgress}`, { cookie: as.customer });
        assert.equal(d.data.commission.images.length, 2);
    });
    test('/my never sends raw BLOBs', async () => {
        const r = await call('GET', '/commissions/my', { cookie: as.customer });
        const paid = r.data.commissions.find((c) => c.Commission_ID === f.commissions.paid);
        assert.ok(!('ResultImage' in paid) && !('Image2' in paid));
        assert.equal(paid.hasResult, true);
    });
    test('paid result downloads with its real type', async () => {
        const r = await call('GET', `/commissions/download/${f.commissions.paid}`, { cookie: as.customer });
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('content-type'), 'image/png');
        assert.equal(r.buf.subarray(0, 4).toString('hex'), '89504e47');
    });
    test('unpaid customer cannot download the result', async () => {
        assert.equal((await call('GET', `/commissions/download/${f.commissions.inProgress}`, { cookie: as.customer })).status, 402);
    });
    test('chat rejects empty text and fake images', async () => {
        const url = `/commissions/chat/${f.commissions.inProgress}/messages`;
        assert.equal((await call('POST', url, { cookie: as.customer, json: { type: 'text', content: '   ' } })).status, 400);
        const fake = 'data:image/png;base64,' + Buffer.from('not a picture').toString('base64');
        assert.equal((await call('POST', url, { cookie: as.customer, json: { type: 'image', content: fake } })).status, 415);
    });
});

describe('likes', () => {
    test('like toggles once per user and keeps the counter in sync', async () => {
        const url = `/paintings/${f.paintings.a}/like`;
        assert.equal((await call('POST', url)).status, 401);
        const on = await call('POST', url, { cookie: as.customer });
        assert.deepEqual({ liked: on.data.liked, likes: on.data.likes }, { liked: true, likes: 1 });
        const d = await call('GET', `/paintings/${f.paintings.a}`, { cookie: as.customer });
        assert.equal(d.data.painting.likedByCurrentUser, true);
        const off = await call('POST', url, { cookie: as.customer });
        assert.deepEqual({ liked: off.data.liked, likes: off.data.likes }, { liked: false, likes: 0 });
    });
});

describe('database constraints (migration 004)', () => {
    test('chat messages require an existing commission', async () => {
        await assert.rejects(
            db.query('INSERT INTO messages (senderId, receiverId, commissionId, type, content) VALUES (?, ?, ?, ?, ?)',
                [f.customer.id, f.artist.id, 999999999, 'text', 'x']),
            { code: 'ER_NO_REFERENCED_ROW_2' });
    });
    test('an artist with paintings cannot be deleted silently', async () => {
        await assert.rejects(db.query('DELETE FROM creators WHERE Creator_ID = ?', [f.artist.id]), { code: 'ER_ROW_IS_REFERENCED_2' });
    });
});

describe('search', () => {
    test('finds artists by style; no email in results', async () => {
        const r = await call('GET', `/search/creators?q=${f.tag}-style`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.data.creators.map((c) => c.name), [f.artist.name]);
        assert.ok(!('email' in r.data.creators[0]));
    });
    test('LIKE wildcards are matched literally', async () => {
        assert.equal((await call('GET', '/search/creators?q=%25')).data.count, 0);
    });
});
