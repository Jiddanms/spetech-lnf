
// models/sessionModel.js
// Simple file-based session model for Spetech Lost and Found Web
// Purpose: lightweight session management for prototype (create, validate, revoke sessions)
// Note: For production, replace with secure session store (Redis, DB) and use secure cookies/JWT.

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const APP_ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(APP_ROOT, 'database', 'db.json');

// Default session TTL in milliseconds (7 days)
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

/* --- Internal helpers --- */
async function readDb() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return { users: [], items: [], sessions: [] };
    const data = await fs.readJson(DB_FILE);
    // ensure sessions array exists
    data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return data;
  } catch (err) {
    console.error('sessionModel.readDb error', err);
    return { users: [], items: [], sessions: [] };
  }
}

async function writeDb(data) {
  // ensure file exists and write
  await fs.ensureFile(DB_FILE);
  await fs.writeJson(DB_FILE, data, { spaces: 2 });
}

/* --- Session model API --- */

/**
 * createSession(userId, opts)
 * - userId: string (required)
 * - opts: { ttl } optional, ttl in ms
 * Returns session object: { token, userId, createdAt, expiresAt }
 */
async function createSession(userId, opts = {}) {
  if (!userId) throw new Error('userId required to create session');
  const ttl = typeof opts.ttl === 'number' ? opts.ttl : DEFAULT_TTL;
  const db = await readDb();
  db.sessions = db.sessions || [];

  const token = uuidv4();
  const now = Date.now();
  const session = {
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    meta: opts.meta || {}
  };

  db.sessions.push(session);
  await writeDb(db);
  return session;
}

/**
 * getSession(token)
 * - returns session object if exists and not expired, otherwise null
 */
async function getSession(token) {
  if (!token) return null;
  const db = await readDb();
  db.sessions = db.sessions || [];
  const s = db.sessions.find(x => x.token === token);
  if (!s) return null;
  const now = Date.now();
  if (new Date(s.expiresAt).getTime() <= now) {
    // expired: remove it and persist
    await deleteSession(token);
    return null;
  }
  return s;
}

/**
 * deleteSession(token)
 * - removes session by token, returns true if removed, false otherwise
 */
async function deleteSession(token) {
  if (!token) return false;
  const db = await readDb();
  db.sessions = db.sessions || [];
  const idx = db.sessions.findIndex(x => x.token === token);
  if (idx === -1) return false;
  db.sessions.splice(idx, 1);
  await writeDb(db);
  return true;
}

/**
 * purgeExpiredSessions()
 * - removes all expired sessions and returns number removed
 */
async function purgeExpiredSessions() {
  const db = await readDb();
  db.sessions = db.sessions || [];
  const now = Date.now();
  const before = db.sessions.length;
  db.sessions = db.sessions.filter(s => new Date(s.expiresAt).getTime() > now);
  const removed = before - db.sessions.length;
  if (removed > 0) await writeDb(db);
  return removed;
}

/**
 * listSessions({ userId })
 * - returns array of sessions, optionally filtered by userId
 */
async function listSessions(opts = {}) {
  const { userId } = opts;
  const db = await readDb();
  db.sessions = db.sessions || [];
  if (userId) return db.sessions.filter(s => s.userId === userId);
  return db.sessions.slice();
}

/**
 * extendSession(token, extraTtl)
 * - extends session expiry by extraTtl (ms) or by DEFAULT_TTL if not provided
 * - returns updated session or null if not found/expired
 */
async function extendSession(token, extraTtl) {
  if (!token) return null;
  const db = await readDb();
  db.sessions = db.sessions || [];
  const idx = db.sessions.findIndex(x => x.token === token);
  if (idx === -1) return null;
  const now = Date.now();
  const current = db.sessions[idx];
  if (new Date(current.expiresAt).getTime() <= now) {
    // expired
    await deleteSession(token);
    return null;
  }
  const add = typeof extraTtl === 'number' ? extraTtl : DEFAULT_TTL;
  current.expiresAt = new Date(Math.max(new Date(current.expiresAt).getTime(), now) + add).toISOString();
  current.updatedAt = new Date().toISOString();
  db.sessions[idx] = current;
  await writeDb(db);
  return current;
}

/* --- Export API --- */
module.exports = {
  createSession,
  getSession,
  deleteSession,
  purgeExpiredSessions,
  listSessions,
  extendSession,
  DEFAULT_TTL
};
