import i18n from './index';

// Prices are stored and charged in hryvnias (server/payments/core.js: CURRENCY = 'UAH').
export const CURRENCY = 'UAH';

const locale = () => (i18n.resolvedLanguage === 'uk' ? 'uk-UA' : 'en-GB');

export function formatPrice(value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency: CURRENCY,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(n);
}

// Always two decimals (balances, transaction lists)
export function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency: CURRENCY,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale(), options).format(d);
}

export function formatDateTime(value) {
    return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}
