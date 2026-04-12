
// middleware/roleCheck.js
// Role-based authorization middleware for Spetech Lost and Found Web
//
// Exports:
//  - requireRole(role)        -> middleware that requires a single role (e.g., 'admin')
//  - requireAnyRole(roles)    -> middleware that requires any role from an array
//  - isAdmin(req)             -> sync helper that returns true if req.user.role === 'admin'
//
// Behavior:
//  - Works together with middleware/auth.js (expects req.user to be attached by requireAuth or optionalAuth).
//  - If req.user is missing, it returns 401 Unauthorized.
//  - If role check fails, it returns 403 Forbidden with a clear JSON message.
//  - Defensive and prototype-friendly: does not throw on missing DB, returns JSON errors.

const userModel = require('../models/userModel'); // used only if we need to re-validate user from DB

// Async wrapper to catch errors in async middleware
function asyncMiddleware(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * isAdmin(req)
 * Synchronous helper to quickly check admin role on req.user
 */
function isAdmin(req) {
  if (!req || !req.user) return false;
  return String(req.user.role || '').toLowerCase() === 'admin';
}

/**
 * requireRole(role)
 * Returns middleware that ensures the authenticated user has the exact role.
 * Example: app.use('/api/admin', requireAuth, requireRole('admin'), adminRouter)
 */
function requireRole(role) {
  if (!role) throw new Error('requireRole: role parameter is required');
  const normalized = String(role).toLowerCase();

  return asyncMiddleware(async (req, res, next) => {
    // Ensure user is present (assumes requireAuth ran earlier). If not, respond 401.
    if (!req.user) {
      return res.status(401).json({ ok: false, message: 'Autentikasi diperlukan.' });
    }

    // If role is already present on req.user, check it
    if (String(req.user.role || '').toLowerCase() === normalized) {
      return next();
    }

    // Defensive: try to re-fetch user from DB to ensure latest role
    try {
      const fresh = await userModel.getUserSafe(req.user.id).catch(() => null);
      if (fresh && String(fresh.role || '').toLowerCase() === normalized) {
        // update req.user to fresh copy
        req.user = fresh;
        return next();
      }
    } catch (err) {
      // ignore and fall through to forbidden
    }

    return res.status(403).json({ ok: false, message: 'Akses ditolak. Peran tidak mencukupi.' });
  });
}

/**
 * requireAnyRole(roles)
 * Returns middleware that ensures the authenticated user has any of the provided roles.
 * roles: array of role strings
 * Example: requireAnyRole(['admin','moderator'])
 */
function requireAnyRole(roles = []) {
  if (!Array.isArray(roles) || roles.length === 0) throw new Error('requireAnyRole: roles array required');

  const normalizedSet = new Set(roles.map(r => String(r).toLowerCase()));

  return asyncMiddleware(async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: 'Autentikasi diperlukan.' });
    }

    const userRole = String(req.user.role || '').toLowerCase();
    if (normalizedSet.has(userRole)) return next();

    // Defensive: re-check from DB
    try {
      const fresh = await userModel.getUserSafe(req.user.id).catch(() => null);
      if (fresh && normalizedSet.has(String(fresh.role || '').toLowerCase())) {
        req.user = fresh;
        return next();
      }
    } catch (err) {
      // ignore
    }

    return res.status(403).json({ ok: false, message: 'Akses ditolak. Peran tidak mencukupi.' });
  });
}

/**
 * allowRoles(roles)
 * Convenience alias for requireAnyRole
 */
const allowRoles = requireAnyRole;

module.exports = {
  requireRole,
  requireAnyRole,
  allowRoles,
  isAdmin
};
