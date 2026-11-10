// Use global fetch if available (Node 18+), otherwise lazy-load node-fetch.
const fetch = (...args) =>
    (globalThis.fetch
        ? globalThis.fetch(...args)
        : import('node-fetch').then(({ default: f }) => f(...args)));

// Public base URL of the API *including* the /api prefix, e.g. https://bestartgallery.pp.ua/api
function publicApiBase() {
    return (process.env.API_URL || 'http://localhost:8080/api').replace(/\/+$/, '');
}

function publicAppBase() {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

module.exports = { fetch, publicApiBase, publicAppBase };
