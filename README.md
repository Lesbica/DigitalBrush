# DigitalBrush

Маркетплейс цифрового арту: художники продають готові роботи та приймають комішени
(індивідуальні замовлення) з чатом, поетапним погодженням і оплатою.

| Частина | Стек |
|---|---|
| Фронтенд (`src/`) | React 19, React Router 7, Vite, axios, socket.io-client, react-i18next (укр/англ); тести — Vitest + Testing Library |
| Бекенд (`server/`) | Node.js 22, Express 5, mysql2, express-session (сесії в MySQL), socket.io, sharp |
| База даних | MySQL 8, міграції в `server/migrations/` |
| Оплата | WayForPay (Fondy — резервний провайдер) |
| CI/CD | GitHub Actions: лінт, міграції + API-тести на MySQL, збірка фронтенду, Docker-образи в GHCR |

## Швидкий старт (локально)

Потрібні Node.js 22+ і MySQL 8.

```bash
npm run setup                          # залежності фронтенду і бекенду
cp server/.env.example server/.env     # заповни DB_*, SESSION_SECRET; для локальної роботи — див. нижче
npm run migrate                        # створить/оновить схему БД
npm run server                         # API на http://localhost:8080
npm start                              # фронтенд на http://localhost:3000
```

Для локальної розробки в `server/.env`:

```
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
API_URL=http://localhost:8080/api
COOKIE_SECURE=false
PAYMENT_PROVIDER=wayforpay
WAYFORPAY_MERCHANT_ACCOUNT=test_merch_n1          # публічний тестовий мерчант WayForPay
WAYFORPAY_SECRET_KEY=flk3409refn54t54t*FNJRET
```

Фронтенд бере адресу API з `.env.development` (`VITE_API_BASE`, див. `src/config.js`).

## Команди

| Команда | Що робить |
|---|---|
| `npm run setup` | встановлює залежності кореня (фронтенд) і `server/` (бекенд) |
| `npm start` / `npm run build` | фронтенд: dev-сервер Vite / продакшн-збірка в `build/` |
| `npm test` / `npm run lint` | тести фронтенду (Vitest) / ESLint фронтенду |
| `npm run server` | запуск API |
| `npm run migrate` | застосувати нові міграції (`server/scripts/migrate.js`, облік у `schema_migrations`) |
| `npm run test:api` | інтеграційні тести API (`server/tests`, node:test) на БД з `server/.env`; кожен набір створює й прибирає власні дані |
| `npm run lint:server` | ESLint для бекенду |
| `npm run withdrawals -- list` / `pay <id>` / `reject <id>` | ручна обробка заявок на виведення коштів |

## Структура

```
server/
  app.js, server.js        Express-застосунок і запуск (HTTP + socket.io)
  config/                  БД (mysql2 pool), завантаження файлів (multer)
  routes/                  auth, paintings, profile, search, payments, images
  commissions/             комішени та чат
  Artists/                 художники
  payments/                логіка оплати (core.js) і провайдери (wayforpay, fondy)
  utils/                   доступ до комішенів, зображення, профіль, логер
  migrations/              SQL-міграції (000 — базова схема)
  scripts/                 migrate.js, setup-phase0.sh (налаштування сервера)
  tests/                   API-тести
src/                       React-застосунок
```

## Можливості

- Магазин картин (прев'ю для всіх, оригінали — покупцям), лайки, сторінки художників із рейтингом.
- Комішени: публічні й прямі, етапи Скетч → Лайн → Колір → Фінал, правки, автозатвердження,
  відхилення/скасування, дедлайни, чат із зображеннями, відгуки після завершення.
- Акаунти: ролі художник/замовник, підтвердження email, відновлення пароля, статус доступності.
- Сповіщення в застосунку (наживо через socket.io) і email.
- Гаманець художника: доходи з продажів і комішенів (ескроу до завершення), заявки на виведення на IBAN.
- Оплата через WayForPay.
- Інтерфейс українською та англійською (перемикач у меню, вибір запамʼятовується), ціни в гривнях.

Листи без налаштованого SMTP (`SMTP_HOST`) лише пишуться в лог бекенду — звідти можна відкрити посилання.

## Ключові правила

- Секрети — лише в `server/.env` або змінних оточення; `.env` у git не потрапляє.
- Схема БД змінюється тільки новою міграцією; перед міграцією, що змінює дані, — бекап.
- Суму оплати рахує сервер за цінами з БД; результат оплати приймається тільки після перевірки підпису
  або запиту статусу в платіжного провайдера.
- Доступ до комішенів, чату, зображень комішенів і сокет-кімнат — лише учасникам.
- Зображення у відповідях API — посилання на `/api/images/...` (WebP-прев'ю, кеш); оригінали картин
  отримують тільки покупці.

Детальніше — у [CLAUDE.md](CLAUDE.md).

## Деплой

Збірка образів відбувається автоматично на `master`. Розгортання на сервері запускається вручну
(Actions → CI-CD-PaintingsProject → Run workflow) і вимагає на сервері файл `~/paintings/backend.env`
(див. `server/scripts/setup-phase0.sh`).
