// server/.env незалежно від того, з якої папки запущено node (у Docker змінні приходять через --env-file)
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const logger = require('./utils/logger');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const paintingRoutes = require('./routes/paintingRoutes');
const profileRoutes = require('./routes/profileRoutes');
const searchRoutes = require('./routes/searchRoutes');
const commissionsRoutes = require('./commissions/Commissions');
const chatRoutes = require('./commissions/chat');
const artistsRoutes = require('./Artists/Artists');
const paymentRoutes = require('./routes/paymentRoutes');

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET env var is required');
}

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://bestartgallery.pp.ua';
const SESSION_COOKIE_NAME = 'bestart.sid';

const app = express();

app.set('trust proxy', 1);

// отключаем ETag, чтобы не было 304
app.set('etag', false);

// CORS должен быть ПЕРВЫМ. cors() сам отвечает на preflight OPTIONS,
// отдельный app.options('*') не нужен (и ломает старт на Express 5).
const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Security headers. Images are loaded by the frontend origin, so resources are shared same-site.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

// Request rate limits per IP (in-memory: per server process)
const limiter = (windowMinutes, limit) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter(1, 300));
app.use('/api/auth/login', limiter(15, 20));
app.use('/api/auth/register', limiter(60, 10));
app.use('/api/auth/check-email', limiter(15, 30));
app.use('/api/auth/resend-verification', limiter(15, 5));
app.use('/api/auth/forgot-password', limiter(15, 5));
app.use('/api/auth/reset-password', limiter(15, 10));
app.use('/api/payments/create-session', limiter(15, 20));

// Body parsers: chat accepts images as data URIs (up to 10 MB), everything else is small
app.use('/api/commissions/chat', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Сессии храним в MySQL (таблица `sessions` создаётся автоматически),
// чтобы они переживали рестарт и не текли по памяти.
const sessionStore = new MySQLStore({}, db);

const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE !== 'false',
    httpOnly: true,
    // Фронт и API на одном сайте: lax не даёт чужим сайтам слать запросы с нашей сессией (CSRF).
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
});
app.use(sessionMiddleware);

// запрет кеширования API
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/paintings', paintingRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/commissions/chat', chatRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/artists', artistsRoutes);
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/payments', paymentRoutes);
app.use('/api/fondy', paymentRoutes.legacyFondyRouter);
// Image files (sets its own Cache-Control, overriding no-store above)
app.use('/api/images', require('./routes/imageRoutes'));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// error handler
app.use((err, req, res, next) => {
  // Client errors raised by middleware (body too large, malformed JSON...) keep their 4xx status
  const status = Number(err.status || err.statusCode);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: err.expose ? err.message : 'Bad request' });
  }
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.locals.sessionMiddleware = sessionMiddleware;
app.locals.sessionStore = sessionStore;
app.locals.corsOrigin = CORS_ORIGIN;
app.locals.sessionCookieName = SESSION_COOKIE_NAME;

module.exports = app;
