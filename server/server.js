// server/.env незалежно від того, з якої папки запущено node (у Docker змінні приходять через --env-file)
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const logger = require('./utils/logger');
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 8080;

db.getConnection()
    .then(conn => {
        logger.info('✅ Database connected');
        conn.release();
        // create http server and initialize socket.io
        const http = require('http');
        const server = http.createServer(app);
        const { init } = require('./socket');
        init(server, {
            sessionMiddleware: app.locals.sessionMiddleware,
            corsOrigin: app.locals.corsOrigin
        });

        server.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));

        // Background jobs (auto-approval of stages the customer did not review in time)
        require('./services/scheduler').start();
    })
    .catch(err => logger.error('❌ DB connection failed:', err));
