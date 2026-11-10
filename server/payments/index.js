const wayforpay = require('./providers/wayforpay');
const fondy = require('./providers/fondy');

const PROVIDERS = { [wayforpay.name]: wayforpay, [fondy.name]: fondy };

function getProvider(name) {
    return PROVIDERS[String(name || '').toLowerCase()] || null;
}

// Провайдер для НОВИХ оплат. Callback-и обробляються для будь-якого відомого провайдера,
// щоб замовлення, створені до перемикання, теж завершились.
function getActiveProvider() {
    return getProvider(process.env.PAYMENT_PROVIDER || 'wayforpay');
}

module.exports = { getProvider, getActiveProvider };
