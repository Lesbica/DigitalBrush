// WayForPay: https://wiki.wayforpay.com/en/view/852102 (Purchase, serviceUrl),
// https://wiki.wayforpay.com/en/view/852117 (CHECK_STATUS).
// Усі підписи — HMAC_MD5(SecretKey) від значень, з'єднаних через ";".
const crypto = require('crypto');
const { fetch, publicApiBase, publicAppBase } = require('../httpClient');

const NAME = 'wayforpay';
const PAY_URL = 'https://secure.wayforpay.com/pay?behavior=offline';
const API_URL = 'https://api.wayforpay.com/api';

function config() {
    return {
        account: process.env.WAYFORPAY_MERCHANT_ACCOUNT,
        secret: process.env.WAYFORPAY_SECRET_KEY,
        domain: process.env.WAYFORPAY_DOMAIN || new URL(publicAppBase()).hostname,
    };
}

function isConfigured() {
    const { account, secret } = config();
    return Boolean(account && secret);
}

function sign(values, secret = config().secret) {
    return crypto.createHmac('md5', secret).update(values.map((v) => String(v ?? '')).join(';'), 'utf8').digest('hex');
}

function safeEqual(a, b) {
    const x = Buffer.from(String(a || ''), 'utf8');
    const y = Buffer.from(String(b || ''), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// WayForPay працює в гривнях з копійками після крапки.
const toMajor = (minor) => (minor / 100).toFixed(2);
const toMinor = (major) => Math.round(Number(major) * 100);

const STATUS_MAP = {
    Approved: 'approved',
    Declined: 'declined',
    Expired: 'expired',
    Refunded: 'refunded',
    Voided: 'refunded',
    RefundInProcessing: 'pending',
    InProcessing: 'pending',
    WaitingAuthComplete: 'pending',
    Pending: 'pending',
};

// Поля, які підписує WayForPay у serviceUrl-запиті та у відповіді CHECK_STATUS.
function statusSignatureValues(d) {
    return [d.merchantAccount, d.orderReference, d.amount, d.currency, d.authCode, d.cardPan, d.transactionStatus, d.reasonCode];
}

function toResult(d) {
    return {
        orderId: d.orderReference,
        status: STATUS_MAP[d.transactionStatus] || 'pending',
        amount: toMinor(d.amount),
        currency: d.currency,
        providerStatus: d.transactionStatus,
    };
}

function isAuthentic(d) {
    const { account } = config();
    return Boolean(d && d.merchantAccount === account && d.merchantSignature
        && safeEqual(sign(statusSignatureValues(d)), d.merchantSignature));
}

async function createCheckout({ orderId, amount, currency, items }) {
    const { account, domain } = config();
    const orderDate = Math.floor(Date.now() / 1000);
    const productName = items.map((i) => i.name);
    const productCount = items.map(() => 1);
    const productPrice = items.map((i) => toMajor(i.amount));
    const amountStr = toMajor(amount);

    const merchantSignature = sign([
        account, domain, orderId, orderDate, amountStr, currency,
        ...productName, ...productCount, ...productPrice,
    ]);

    const form = new URLSearchParams();
    form.append('merchantAccount', account);
    form.append('merchantAuthType', 'SimpleSignature');
    form.append('merchantDomainName', domain);
    form.append('merchantTransactionSecureType', 'AUTO');
    form.append('merchantSignature', merchantSignature);
    form.append('orderReference', orderId);
    form.append('orderDate', String(orderDate));
    form.append('amount', amountStr);
    form.append('currency', currency);
    form.append('language', 'UA');
    form.append('returnUrl', `${publicApiBase()}/payments/return/${NAME}?order=${encodeURIComponent(orderId)}`);
    form.append('serviceUrl', `${publicApiBase()}/payments/callback/${NAME}`);
    productName.forEach((v) => form.append('productName[]', v));
    productCount.forEach((v) => form.append('productCount[]', String(v)));
    productPrice.forEach((v) => form.append('productPrice[]', v));

    const res = await fetch(PAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }

    if (data && data.url) return { checkoutUrl: data.url };
    const err = new Error(`WayForPay checkout failed: ${data ? `${data.reasonCode} ${data.reason}` : `HTTP ${res.status}`}`);
    err.providerResponse = data || text.slice(0, 300);
    throw err;
}

// serviceUrl: WayForPay шле JSON у тілі; залежно від заголовків воно може прийти
// вже розпарсеним, сирим рядком або як єдиний ключ urlencoded-тіла.
function extractCallbackBody(req) {
    const body = req.body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
        if (body.orderReference) return body;
        const keys = Object.keys(body);
        if (keys.length === 1 && keys[0].trim().startsWith('{')) {
            try { return JSON.parse(keys[0]); } catch { return null; }
        }
        return null;
    }
    const raw = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
    try { return JSON.parse(raw); } catch { return null; }
}

function parseCallback(req) {
    const d = extractCallbackBody(req);
    if (!isAuthentic(d)) return { valid: false };
    return {
        valid: true,
        result: toResult(d),
        // WayForPay чекає підписане підтвердження, інакше повторює сповіщення.
        respond(res) {
            const time = Math.floor(Date.now() / 1000);
            res.json({
                orderReference: d.orderReference,
                status: 'accept',
                time,
                signature: sign([d.orderReference, 'accept', time]),
            });
        },
    };
}

// Повернення користувача: статус беремо запитом CHECK_STATUS з нашого сервера,
// параметрам у URL не довіряємо.
async function checkStatus(orderId) {
    const { account } = config();
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transactionType: 'CHECK_STATUS',
            merchantAccount: account,
            orderReference: orderId,
            merchantSignature: sign([account, orderId]),
            apiVersion: 1,
        }),
    });
    const d = await res.json();
    if (!d || d.orderReference !== orderId || !isAuthentic(d)) {
        return { verified: false, raw: d };
    }
    return { verified: true, result: toResult(d) };
}

async function handleReturn(req) {
    const orderId = String(req.query.order || '');
    if (!/^order_[0-9a-f]{32}$/.test(orderId)) return null;
    const status = await checkStatus(orderId);
    return status.verified ? status.result : null;
}

module.exports = {
    name: NAME,
    isConfigured,
    createCheckout,
    parseCallback,
    handleReturn,
    _internal: { sign, statusSignatureValues, checkStatus, toMajor, toMinor },
};
