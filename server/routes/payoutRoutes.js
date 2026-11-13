// Card for automatic payouts (WayForPay). See services/payouts.js.
const express = require('express');
const logger = require('../utils/logger');
const auth = require('../middleware/authMiddleware');
const requireArtist = require('../middleware/requireArtist');
const payouts = require('../services/payouts');
const wayforpay = require('../payments/providers/wayforpay');
const { publicAppBase } = require('../payments/httpClient');
const { getSessionUserId } = require('../utils/commissionAccess');

const router = express.Router();
const rawBody = express.text({ type: '*/*', limit: '1mb' });

const requireEnabled = (req, res, next) => (payouts.isEnabled()
    ? next()
    : res.status(404).json({ success: false, message: 'Card payouts are not available' }));

// GET /api/payouts/card → { enabled, card: { mask, type } | null }
router.get('/card', auth, async (req, res) => {
    try {
        res.json({ success: true, enabled: payouts.isEnabled(), card: await payouts.getCard(getSessionUserId(req)) });
    } catch (err) {
        logger.error('Payout card error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// POST /api/payouts/card/verify → { action, fields }: the browser posts this form to WayForPay
router.post('/card/verify', auth, requireArtist, requireEnabled, async (req, res) => {
    try {
        res.json({ success: true, ...(await payouts.startCardVerification(getSessionUserId(req), req.lang)) });
    } catch (err) {
        logger.error('Card verification start error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.delete('/card', auth, async (req, res) => {
    try {
        await payouts.removeCard(getSessionUserId(req));
        res.json({ success: true });
    } catch (err) {
        logger.error('Remove payout card error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// The browser comes back from WayForPay (GET or POST); the result itself arrives by the notification
router.all('/card/return', async (req, res) => {
    let outcome = 'fail';
    try {
        outcome = await payouts.verificationOutcome(req.query.order);
    } catch (err) {
        logger.error('Card verification return error:', err);
    }
    res.redirect(302, `${publicAppBase()}/profile?tab=wallet&card=${outcome}`);
});

// Server-to-server notifications: card verification results and payout results
router.post('/callback/wayforpay', rawBody, async (req, res) => {
    try {
        const answer = await payouts.handleNotification(wayforpay._internal.extractCallbackBody(req));
        if (!answer) {
            logger.warn('[payouts] notification with an invalid signature');
            return res.status(400).send('invalid signature');
        }
        return res.json(answer);
    } catch (err) {
        logger.error('[payouts] notification error:', err);
        return res.sendStatus(500);
    }
});

module.exports = router;
