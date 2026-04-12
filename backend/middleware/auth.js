
// middleware/auth.js
// Authentication & authorization middleware for Spetech Lost and Found Web
//
// Usage:
//   const { requireAuth, requireAdmin, optionalAuth } = require('./middleware/auth');
//   app.use('/api/admin', requireAuth, requireAdmin, adminRouter);
//
// Behavior:
// - Supports token-based sessions via header "Authorization: Bearer <token>"
//   or custom header "x-session-token".
// - Validates session using models/sessionModel and attaches `req.user` (safe user object).
// - Provides `requireAuth` (must be authenticated), `requireAdmin` (must be admin), and
//   `optionalAuth` (if token present, attach user; otherwise continue as guest).
//
// Notes:
// - This middleware is prototype-friendly and defensive: it never throws on missing DB,
//   and always responds with clear JSON on auth failures.

const sessionModel = require('../models/sessionModel');
const userModel = require('../models/userModel');

function extractTokenFromReq(req) {
  // Prefer Authorization: Bearer <token>
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (auth && typeof auth === 'string') {
    const parts = auth.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
    // fallback: if header contains raw token
    return auth.trim();
  }
  // fallback header
  const alt = req.headers['x-session-token'] || req.headers['x-session'] || req.query.session;
  return alt || null;
}

// Async wrapper to catch errors in async middleware
function asyncMiddleware(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * optionalAuth
 * If a valid session token is provided, attaches req.user = { id, username, role }.
 * Otherwise continues without error.
 */
const optionalAuth = asyncMiddleware(async (req, res, next) => {
  const token = extractTokenFromReq(req);
  if (!token) return next();

  const session = await sessionModel.getSession(token).catch(() => null);
  if (!session) return next();

  const user = await userModel.getUserSafe(session.userId).catch(() => null);
  if (!user) return next();

  req.user = user;
  req.session = session;
  return next();
});

/**
 * requireAuth
 * Requires a valid session token. On success attaches req.user and req.session.
 * On failure returns 401 JSON.
 */
const requireAuth = asyncMiddleware(async (req, res, next) => {
  const token = extractTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ ok: false, message: 'Autentikasi diperlukan. Token tidak ditemukan.' });
  }

  const session = await sessionModel.getSession(token).catch(() => null);
  if (!session) {
    return res.status(401).json({ ok: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
  }

  const user = await userModel.getUserSafe(session.userId).catch(() => null);
  if (!user) {
    return res.status(401).json({ ok: false, message: 'User tidak ditemukan untuk sesi ini.' });
  }

  req.user = user;
  req.session = session;
  return next();
});

/**
 * requireAdmin
 * Requires authenticated user and role === 'admin'.
 * Should be used after requireAuth (or will call requireAuth internally).
 */
const requireAdmin = asyncMiddleware(async (req, res, next) => {
  // If user already attached (requireAuth used), use it; otherwise enforce auth now.
  if (!req.user) {
    // call requireAuth inline
    const token = extractTokenFromReq(req);
    if (!token) return res.status(401).json({ ok: false, message: 'Autentikasi diperlukan.' });
    const session = await sessionModel.getSession(token).catch(() => null);
    if (!session) return res.status(401).json({ ok: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
    const user = await userModel.getUserSafe(session.userId).catch(() => null);
    if (!user) return res.status(401).json({ ok: false, message: 'User tidak ditemukan.' });
    req.user = user;
    req.session = session;
  }

  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Akses ditolak. Hanya admin yang dapat mengakses resource ini.' });
  }

  return next();
});

/**
 * attachUserToResponse
 * Helper to expose minimal user info in responses if present.
 * Example usage in routes: res.locals.user = req.user || null;
 */
function attachUserToResponse(req, res, next) {
  if (req.user) res.locals.user = req.user;
  else res.locals.user = null;
  next();
}

module.exports = {
  extractTokenFromReq,
  optionalAuth,
  requireAuth,
  requireAdmin,
  attachUserToResponse
};
