
// utils/logger.js
// Lightweight, robust logger for Spetech Lost and Found Web
// - Supports levels: debug, info, warn, error
// - Writes to rotating daily log files in /logs (file-per-day)
// - Also prints colored output to console
// - Provides Express middleware for request logging
// - Non-blocking file writes, defensive and fault-tolerant
//
// Usage:
//   const logger = require('./utils/logger');
//   logger.init({ level: 'debug', logsDir: './logs' });
//   logger.info('Server started', { port: 3000 });
//   app.use(logger.expressMiddleware());
//
// Dependencies: fs-extra (npm install fs-extra)

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const DEFAULTS = {
  level: 'info',
  logsDir: path.join(process.cwd(), 'logs'),
  console: true,
  file: true,
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB (not strict rotation, daily file used)
  timestampFormat: 'iso' // 'iso' or 'locale'
};

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

let config = Object.assign({}, DEFAULTS);

/* --- Helpers --- */
function nowIso() {
  return new Date().toISOString();
}
function nowLocale() {
  return new Date().toLocaleString();
}
function timestamp() {
  return config.timestampFormat === 'locale' ? nowLocale() : nowIso();
}
function levelEnabled(level) {
  return LEVELS[level] >= LEVELS[config.level];
}
function safeStringify(obj) {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}
function colorForLevel(level) {
  // ANSI color codes
  switch (level) {
    case 'debug': return '\x1b[36m'; // cyan
    case 'info': return '\x1b[32m';  // green
    case 'warn': return '\x1b[33m';  // yellow
    case 'error': return '\x1b[31m'; // red
    default: return '\x1b[37m';       // white
  }
}
function resetColor() { return '\x1b[0m'; }

/* --- File utilities --- */
async function ensureLogsDir() {
  try {
    await fs.ensureDir(config.logsDir);
  } catch (err) {
    // If cannot create logs dir, disable file logging to avoid crashing
    config.file = false;
    console.error('Logger: cannot create logs directory, file logging disabled.', err);
  }
}
function dailyLogFilePath() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const fname = `spetech-lnf-${yyyy}${mm}${dd}.log`;
  return path.join(config.logsDir, fname);
}
async function appendToFile(line) {
  if (!config.file) return;
  try {
    const filePath = dailyLogFilePath();
    await fs.appendFile(filePath, line + os.EOL, 'utf8');
  } catch (err) {
    // degrade gracefully: disable file logging after repeated failures
    console.error('Logger: failed to write log file, disabling file logging.', err);
    config.file = false;
  }
}

/* --- Core logging --- */
async function log(level, message, meta) {
  if (!LEVELS.hasOwnProperty(level)) level = 'info';
  if (!levelEnabled(level)) return;

  const ts = timestamp();
  const pid = process.pid;
  const host = os.hostname();
  const metaStr = meta ? ` ${safeStringify(meta)}` : '';
  const line = `[${ts}] [${level.toUpperCase()}] [pid:${pid}] [${host}] ${message}${metaStr}`;

  // Console output
  if (config.console) {
    try {
      const color = colorForLevel(level);
      const out = `${color}[${ts}]${resetColor()} ${colorForLevel(level)}[${level.toUpperCase()}]${resetColor()} ${message}${meta ? ' ' + safeStringify(meta) : ''}`;
      if (level === 'error' || level === 'warn') {
        console.error(out);
      } else {
        console.log(out);
      }
    } catch (e) {
      // ignore console formatting errors
      try { console.log(line); } catch (_) {}
    }
  }

  // File output (non-blocking)
  if (config.file) {
    // append asynchronously, but don't await to keep non-blocking behavior
    appendToFile(line).catch(() => {});
  }
}

/* --- Convenience wrappers --- */
function debug(msg, meta) { return log('debug', String(msg || ''), meta); }
function info(msg, meta) { return log('info', String(msg || ''), meta); }
function warn(msg, meta) { return log('warn', String(msg || ''), meta); }
function error(msg, meta) { return log('error', String(msg || ''), meta); }

/* --- Express middleware --- */
function expressMiddleware(opts = {}) {
  const { skip = () => false } = opts;
  return async function (req, res, next) {
    try {
      if (typeof skip === 'function' && skip(req)) return next();

      const start = Date.now();
      const { method, originalUrl } = req;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection && req.connection.remoteAddress || 'unknown';

      // When response finishes, log details
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        const msg = `${method} ${originalUrl} ${status} ${duration}ms`;
        const meta = { ip, method, url: originalUrl, status, duration };
        log(level, msg, meta).catch ? null : null;
      });

      next();
    } catch (err) {
      // If middleware fails, ensure next is called
      try { next(); } catch (e) {}
    }
  };
}

/* --- Initialization --- */
async function init(options = {}) {
  config = Object.assign({}, config, options || {});
  // normalize level
  if (!config.level || !LEVELS.hasOwnProperty(config.level)) config.level = DEFAULTS.level;
  // ensure logs dir if file logging enabled
  if (config.file) await ensureLogsDir();
  // write startup banner
  info('Logger initialized', { level: config.level, logsDir: config.logsDir, console: config.console, file: config.file });
  return config;
}

/* --- Utility: capture unhandled errors --- */
function attachProcessHandlers(opts = {}) {
  const { captureUnhandledRejections = true, captureUncaughtExceptions = true } = opts;
  if (captureUnhandledRejections) {
    process.on('unhandledRejection', (reason, p) => {
      error('Unhandled Rejection', { reason: safeStringify(reason) });
    });
  }
  if (captureUncaughtExceptions) {
    process.on('uncaughtException', (err) => {
      error('Uncaught Exception', { message: err && err.message, stack: err && err.stack });
      // Do not exit automatically; leave decision to host app
    });
  }
}

/* --- Exported API --- */
module.exports = {
  init,
  debug,
  info,
  warn,
  error,
  expressMiddleware,
  attachProcessHandlers,
  // expose config for runtime inspection
  _config: () => config
};
