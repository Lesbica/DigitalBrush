// Node 20+ has fetch built in. Looked up on each call so tests can replace globalThis.fetch.
const fetch = (...args) => globalThis.fetch(...args);

// Public base URL of the API *including* the /api prefix, e.g. https://bestartgallery.pp.ua/api
function publicApiBase() {
    return (process.env.API_URL || 'http://localhost:8080/api').replace(/\/+$/, '');
}

function publicAppBase() {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

module.exports = { fetch, publicApiBase, publicAppBase };
