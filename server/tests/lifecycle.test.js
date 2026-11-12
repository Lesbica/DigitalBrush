// Phase 5: commission lifecycle — stages, changes requested, decline, deadline, auto-approval.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, PNG, startApp, stopApp, client, formWith, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');
const { autoApproveTick } = require('../services/scheduler');

let app, call, f, as;
const STAGE_IMAGE = 'data:image/png;base64,' + PNG.toString('base64');

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

const statusOf = async (id) => (await db.query('SELECT status, Review_State FROM commissions WHERE Commission_ID = ?', [id]))[0][0];
const submit = (id, cookie = as.artist) =>
    call('POST', `/commissions/chat/${id}/submit-stage`, { cookie, json: { image: STAGE_IMAGE } });
const review = (id, decision, cookie = as.customer) =>
    call('POST', `/commissions/chat/${id}/review`, { cookie, json: { decision } });

describe('stages', () => {
    test('Sketch → Lineart → Color → Final → Completed, result saved at the end', async () => {
        const id = f.commissions.inProgress;
        await db.query('UPDATE commissions SET ResultImage = NULL WHERE Commission_ID = ?', [id]);
        const seen = [];
        for (const expected of ['Lineart', 'Color', 'Final', 'Completed']) {
            assert.equal((await submit(id)).status, 201);
            const d = await call('GET', `/commissions/${id}`, { cookie: as.customer });
            assert.equal(d.data.commission.reviewState, 'pending');
            assert.ok(d.data.commission.autoApproveAt);
            const r = await review(id, 'approve');
            assert.equal(r.status, 201, JSON.stringify(r.data));
            assert.equal(r.data.nextStatus, expected);
            seen.push((await statusOf(id)).status);
        }
        assert.deepEqual(seen, ['Lineart', 'Color', 'Final', 'Completed']);
        const [[c]] = await db.query('SELECT ResultImage IS NOT NULL AS hasResult, Review_State FROM commissions WHERE Commission_ID = ?', [id]);
        assert.equal(c.hasResult, 1);
        assert.equal(c.Review_State, 'none');
        assert.equal((await submit(id)).status, 409, 'no more stages after completion');
    });

    test('changes requested, then a new submission can be reviewed again', async () => {
        const [r] = await db.query(
            `INSERT INTO commissions (Title, Description, Price, Type, status, Customer_ID, Creator_ID)
             VALUES (?, 'x', 100, 'direct', 'Color', ?, ?)`, [`${f.tag} rev`, f.customer.id, f.artist.id]);
        const id = r.insertId;
        assert.equal((await review(id, 'approve')).status, 400, 'nothing submitted yet');
        await submit(id);
        assert.equal((await review(id, 'approve', as.artist)).status, 403, 'artist cannot review');
        assert.equal((await review(id, 'reject')).status, 201);
        assert.deepEqual({ ...(await statusOf(id)) }, { status: 'Color', Review_State: 'changes_requested' });
        assert.equal((await review(id, 'approve')).status, 400, 'the rejected stage cannot be approved later');
        await submit(id);
        assert.equal((await review(id, 'approve')).data.nextStatus, 'Final');
    });

    test('stages cannot be submitted before the commission is accepted', async () => {
        assert.equal((await submit(f.commissions.directOpen)).status, 409);
    });
});

describe('decline and cancel', () => {
    test('only the addressed artist declines an open direct commission', async () => {
        const url = `/commissions/${f.commissions.directOpen}/decline`;
        assert.equal((await call('PATCH', url, { cookie: as.outsider })).status, 403);
        assert.equal((await call('PATCH', url, { cookie: as.customer })).status, 403);
        const r = await call('PATCH', url, { cookie: as.artist });
        assert.equal(r.status, 200);
        assert.equal((await statusOf(f.commissions.directOpen)).status, 'Declined');
        assert.equal((await call('PATCH', url, { cookie: as.artist })).status, 409);
        assert.equal((await call('PATCH', `/commissions/${f.commissions.directOpen}/accept`, { cookie: as.artist })).status, 404);
        assert.equal((await call('PATCH', `/commissions/${f.commissions.directOpen}/status`, { cookie: as.customer, json: { status: 'Cancelled' } })).status, 409);
    });

    test('public commissions cannot be declined', async () => {
        assert.equal((await call('PATCH', `/commissions/${f.commissions.openPublic}/decline`, { cookie: as.customer })).status, 403);
    });
});

describe('deadline', () => {
    test('validated on creation and returned with the commission', async () => {
        const create = (deadline) => call('POST', '/commissions/create', {
            cookie: as.customer, form: formWith({ title: `${f.tag} dl`, description: 'd', deadline }),
        });
        assert.equal((await create('2001-01-01')).status, 400);
        assert.equal((await create('not-a-date')).status, 400);
        const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const ok = await create(future);
        assert.equal(ok.status, 201, JSON.stringify(ok.data));
        const d = await call('GET', `/commissions/${ok.data.commissionId}`, { cookie: as.customer });
        assert.equal(d.data.commission.deadline, future);
        assert.equal(d.data.commission.overdue, false);
    });
});

describe('auto-approval', () => {
    test('a stage not reviewed within AUTO_APPROVE_DAYS is approved automatically', async () => {
        const [r] = await db.query(
            `INSERT INTO commissions (Title, Description, Price, Type, status, Customer_ID, Creator_ID)
             VALUES (?, 'x', 100, 'direct', 'Sketch', ?, ?)`, [`${f.tag} auto`, f.customer.id, f.artist.id]);
        const id = r.insertId;
        await submit(id);

        // fresh submission: nothing happens
        await autoApproveTick();
        assert.equal((await statusOf(id)).status, 'Sketch');

        await db.query('UPDATE commissions SET Stage_Submitted_At = NOW() - INTERVAL 4 DAY WHERE Commission_ID = ?', [id]);
        const approved = await autoApproveTick();
        assert.ok(approved.some((a) => a.commissionId === id));
        assert.deepEqual({ ...(await statusOf(id)) }, { status: 'Lineart', Review_State: 'none' });
        const [[m]] = await db.query(`SELECT content FROM messages WHERE commissionId = ? AND type = 'stage-approve'`, [id]);
        assert.match(m.content, /:auto$/);
    });
});
