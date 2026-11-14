#!/usr/bin/env node
// Fills the database with realistic demo content: artists with generated artworks, customers,
// likes, purchases, public commission requests, orders at every stage with chat, reviews,
// wallet entries and a few notifications.
//
//   npm run seed:demo -- --wipe     # DELETES all data (schema stays), then loads the demo
//
// Only for a local database (DB_HOST localhost/127.0.0.1) unless --allow-remote is given.
// Take a backup first if the database holds anything you need (mysqldump).
// Every demo account uses the password from SEED_PASSWORD (see server/.env.example).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const args = new Set(process.argv.slice(2));
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

async function main() {
    if (!LOCAL_HOSTS.includes(String(process.env.DB_HOST)) && !args.has('--allow-remote')) {
        throw new Error(`DB_HOST=${process.env.DB_HOST} is not local. Pass --allow-remote if you really mean it.`);
    }
    const password = process.env.SEED_PASSWORD;
    if (!password || password.length < 8) throw new Error('Set SEED_PASSWORD (8+ characters) in server/.env or the environment.');

    const db = require('../config/db');
    const bcrypt = require('bcrypt');
    const sharp = require('sharp');
    const { painting, avatar } = require('./demo/art');
    const wallet = require('../services/wallet');
    const { notify } = require('../services/notifications');
    const { ARTISTS, CUSTOMERS, PUBLIC_REQUESTS, ORDERS, PURCHASES } = require('./demo/data');

    const [[{ users }]] = await db.query('SELECT COUNT(*) AS users FROM creators');
    if (users > 0 && !args.has('--wipe')) {
        throw new Error(`Database ${process.env.DB_NAME} already has ${users} users. Run with --wipe to delete ALL data first.`);
    }

    console.log(`Seeding ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    if (args.has('--wipe')) {
        const conn = await db.getConnection();
        let tables;
        try {
            await conn.query('SET SESSION information_schema_stats_expiry = 0'); // current AUTO_INCREMENT values
            [tables] = await conn.query(
                `SELECT table_name AS t, auto_increment AS next FROM information_schema.tables
                  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'`
            );
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');
            for (const { t, next } of tables) {
                await conn.query(`TRUNCATE TABLE \`${t}\``);
                // ids keep counting up: image URLs contain ids and browsers cache them for a week
                if (next > 1) await conn.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = ${Number(next)}`);
            }
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        } finally {
            conn.release();
        }
        console.log(`  wiped ${tables.length} tables`);
    }

    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    const ago = (days, hours = 0) => new Date(now - days * DAY - hours * 3600 * 1000);
    let seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const hash = await bcrypt.hash(password, 10);

    // ---------- users ----------
    const ids = {};
    const names = {};
    const addUser = async (u, role, createdDaysAgo) => {
        const [r] = await db.query(
            `INSERT INTO creators (Name, Email, Email_Verified, Password, Role, Language, Other_Details, styles, languages,
                                   Availability, Image, Created_At)
             VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [u.name, u.email, hash, role, u.language, u.bio || null, JSON.stringify(u.styles || []),
                JSON.stringify(u.languages || []), u.availability || 'open', await avatar(seed++ * 7919, u.palette), ago(createdDaysAgo)]
        );
        ids[u.key] = r.insertId;
        names[u.key] = u.name;
    };
    for (const [i, a] of ARTISTS.entries()) await addUser(a, 'artist', 330 - i * 30);
    for (const [i, c] of CUSTOMERS.entries()) await addUser(c, 'customer', 200 - i * 25);
    console.log(`  ${ARTISTS.length} artists, ${CUSTOMERS.length} customers`);

    // ---------- artworks ----------
    // inserted oldest first, so ids follow the upload dates like on a real site
    const queue = ARTISTS.flatMap((a) => a.paintings.map((row, i) => ({ a, row, seed: 1000 + (a.key.length * 97 + i) * 31, created: ago(5 + rand() * 280) })))
        .sort((x, y) => x.created - y.created);
    const paintings = {};
    let pIndex = 0;
    for (const { a, row, seed: artSeed, created } of queue) {
        const [title, scene, palette, ratio, category, style, format, price, description] = row;
        const fmt = format === 'PNG' ? 'png' : format === 'WEBP' ? 'webp' : 'jpeg';
        const img = await painting({ seed: artSeed + pIndex, scene, palette, ratio, format: fmt });
        const [b] = await db.query('INSERT INTO painting_batches (Created_At) VALUES (?)', [created]);
        const [r] = await db.query(
            `INSERT INTO paintings (Title, Description, Creation_Date, Image, Author, Creator_ID, Style, Price, Batch_ID,
                                    width, height, likes, Category, Format)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [title, description, created, img.buffer, a.name, ids[a.key], style, price, b.insertId, img.width, img.height, category, format]
        );
        paintings[title] = { id: r.insertId, price, artist: a.key, created };
        pIndex++;
    }
    console.log(`  ${pIndex} artworks`);

    // ---------- likes ----------
    const everyone = [...ARTISTS, ...CUSTOMERS].map((u) => u.key);
    let likes = 0;
    for (const [title, p] of Object.entries(paintings)) {
        const popularity = rand();
        for (const u of everyone) {
            if (u === p.artist || rand() > popularity * 0.8) continue;
            await db.query('INSERT INTO painting_likes (Painting_ID, User_ID, Created_At) VALUES (?, ?, ?)',
                [p.id, ids[u], new Date(p.created.getTime() + rand() * (now - p.created.getTime()))]);
            likes++;
        }
        await db.query('UPDATE paintings SET likes = (SELECT COUNT(*) FROM painting_likes WHERE Painting_ID = ?) WHERE Painting_ID = ?', [p.id, p.id]);
        void title;
    }
    console.log(`  ${likes} likes`);

    // ---------- purchases ----------
    let orderNo = 0;
    const orderId = () => `order_demo${String(++orderNo).padStart(4, '0')}${Math.floor(rand() * 1e8).toString(16)}`;
    for (const [buyer, title] of PURCHASES) {
        const p = paintings[title];
        if (!p) throw new Error(`Unknown painting in PURCHASES: ${title}`);
        const when = new Date(p.created.getTime() + rand() * (now - p.created.getTime()));
        const id = orderId();
        const amount = Math.round(p.price * 100);
        await db.query(
            `INSERT INTO payment_orders (Order_ID, User_ID, Status, Amount, Currency, Provider, Created_At, Type, Target_ID)
             VALUES (?, ?, 'approved', ?, 'UAH', 'wayforpay', ?, 'cart', 0)`, [id, ids[buyer], amount, when]);
        await db.query('INSERT INTO payment_order_items (Order_ID, Painting_ID) VALUES (?, ?)', [id, p.id]);
        await db.query('INSERT INTO user_purchases (User_ID, Painting_ID, Purchase_Date) VALUES (?, ?, ?)', [ids[buyer], p.id, when]);
        await wallet.creditSale(db, { orderId: id, paintingId: p.id, artistId: ids[p.artist], payerId: ids[buyer], gross: amount, title });
        await db.query('UPDATE wallet_transactions SET Created_At = ? WHERE Order_ID = ?', [when, id]);
    }
    console.log(`  ${PURCHASES.length} purchases`);

    // ---------- public requests ----------
    const smallRef = async (scene, palette) =>
        (await painting({ seed: 5000 + seed++ * 13, scene, palette, ratio: 'portrait', width: 900 })).buffer;
    for (const [i, [cust, title, description, category, style, format, size, price, deadline, refScene]] of PUBLIC_REQUESTS.entries()) {
        const created = ago(i * 0.8 + rand() * 0.6, Math.floor(rand() * 12));
        await db.query(
            `INSERT INTO commissions (Title, Description, Category, Style, Size, Format, Price, Deadline, ReferenceImage,
                                      Type, Customer_ID, Creator_ID, status, Created_At)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', ?, NULL, 'Open', ?)`,
            [title, description, category, style, size, format, price, new Date(now + deadline * DAY),
                refScene ? await smallRef(refScene) : null, ids[cust], created]
        );
    }
    console.log(`  ${PUBLIC_REQUESTS.length} public requests`);

    // ---------- direct orders with chat and stages ----------
    const STAGES = ['Sketch', 'Lineart', 'Color', 'Final'];
    const stageImage = async (base, stage) => {
        const img = sharp(base).resize(1000);
        if (stage === 'Sketch') return img.greyscale().blur(2.5).linear(0.55, 110).jpeg({ quality: 80 }).toBuffer();
        if (stage === 'Lineart') {
            return img.greyscale().convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
                .negate().linear(1.4, -40).jpeg({ quality: 80 }).toBuffer();
        }
        if (stage === 'Color') return img.modulate({ saturation: 0.75 }).blur(1.2).jpeg({ quality: 82 }).toBuffer();
        return img.jpeg({ quality: 86 }).toBuffer();
    };
    const say = (cid, from, to, type, content, image, at) => db.query(
        'INSERT INTO messages (senderId, receiverId, commissionId, type, content, image, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [from, to, cid, type, content, image, 'read', at]
    );

    const created = {};
    for (const [i, o] of ORDERS.entries()) {
        const cust = ids[o.customer];
        const art = ids[o.artist];
        const start = ago(o.daysAgo, Math.floor(rand() * 10));
        const finished = o.status === 'Completed';
        const working = STAGES.includes(o.status);
        const paid = working || finished;
        const base = o.scene ? (await painting({ seed: 9000 + i * 17, scene: o.scene, palette: o.palette, ratio: 'portrait', width: 1400 })).buffer : null;
        const reference = o.scene ? await smallRef(o.scene === 'city' ? 'aurora' : o.scene, o.palette) : null;

        const [r] = await db.query(
            `INSERT INTO commissions (Title, Description, Category, Style, Size, Format, Price, Deadline, ReferenceImage,
                                      Type, Customer_ID, Creator_ID, status, Review_State, is_paid, ResultImage, Created_At, Updated_At)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'direct', ?, ?, ?, 'none', ?, ?, ?, ?)`,
            [o.title, o.description, o.category, o.style, o.size, o.format, o.price,
                new Date(start.getTime() + 30 * DAY), reference, cust, art, o.status, paid ? 1 : 0,
                finished && base ? await stageImage(base, 'Final') : null, start, start]
        );
        const cid = r.insertId;
        created[o.title] = cid;

        if (paid) {
            const id = orderId();
            const amount = Math.round(o.price * 100);
            const paidAt = new Date(start.getTime() + 3 * 3600 * 1000);
            await db.query(
                `INSERT INTO payment_orders (Order_ID, User_ID, Status, Amount, Currency, Provider, Created_At, Type, Target_ID)
                 VALUES (?, ?, 'approved', ?, 'UAH', 'wayforpay', ?, 'commission', ?)`, [id, cust, amount, paidAt, cid]);
            await wallet.creditCommission(db, { orderId: id, commissionId: cid, artistId: art, payerId: cust, gross: amount, completed: finished, title: o.title });
            await db.query('UPDATE wallet_transactions SET Created_At = ? WHERE Order_ID = ?', [paidAt, id]);
        }

        // timeline: chat lines, then submitted/approved stages up to the current one
        const doneStages = finished ? 4 : working ? STAGES.indexOf(o.status) : 0;
        const steps = o.chat.length + doneStages * 2 + (working && o.review === 'pending' ? 1 : 0);
        const span = Math.max(now - start.getTime() - 2 * 3600 * 1000, 3600 * 1000);
        let n = 0;
        const at = () => new Date(start.getTime() + ((++n) / (steps + 1)) * span);
        const half = Math.ceil(o.chat.length / 2);
        const line = async ([who, text]) => say(cid, who === 'c' ? cust : art, who === 'c' ? art : cust, 'text', text, null, at());
        for (const l of o.chat.slice(0, half)) await line(l);
        for (let s = 0; s < doneStages; s++) {
            const [m] = await say(cid, art, cust, 'stage', null, await stageImage(base, STAGES[s]), at());
            await say(cid, cust, art, 'stage-approve', String(m.insertId), null, at());
        }
        if (working && o.review === 'pending') {
            const t = at();
            await say(cid, art, cust, 'stage', null, await stageImage(base, o.status), t);
            await db.query(`UPDATE commissions SET Review_State = 'pending', Stage_Submitted_At = ? WHERE Commission_ID = ?`, [t, cid]);
        }
        for (const l of o.chat.slice(half)) await line(l);

        if (finished && o.rating) {
            await db.query(
                'INSERT INTO reviews (Commission_ID, Artist_ID, Customer_ID, Rating, Text, Created_At) VALUES (?, ?, ?, ?, ?, ?)',
                [cid, art, cust, o.rating, o.review_text, new Date(now - (o.daysAgo - 20) * DAY)]
            );
        }
    }
    console.log(`  ${ORDERS.length} direct orders with chat`);

    // ---------- a paid withdrawal ----------
    const [w] = await db.query(
        `INSERT INTO withdrawals (User_ID, Amount, Method, Destination, Status, Created_At, Processed_At)
         VALUES (?, 150000, 'iban', 'UA213223130000026007233566001', 'paid', ?, ?)`, [ids.maria, ago(10), ago(9)]);
    await db.query(
        `INSERT INTO wallet_transactions (User_ID, Type, Amount, Status, Ref, Withdrawal_ID, Description, Created_At)
         VALUES (?, 'withdrawal', -150000, 'completed', ?, ?, 'Withdrawal to UA2132…6001', ?)`,
        [ids.maria, `withdrawal:${w.insertId}`, w.insertId, ago(10)]);

    // ---------- notifications (no emails) ----------
    const k = (key, params) => ({ key, params });
    const link = (cid) => `/profile?commission=${cid}`;
    const luna = created['Портрет нашої кішки Луни біля вікна'];
    await notify(ids.olena, { type: 'stage_submitted', title: k('notifications.stage_submitted.title', { stage: { key: 'stages.Color' } }), body: k('notifications.stage_submitted.body', { title: 'Портрет нашої кішки Луни біля вікна', stage: { key: 'stages.Color' }, stageLower: 'color' }), link: link(luna), commissionId: luna });
    await notify(ids.levko, { type: 'new_order', title: k('notifications.new_order.title'), body: k('notifications.new_order.body', { title: 'Акварельна мапа нашого села' }), link: link(created['Акварельна мапа нашого села']), commissionId: created['Акварельна мапа нашого села'] });
    await notify(ids.iryna, { type: 'new_order', title: k('notifications.new_order.title'), body: k('notifications.new_order.body', { title: 'Floral pattern for a tea brand' }), link: link(created['Floral pattern for a tea brand']), commissionId: created['Floral pattern for a tea brand'] });
    await notify(ids.maria, { type: 'painting_sold', title: k('notifications.painting_sold.title'), body: k('notifications.painting_sold.body', { title: 'Фіолетова година', amount: { money: 240000 } }), link: '/profile?tab=wallet' });

    console.log('\nDemo accounts (password = SEED_PASSWORD):');
    for (const u of [...ARTISTS, ...CUSTOMERS]) console.log(`  ${ARTISTS.includes(u) ? 'artist  ' : 'customer'}  ${u.email}`);
    await db.end();
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
