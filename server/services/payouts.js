// Automatic payouts to the artist's card through WayForPay.
//
// 1. Linking a card: Card Verify (amount 0) on the WayForPay page. WayForPay posts the result with the
//    card token (recToken) to /api/payouts/callback/wayforpay; we keep the token encrypted and the
//    masked number. The card number itself never reaches our server.
// 2. Payout: Account2Card (transactionType P2P_CREDIT) with that token. orderReference is
//    payout_<withdrawalId>, so a repeated request cannot pay twice. Approved → paid, Declined → the
//    amount returns to the balance, anything else → "processing" and the scheduler asks CHECK_STATUS.
//
// On when PAYOUTS=wayforpay. A separate WayForPay merchant for payouts can be set with
// WAYFORPAY_PAYOUT_MERCHANT_ACCOUNT / WAYFORPAY_PAYOUT_SECRET_KEY (defaults: the payment merchant).
const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../utils/logger');
const wallet = require('./wallet');
const { walletEvents } = require('./notifications');
const { fetch, publicApiBase, publicAppBase } = require('../payments/httpClient');
const wayforpay = require('../payments/providers/wayforpay');

const VERIFY_URL = 'https://secure.wayforpay.com/verify';
const API_URL = 'https://api.wayforpay.com/api';
const PROVIDER = 'wayforpay';
const VERIFY_RE = /^vrf_[0-9a-f]{32}$/;
const PAYOUT_RE = /^payout_(\d+)$/;

const { sign } = wayforpay._internal;

function config() {
    return {
        account: process.env.WAYFORPAY_PAYOUT_MERCHANT_ACCOUNT || process.env.WAYFORPAY_MERCHANT_ACCOUNT,
        secret: process.env.WAYFORPAY_PAYOUT_SECRET_KEY || process.env.WAYFORPAY_SECRET_KEY,
        domain: process.env.WAYFORPAY_DOMAIN || new URL(publicAppBase()).hostname,
    };
}

const isEnabled = () => process.env.PAYOUTS === 'wayforpay' && Boolean(config().account && config().secret);

// --- token encryption (AES-256-GCM) --------------------------------------------------------------
function tokenKey() {
    const source = process.env.CARD_TOKEN_KEY || process.env.SESSION_SECRET;
    if (!source) throw new Error('CARD_TOKEN_KEY or SESSION_SECRET is required to store card tokens');
    return crypto.createHash('sha256').update(`card-token:${source}`).digest();
}

function encryptToken(token) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
    const data = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

