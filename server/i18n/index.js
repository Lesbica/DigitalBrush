// Server-side texts in Ukrainian and English.
//
// - API messages are written in English in the code; `api` in uk.json translates them (the English
//   text is the key, {{name}} marks a variable part). localizeResponses() translates the `message`
//   and `error` fields of JSON responses into the language of the request, so route code stays as is.
//   Machine codes (`not_found`, `payments_unavailable`) are never in the catalog and stay unchanged.
// - Notifications and emails use keyed texts (`notifications.*`, `email.*`) rendered with t().
const uk = require('./uk.json');
const en = require('./en.json');

const CATALOGS = { uk, en };
const LANGUAGES = ['uk', 'en'];
const DEFAULT_LANGUAGE = 'en';     // API requests without a usable Accept-Language
const DEFAULT_USER_LANGUAGE = 'uk'; // stored for accounts that never chose a language

const normalizeLanguage = (value) => {
    const code = String(value || '').trim().slice(0, 2).toLowerCase();
    return LANGUAGES.includes(code) ? code : null;
};

// First supported language of an Accept-Language header ("uk-UA,uk;q=0.9,en;q=0.8")
function pickLanguage(header) {
    const ranked = String(header || '')
        .split(',')
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(';');
            const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
            return { lang: normalizeLanguage(tag), q: q ? Number(q.slice(2)) || 0 : 1, index };
        })
        .filter(x => x.lang && x.q > 0)
        .sort((a, b) => b.q - a.q || a.index - b.index);
    return ranked.length ? ranked[0].lang : DEFAULT_LANGUAGE;
}

const interpolate = (text, params = {}) =>
    String(text).replace(/\{\{(\w+)\}\}/g, (m, name) => (params[name] === undefined ? m : String(params[name])));

function lookup(catalog, key) {
    return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalog);
}

// Keyed text: t('uk', 'notifications.accepted.title', { title })
function t(lang, key, params) {
    const text = lookup(CATALOGS[normalizeLanguage(lang) || DEFAULT_LANGUAGE], key) ?? lookup(en, key);
    return typeof text === 'string' ? interpolate(text, params) : key;
}

// --- API messages ---------------------------------------------------------------------------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(uk.api)
    .filter(([source]) => source.includes('{{'))
    .map(([source, target]) => {
        const names = [];
        const re = new RegExp('^' + source.split(/(\{\{\w+\}\})/).map((chunk) => {
            const m = /^\{\{(\w+)\}\}$/.exec(chunk);
            if (!m) return escapeRe(chunk);
            names.push(m[1]);
            return '(.+?)';
        }).join('') + '$');
        return { re, names, target };
    });

// Words that appear as variables inside messages (statuses, field names)
const translateWord = (lang, word) => (lang === 'uk' && uk.words[word]) || word;

function translateMessage(lang, text) {
    if (lang !== 'uk' || typeof text !== 'string') return text;
    if (Object.prototype.hasOwnProperty.call(uk.api, text)) return uk.api[text];
    for (const p of patterns) {
        const m = p.re.exec(text);
        if (m) {
            const params = {};
            p.names.forEach((name, i) => { params[name] = translateWord(lang, m[i + 1]); });
            return interpolate(p.target, params);
        }
    }
    return text;
}

// Express middleware: req.lang from Accept-Language; JSON `message`/`error` translated on the way out
function localizeResponses(req, res, next) {
    req.lang = pickLanguage(req.headers['accept-language']);
    res.setHeader('Content-Language', req.lang);
    const json = res.json.bind(res);
    res.json = (body) => {
        if (req.lang !== 'en' && body && typeof body === 'object' && !Array.isArray(body)) {
            const out = { ...body };
            for (const field of ['message', 'error']) {
                if (typeof out[field] === 'string') out[field] = translateMessage(req.lang, out[field]);
            }
            return json(out);
        }
        return json(body);
    };
    next();
}

module.exports = {
    LANGUAGES,
    DEFAULT_USER_LANGUAGE,
    normalizeLanguage,
    pickLanguage,
    t,
    translateMessage,
    localizeResponses,
    catalogs: CATALOGS,
};
