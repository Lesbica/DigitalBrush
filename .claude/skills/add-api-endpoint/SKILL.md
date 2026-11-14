---
name: add-api-endpoint
description: Додати або змінити ендпоінт API бекенду DigitalBrush за правилами проєкту (доступ, i18n, пагінація, зображення, тест)
argument-hint: <що має робити ендпоінт>
---

Реалізуй ендпоінт: $ARGUMENTS

Чекліст із CLAUDE.md — перед завершенням пройдись по кожному пункту:

- **Місце**: роут у `server/routes/`, логіка — в `server/services/`; поруч подивись схожий наявний роут і повтори стиль.
- **Доступ**: дії художника — `middleware/requireArtist.js`; комішени, чат, сокет-кімнати — лише учасникам
  (`utils/commissionAccess.js`: `requireCommissionParticipant`, `getRole`). Готовий результат замовнику — лише після `is_paid`.
  Сесія містить тільки `{ id, name, email }`, профіль читай з БД (`utils/userProfile.js`).
- **Дані**: публічні ендпоінти не віддають `Password`, `Email`, `Birthday`. Параметризовані SQL-запити.
  Схема БД — лише через нову міграцію (скіл `create-migration`).
- **Списки**: `page`/`limit` (макс. 100), відповідь із `total`/`totalPages`; у `SELECT` списків ніяких BLOB-колонок.
- **Зображення**: лише URL (`utils/imageUrls.js`), ніколи base64; завантаження — `withImageUpload(imageUpload…)` з `config/multerConfig.js`.
- **Оплата/гаманець**: суму рахує сервер з цін у БД; гроші — `services/wallet.js` (копійки, унікальний `Ref`).
- **Статуси комішенів**: лише через `services/commissionStages.js`. **Сповіщення**: `services/notifications.js`, не вручну.
- **Тексти**: `message`/`error` англійською в коді + переклад у `server/i18n/uk.json` → `api` (англійський текст як ключ,
  змінні `{{name}}`). Машинні коди (`not_found`) не перекладаються.
- **Логи**: `utils/logger.js`, не `console.*`.
- **Тест**: новий файл або кейс у `server/tests/` (дивись `helpers.js` — `createFixtures`, `sessionFor`).
- **Перевірка**: `npm run lint:server` і `npm run test:api`; після змін у `server/` бекенд треба перезапустити.
- Якщо змінюється фронтенд — тексти тільки через `t('ключ')` у `src/i18n/locales/{uk,en}.json`.
