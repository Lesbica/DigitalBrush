// Addresses of the backend. Set VITE_API_BASE in .env.development / at build time;
// the production build falls back to the public site.
export const API_BASE = (import.meta.env.VITE_API_BASE || 'https://bestartgallery.pp.ua/api').replace(/\/+$/, '');

// socket.io lives on the same server, without the /api prefix
export const SOCKET_BASE = API_BASE.replace(/\/api$/, '');
