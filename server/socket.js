const { Server } = require('socket.io');
const { loadCommissionAccess, getRole, getSessionUserId } = require('./utils/commissionAccess');

let io = null;

const COMMISSION_ROOM_RE = /^commission_(\d+)$/;

function init(server, { sessionMiddleware, corsOrigin, ...options } = {}) {
  if (io) return io;
  io = new Server(server, {
    cors: {
      origin: corsOrigin || 'https://bestartgallery.pp.ua',
      credentials: true
    },
    ...options
  });

  // Ділимо express-session із socket.io, щоб знати, хто підключився.
  if (sessionMiddleware) {
    io.engine.use(sessionMiddleware);
  }

  io.on('connection', (socket) => {
    const userId = getSessionUserId(socket.request);

    // Без сесії сокет нічого не отримує.
    if (!userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      socket.disconnect(true);
      return;
    }

    // Особиста кімната: оновлення статусів своїх комішенів.
    socket.join(`user_${userId}`);

    // Приєднатися до чату комішену можна лише його учаснику.
    socket.on('join', async (room, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {};
      try {
        const match = COMMISSION_ROOM_RE.exec(String(room || ''));
        if (!match) return respond({ ok: false, error: 'invalid_room' });

        const commission = await loadCommissionAccess(match[1]);
        if (!commission || !getRole(commission, userId)) {
          socket.emit('joinError', { room, error: 'forbidden' });
          return respond({ ok: false, error: 'forbidden' });
        }

        socket.join(room);
        respond({ ok: true });
      } catch (err) {
        console.error('[socket] join error:', err);
        respond({ ok: false, error: 'server_error' });
      }
    });

    socket.on('leave', (room) => {
      if (COMMISSION_ROOM_RE.test(String(room || ''))) socket.leave(room);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { init, getIO };