function decryptToken(stored) {
    const [iv, tag, data] = String(stored).split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// --- signatures -----------------------------------------------------------------------------------
const safeEqual = (a, b) => {
    const x = Buffer.from(String(a || ''));
    const y = Buffer.from(String(b || ''));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Notifications and CHECK_STATUS answers: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
function isAuthenticStatus(d) {
    const { account, secret } = config();
    return Boolean(d && d.merchantAccount === account && d.merchantSignature
        && safeEqual(sign(wayforpay._internal.statusSignatureValues(d), secret), d.merchantSignature));
}

// Account2Card answer: merchantAccount;orderReference;amount;currency;authCode;transactionStatus;reasonCode
function isAuthenticCredit(d) {
    const { account, secret } = config();
    const values = [d.merchantAccount, d.orderReference, d.amount, d.currency, d.authCode, d.transactionStatus, d.reasonCode];
    return Boolean(d && d.merchantAccount === account && d.merchantSignature && safeEqual(sign(values, secret), d.merchantSignature));
}

// --- card linking ---------------------------------------------------------------------------------
async function getCard(userId) {
    const [[row]] = await db.query('SELECT Card_Mask, Card_Type, Created_At FROM payout_cards WHERE User_ID = ?', [userId]);
    return row ? { mask: row.Card_Mask, type: row.Card_Type || null, linkedAt: row.Created_At } : null;
}

async function removeCard(userId) {
    await db.query('DELETE FROM payout_cards WHERE User_ID = ?', [userId]);
}

// Fields of the form the browser posts to WayForPay (the page itself collects the card)
async function startCardVerification(userId, lang) {
    const { account, secret, domain } = config();
    const orderReference = `vrf_${crypto.randomBytes(16).toString('hex')}`;
    await db.query('INSERT INTO payout_card_verifications (Order_ID, User_ID) VALUES (?, ?)', [orderReference, userId]);
    const fields = {
        merchantAccount: account,
        merchantAuthType: 'SimpleSignature',
        merchantDomainName: domain,
        merchantSignature: sign([account, domain, orderReference, '0', 'UAH'], secret),
        apiVersion: '1',
        orderReference,
        amount: '0',
        currency: 'UAH',
        paymentSystem: 'lookupCard',
        returnUrl: `${publicApiBase()}/payouts/card/return?order=${orderReference}`,
        serviceUrl: `${publicApiBase()}/payouts/callback/${PROVIDER}`,
        language: lang === 'uk' ? 'UA' : 'EN',
    };
    return { action: VERIFY_URL, fields };
}

async function applyVerification(d) {
    const [[v]] = await db.query('SELECT User_ID, Status FROM payout_card_verifications WHERE Order_ID = ?', [d.orderReference]);
    if (!v) {
        logger.warn(`[payouts] unknown card verification ${d.orderReference}`);
        return;
    }
    if (v.Status !== 'pending') return; // repeated notification
    if (d.transactionStatus === 'Approved' && d.recToken) {
        const mask = String(d.cardPan || '').slice(0, 20) || '••••';
        await db.query(
            `INSERT INTO payout_cards (User_ID, Provider, Token_Enc, Card_Mask, Card_Type) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE Provider = VALUES(Provider), Token_Enc = VALUES(Token_Enc),
                 Card_Mask = VALUES(Card_Mask), Card_Type = VALUES(Card_Type), Created_At = NOW()`,
            [v.User_ID, PROVIDER, encryptToken(d.recToken), mask, d.cardType ? String(d.cardType).slice(0, 20) : null]
        );
        await db.query("UPDATE payout_card_verifications SET Status = 'approved' WHERE Order_ID = ?", [d.orderReference]);
        logger.info(`[payouts] card linked for user ${v.User_ID}`);
    } else if (['Declined', 'Expired', 'Voided'].includes(d.transactionStatus)) {
        await db.query("UPDATE payout_card_verifications SET Status = 'failed' WHERE Order_ID = ?", [d.orderReference]);
    }
}

// Where to send the browser back after the WayForPay page
async function verificationOutcome(orderReference) {
    if (!VERIFY_RE.test(String(orderReference || ''))) return 'fail';
    const [[v]] = await db.query('SELECT Status FROM payout_card_verifications WHERE Order_ID = ?', [orderReference]);
    if (!v || v.Status === 'failed') return 'fail';
    return v.Status === 'approved' ? 'ok' : 'pending'; // the notification may arrive a moment later
}

// --- payouts --------------------------------------------------------------------------------------
async function finish(w, outcome, providerStatus, reason) {
    const done = await wallet.processWithdrawal(w.Withdrawal_ID, outcome, outcome === 'rejected' ? reason || null : null, providerStatus);
    if (!done) return null; // already finished elsewhere
    if (outcome === 'paid') await walletEvents.withdrawalPaid(w.User_ID, { amount: w.Amount });
    else await walletEvents.withdrawalRejected(w.User_ID, { amount: w.Amount, note: reason });
    logger.info(`[payouts] withdrawal ${w.Withdrawal_ID} ${outcome} (${providerStatus})`);
    return done;
}

async function applyCreditStatus(w, d) {
    const status = d.transactionStatus;
    if (status === 'Approved') return finish(w, 'paid', status);
    if (['Declined', 'Expired', 'Voided', 'Refunded'].includes(status)) return finish(w, 'rejected', status, d.reason ? String(d.reason).slice(0, 200) : status);
    await db.query('UPDATE withdrawals SET Provider_Status = ? WHERE Withdrawal_ID = ?', [String(status || 'unknown').slice(0, 40), w.Withdrawal_ID]);
    return null;
}

/** Sends a pending card withdrawal to WayForPay. Safe to call twice: only one call moves it on. */
async function sendPayout(withdrawalId) {
    const [r] = await db.query(
        "UPDATE withdrawals SET Status = 'processing' WHERE Withdrawal_ID = ? AND Method = 'card' AND Status = 'pending'",
        [withdrawalId]
    );
    if (!r.affectedRows) return null;
    const [[w]] = await db.query('SELECT * FROM withdrawals WHERE Withdrawal_ID = ?', [withdrawalId]);
    const [[card]] = await db.query('SELECT Token_Enc FROM payout_cards WHERE User_ID = ?', [w.User_ID]);
    if (!card) return finish(w, 'rejected', 'NoCard', 'The payout card was removed');

    const { account, secret } = config();
    const orderReference = `payout_${w.Withdrawal_ID}`;
    const amount = (w.Amount / 100).toFixed(2);
    let token;
    try {
        token = decryptToken(card.Token_Enc);
    } catch {
        // the encryption key changed: the card has to be linked again
        logger.error(`[payouts] withdrawal ${w.Withdrawal_ID}: the stored card token cannot be decrypted`);
        await db.query('DELETE FROM payout_cards WHERE User_ID = ?', [w.User_ID]);
        return finish(w, 'rejected', 'TokenUnreadable', 'Link the payout card again');
    }
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionType: 'P2P_CREDIT',
                merchantAccount: account,
                merchantAuthType: 'SimpleSignature',
                orderReference,
                amount,
                currency: 'UAH',
                rec2Token: token,
                // signature string is merchantAccount;orderReference;amount;currency;cardBeneficiary;rec2Token
                merchantSignature: sign([account, orderReference, amount, 'UAH', '', token], secret),
                apiVersion: 1,
                serviceUrl: `${publicApiBase()}/payouts/callback/${PROVIDER}`,
            }),
        });
        const d = await res.json();
        if (!d || d.orderReference !== orderReference || !isAuthenticCredit(d)) {
            logger.error(`[payouts] withdrawal ${w.Withdrawal_ID}: unverified answer`, d && { reason: d.reason, reasonCode: d.reasonCode });
            return null; // stays "processing"; the scheduler asks CHECK_STATUS
        }
        return applyCreditStatus(w, d);
    } catch (err) {
        logger.error(`[payouts] withdrawal ${w.Withdrawal_ID}: request failed:`, err.message);
        return null; // stays "processing"
    }
}

