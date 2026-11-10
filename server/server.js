// server/.env незалежно від того, з якої папки запущено node (у Docker змінні приходять через --env-file)
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 8080;

db.getConnection()
    .then(conn => {
        console.log('✅ Database connected');
        conn.release();
        // create http server and initialize socket.io
        const http = require('http');
        const server = http.createServer(app);
        const { init } = require('./socket');
        init(server, {
            sessionMiddleware: app.locals.sessionMiddleware,
            corsOrigin: app.locals.corsOrigin
        });

        server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.error('❌ DB connection failed:', err));
