const express = require('express');
const logger = require('../utils/logger');
const db = require('../config/db');
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
            logger.error('[payments] provider is not configured:', process.env.PAYMENT_PROVIDER || 'wayforpay');
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
        logger.error('[payments] create-session failed:', err.message, err.providerResponse || '');
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
            logger.warn(`[payments] ${provider.name} callback: invalid signature`);
            return res.status(400).send('invalid signature');
        }
        await applyPaymentResult(provider.name, parsed.result);
        return parsed.respond(res);
    } catch (err) {
        logger.error(`[payments] ${providerName} callback error:`, err);
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
            logger.warn(`[payments] ${provider.name} return: unverified`);
            return res.redirect(302, appUrl + '/fail');
        }
        await applyPaymentResult(provider.name, result);
        // The result page asks GET /payments/orders/:id for the outcome; a payment that is still
        // processing lands there too and is polled until the provider confirms it.
        const page = ['approved', 'pending'].includes(result.status) ? '/success' : '/fail';
        return res.redirect(302, `${appUrl}${page}?order=${encodeURIComponent(result.orderId)}`);
    } catch (err) {
        logger.error(`[payments] ${providerName} return error:`, err);
        return res.redirect(302, appUrl + '/fail');
    }
}

// GET /api/payments/orders/:orderId — outcome of the buyer's own order (for the payment result page)
const ORDER_ID_RE = /^order_[0-9a-f]{32}$/;
router.get('/orders/:orderId', auth, async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const { orderId } = req.params;
        if (!ORDER_ID_RE.test(orderId)) return res.status(404).json({ error: 'not_found' });
        const [[order]] = await db.query(
            'SELECT Order_ID, User_ID, Status, Type, Target_ID, Amount, Currency FROM payment_orders WHERE Order_ID = ?',
            [orderId]
        );
        // Somebody else's order looks the same as a missing one
        if (!order || Number(order.User_ID) !== Number(userId)) return res.status(404).json({ error: 'not_found' });
        const [items] = await db.query('SELECT Painting_ID FROM payment_order_items WHERE Order_ID = ? ORDER BY Painting_ID', [orderId]);
        return res.json({
            orderId: order.Order_ID,
            status: order.Status,
            type: order.Type,
            commissionId: order.Type === 'commission' ? order.Target_ID : null,
            paintingIds: items.map((i) => i.Painting_ID),
            amount: order.Amount,
            currency: order.Currency,
        });
    } catch (err) {
        logger.error('[payments] order status failed:', err);
        return res.status(500).json({ error: 'internal_error' });
    }
});

router.post('/callback/:provider', rawBody, (req, res) => handleCallback(req.params.provider, req, res));
router.all('/return/:provider', (req, res) => handleReturn(req.params.provider, req, res));

// Старі адреси Fondy (/api/fondy/*) — щоб завершились оплати, створені до оновлення.
const legacyFondyRouter = express.Router();
legacyFondyRouter.post('/webhook', (req, res) => handleCallback('fondy', req, res));
legacyFondyRouter.all('/return', (req, res) => handleReturn('fondy', req, res));

module.exports = router;
module.exports.legacyFondyRouter = legacyFondyRouter;