async function checkPayout(w) {
    const { account, secret } = config();
    const orderReference = `payout_${w.Withdrawal_ID}`;
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transactionType: 'CHECK_STATUS',
            merchantAccount: account,
            orderReference,
            merchantSignature: sign([account, orderReference], secret),
            apiVersion: 1,
        }),
    });
    const d = await res.json();
    if (!d || d.orderReference !== orderReference || !isAuthenticStatus(d)) return null;
    return applyCreditStatus(w, d);
}

/** Scheduler: sends card withdrawals left pending and asks about the ones still processing. */
async function payoutTick() {
    if (!isEnabled()) return;
    const [rows] = await db.query(
        `SELECT * FROM withdrawals
          WHERE Method = 'card' AND Status IN ('pending', 'processing') AND Created_At < NOW() - INTERVAL 1 MINUTE
          ORDER BY Withdrawal_ID LIMIT 50`
    );
    for (const w of rows) {
        try {
            if (w.Status === 'pending') await sendPayout(w.Withdrawal_ID);
            else await checkPayout(w);
        } catch (err) {
            logger.error(`[payouts] withdrawal ${w.Withdrawal_ID}:`, err.message);
        }
    }
}

// --- notifications from WayForPay ----------------------------------------------------------------
/** Returns the signed answer WayForPay expects, or null when the notification is not authentic. */
async function handleNotification(d) {
    if (!isAuthenticStatus(d)) return null;
    const ref = String(d.orderReference || '');
    if (VERIFY_RE.test(ref)) {
        await applyVerification(d);
    } else {
        const m = PAYOUT_RE.exec(ref);
        if (m) {
            const [[w]] = await db.query('SELECT * FROM withdrawals WHERE Withdrawal_ID = ? AND Method = \'card\'', [Number(m[1])]);
            if (w && ['pending', 'processing'].includes(w.Status)) await applyCreditStatus(w, d);
        }
    }
    const time = Math.floor(Date.now() / 1000);
    return { orderReference: ref, status: 'accept', time, signature: sign([ref, 'accept', time], config().secret) };
}

module.exports = {
    isEnabled,
    getCard,
    removeCard,
    startCardVerification,
    verificationOutcome,
    sendPayout,
    payoutTick,
    handleNotification,
    _internal: { encryptToken, decryptToken },
};
