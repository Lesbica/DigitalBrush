// Server texts in Ukrainian and English: API messages, notifications, emails.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { db, PASSWORD, startApp, stopApp, client, createFixtures, sessionFor, cleanupFixtures } = require('./helpers');
const i18n = require('../i18n');
const { notify } = require('../services/notifications');
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

// Every human-readable `message:`/`error:` literal in the server code must have a Ukrainian translation
function serverMessages() {
    const root = path.join(__dirname, '..');
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'tests', 'migrations'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.js')) files.push(full);
        }
    };
    walk(root);
    const re = /\b(?:message|error)\s*:\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g;
    const found = new Map();
    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(re)) {
            const text = m[1] ?? m[2] ?? m[3];
            if (!text.includes(' ')) continue; // machine codes like not_found
            found.set(text.replace(/\$\{[^}]*\}/g, '{{}}'), path.relative(root, file));
        }
    }
    return found;
}

describe('catalogs', () => {
    test('every API message in the code has a Ukrainian translation', () => {
        const known = new Set(Object.keys(i18n.catalogs.uk.api).map((k) => k.replace(/\{\{\w+\}\}/g, '{{}}')));
        const missing = [...serverMessages()].filter(([text]) => !known.has(text)).map(([text, file]) => `${file}: ${text}`);
        assert.deepEqual(missing, []);
    });
    test('notification and email texts exist in both languages', () => {
        const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
        const { api, words, ...ukTexts } = i18n.catalogs.uk;
        assert.ok(api && words);
        assert.deepEqual(keys(ukTexts).sort(), keys(i18n.catalogs.en).sort());
    });
    test('Accept-Language picks the first supported language', () => {
        assert.equal(i18n.pickLanguage('uk-UA,uk;q=0.9,en;q=0.8'), 'uk');
        assert.equal(i18n.pickLanguage('de-DE,en;q=0.5,uk;q=0.4'), 'en');
        assert.equal(i18n.pickLanguage('de'), 'en');
        assert.equal(i18n.pickLanguage(undefined), 'en');
    });
});

describe('API answers in the language of the request', () => {
    test('messages are translated, machine codes are not', async () => {
        const wrong = { email: f.customer.email, password: 'wrong-password' };
        const uk = await call('POST', '/auth/login', { json: wrong, lang: 'uk' });
        assert.equal(uk.status, 401);
        assert.equal(uk.data.message, 'Неправильний email або пароль');
        assert.equal(uk.headers.get('content-language'), 'uk');
        const en = await call('POST', '/auth/login', { json: wrong, lang: 'en' });
        assert.equal(en.data.message, 'Invalid email or password');

        const code = await call('GET', '/payments/orders/junk', { cookie: as.customer, lang: 'uk' });
        assert.equal(code.data.error, 'not_found');
    });
    test('messages with values are translated too', async () => {
        const r = await call('POST', '/auth/register', { json: { username: `${f.tag}-short`, email: `${f.tag}-short@example.test`, password: '1' }, lang: 'uk' });
        assert.equal(r.status, 400);
        assert.match(r.data.message, /^Пароль має містити від \d+ до 72 символів$/);
    });
});

describe('user language', () => {
    test('login stores the language of the page; the profile returns it', async () => {
        const r = await call('POST', '/auth/login', { json: { email: f.outsider.email, password: PASSWORD }, lang: 'uk' });
        assert.equal(r.status, 200);
        assert.equal(r.data.user.language, 'uk');
        const [[row]] = await db.query('SELECT Language FROM creators WHERE Creator_ID = ?', [f.outsider.id]);
        assert.equal(row.Language, 'uk');
        f.sessionIds.push(decodeURIComponent(r.headers.get('set-cookie').split(';')[0].split('=')[1]).slice(2).split('.')[0]);
    });
    test('PUT /profile/language changes it; only uk and en', async () => {
        assert.equal((await call('PUT', '/profile/language', { cookie: as.customer, json: { language: 'en' } })).status, 200);
        const [[row]] = await db.query('SELECT Language FROM creators WHERE Creator_ID = ?', [f.customer.id]);
        assert.equal(row.Language, 'en');
        assert.equal((await call('PUT', '/profile/language', { cookie: as.customer, json: { language: 'de' } })).status, 400);
        assert.equal((await call('PUT', '/profile/language', { json: { language: 'uk' } })).status, 401);
    });
});

describe('notifications and emails', () => {
    test('sent in the recipient\'s language, listed in the reader\'s language', async () => {
        await db.query("UPDATE creators SET Language = 'uk' WHERE Creator_ID = ?", [f.artist.id]);
        const before = sent.length;
        const payload = await notify(f.artist.id, {
            type: 'painting_sold',
            title: { key: 'notifications.painting_sold.title' },
            body: { key: 'notifications.painting_sold.body', params: { title: 'Sunset', amount: { money: 123450 } } },
            link: '/profile?tab=wallet',
            email: true,
        });
        assert.equal(payload.title, 'Вашу картину купили');
        assert.match(payload.body, /^«Sunset» купили\. 1\s234,50\s₴ додано до гаманця\.$/);

        const mail = sent.slice(before).find((m) => m.to === f.artist.email);
        assert.ok(mail, 'email sent');
        assert.equal(mail.subject, 'Вашу картину купили');
        assert.match(mail.text, /^Вітаємо, /);

        const uk = (await call('GET', '/notifications', { cookie: as.artist, lang: 'uk' })).data.notifications.find((n) => n.id === payload.id);
        assert.equal(uk.title, 'Вашу картину купили');
        const en = (await call('GET', '/notifications', { cookie: as.artist, lang: 'en' })).data.notifications.find((n) => n.id === payload.id);
        assert.equal(en.title, 'Your painting was sold');
        assert.match(en.body, /^"Sunset" was bought\. UAH\s1,234\.50 added to your wallet\.$/);
    });
    test('stage names inside notifications are translated', async () => {
        const payload = await notify(f.artist.id, {
            type: 'stage_submitted',
            title: { key: 'notifications.stage_submitted.title', params: { stage: { key: 'stages.Lineart' } } },
        });
        assert.equal(payload.title, 'Етап «Лайн» готовий до перевірки');
    });
    test('password reset email follows the page language', async () => {
        const before = sent.length;
        await call('POST', '/auth/forgot-password', { json: { email: f.customer.email }, lang: 'uk' });
        const mail = sent.slice(before).find((m) => m.to === f.customer.email);
        assert.equal(mail.subject, 'Зміна пароля DigitalBrush');
        await call('POST', '/auth/forgot-password', { json: { email: f.customer.email }, lang: 'en' });
        assert.equal(sent.at(-1).subject, 'Reset your DigitalBrush password');
    });
});
