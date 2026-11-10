// Fondy (залишено як резервний провайдер; за замовчуванням використовується WayForPay).
// Підпис: SHA1 від FONDY_SECRET і відсортованих за ключем непорожніх значень, з'єднаних "|".
const crypto = require('crypto');
const { fetch, publicApiBase } = require('../httpClient');

const NAME = 'fondy';

function isConfigured() {
    return Boolean(process.env.FONDY_MERCHANT_ID && process.env.FONDY_SECRET);
}

function createSignature(data) {
    const keys = Object.keys(data).filter((k) => {
        const v = data[k];
        if (k === 'signature' || k === 'response_signature_string') return false;
        return v !== undefined && v !== null && v !== '';
    });
    keys.sort();
    const values = keys.map((k) => String(data[k]));
    return crypto.createHash('sha1').update([process.env.FONDY_SECRET, ...values].join('|')).digest('hex');
}

function isValidSignature(data) {
    if (!process.env.FONDY_SECRET || !data || typeof data.signature !== 'string') return false;
    const expected = Buffer.from(createSignature(data), 'utf8');
    const received = Buffer.from(data.signature, 'utf8');
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function toResult(data) {
    const s = String(data.order_status || '').toLowerCase();
    return {
        orderId: data.order_id,
        status: ['approved', 'declined', 'expired'].includes(s) ? s : (s === 'reversed' ? 'refunded' : 'pending'),
        amount: Number(data.amount),
        currency: data.currency,
        providerStatus: data.order_status,
    };
}

async function createCheckout({ orderId, amount, currency, description }) {
    const payload = {
        merchant_id: process.env.FONDY_MERCHANT_ID,
        order_id: orderId,
        order_desc: description,
        currency,
        amount,
        response_url: `${publicApiBase()}/payments/return/${NAME}`,
        server_callback_url: `${publicApiBase()}/payments/callback/${NAME}`,
    };
    payload.signature = createSignature(payload);

    const data = await fetch((process.env.FONDY_API_URL || 'https://api.fondy.eu') + '/api/checkout/url/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: payload }),
    }).then((r) => r.json());

    const url = data?.response?.checkout_url;
    if (url) return { checkoutUrl: url };
    const err = new Error(`Fondy checkout failed: ${data?.response?.error_code} ${data?.response?.error_message}`);
    err.providerResponse = data;
    throw err;
}

function parseCallback(req) {
    const data = req.body || {};
    if (!isValidSignature(data)) return { valid: false };
    return { valid: true, result: toResult(data), respond: (res) => res.send('OK') };
}

// Fondy повертає користувача POST-запитом з підписаними даними.
async function handleReturn(req) {
    const data = req.method === 'GET' ? (req.query || {}) : (req.body || {});
    return isValidSignature(data) ? toResult(data) : null;
}

module.exports = {
    name: NAME,
    isConfigured,
    createCheckout,
    parseCallback,
    handleReturn,
    _internal: { createSignature, isValidSignature },
};
