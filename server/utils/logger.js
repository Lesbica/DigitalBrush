// Minimal leveled logger. LOG_LEVEL = debug | info | warn | error | silent (default: info,
// tests set warn). One line per entry: ISO time, level, message, then any extra values.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function threshold() {
    return LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;
}

function write(level, args) {
    if (LEVELS[level] < threshold()) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)}`;
    const out = level === 'error' || level === 'warn' ? console.error : console.log;
    out(line, ...args);
}

module.exports = {
    debug: (...args) => write('debug', args),
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
};
