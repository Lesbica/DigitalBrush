const express = require('express');
const auth = require('../middleware/authMiddleware');
const { CURRENCY, priceCart, priceCommission, createOrder, applyPaymentResult } = require('../payments/core');
const { getProvider, getActiveProvider } = require('../payments');
const { publicAppBase } = require('../payments/httpClient');

const router = express.Router();

// Тіло, яке не розібрали глобальні json/urlencoded парсери (напр. text/plain від WayForPay).
const rawBody = express.text({ type: '*/*', limit: '1mb' });

// POST /api/payments/create-session
// body: { paintingIds: number[] } або { type: 'commission', commissionId }
// Суму рахує сервер; поле amount у запиті ігнорується.
router.post('/create-session', auth, async (req, res) => {
    try {
        const userId = req.session.user?.Creator_ID || req.session.user?.id;
        if (!userId) return res.status(401).json({ error: 'unauthorized' });

        const provider = getActiveProvider();
        if (!provider || !provider.isConfigured()) {
            console.error('[payments] provider is not configured:', process.env.PAYMENT_PROVIDER || 'wayforpay');
            return res.status(503).json({ error: 'payments_unavailable' });
        }

        const { paintingIds, type, commissionId } = req.body || {};
        const priced = type === 'commission'
            ? await priceCommission(userId, commissionId)
            : await priceCart(userId, paintingIds);

        if (priced.error) {
            const { status, ...body } = priced;
            return res.status(status).json(body);
        }

        const orderId = await createOrder(userId, priced, provider.name);
        const { checkoutUrl } = await provider.createCheckout({
            orderId,
            amount: priced.amount,
            currency: CURRENCY,
            description: priced.description,
            items: priced.items,
        });

        return res.json({ checkoutUrl, orderId });
    } catch (err) {
        console.error('[payments] create-session failed:', err.message, err.providerResponse || '');
        return res.status(502).json({ error: 'payment_create_failed' });
    }
});

// Сервер-сервер сповіщення від провайдера.
async function handleCallback(providerName, req, res) {
    const provider = getProvider(providerName);
    if (!provider) return res.status(404).json({ error: 'unknown_provider' });
    try {
        const parsed = provider.parseCallback(req);
        if (!parsed.valid) {
            console.warn(`[payments] ${provider.name} callback: invalid signature`);
            return res.status(400).send('invalid signature');
        }
        await applyPaymentResult(provider.name, parsed.result);
        return parsed.respond(res);
    } catch (err) {
        console.error(`[payments] ${providerName} callback error:`, err);
        return res.sendStatus(500);
    }
}

// Повернення користувача з платіжної сторінки. Покупку фіксуємо лише з даними,
// які провайдер підтвердив (підпис або запит статусу з нашого сервера).
async function handleReturn(providerName, req, res) {
    const appUrl = publicAppBase();
    const provider = getProvider(providerName);
    if (!provider) return res.redirect(302, appUrl + '/fail');
    try {
        const result = await provider.handleReturn(req);
        if (!result) {
            console.warn(`[payments] ${provider.name} return: unverified`);
            return res.redirect(302, appUrl + '/fail');
        }
        await applyPaymentResult(provider.name, result);
        return res.redirect(302, appUrl + (result.status === 'approved' ? '/success' : '/fail'));
    } catch (err) {
        console.error(`[payments] ${providerName} return error:`, err);
        return res.redirect(302, appUrl + '/fail');
    }
}

router.post('/callback/:provider', rawBody, (req, res) => handleCallback(req.params.provider, req, res));
router.all('/return/:provider', (req, res) => handleReturn(req.params.provider, req, res));

// Старі адреси Fondy (/api/fondy/*) — щоб завершились оплати, створені до оновлення.
const legacyFondyRouter = express.Router();
legacyFondyRouter.post('/webhook', (req, res) => handleCallback('fondy', req, res));
legacyFondyRouter.all('/return', (req, res) => handleReturn('fondy', req, res));

module.exports = router;
module.exports.legacyFondyRouter = legacyFondyRouter;
