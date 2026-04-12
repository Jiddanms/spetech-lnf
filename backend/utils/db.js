
// utils/db.js
// Centralized file-based DB helper for Spetech Lost and Found Web
//
// Responsibilities:
// - Provide safe, atomic read/write access to the JSON DB file (database/db.json).
// - Expose high-level helpers used across routes/models (readDb, writeDb, ensureDb, backup, compact).
// - Provide simple in-process mutex to avoid concurrent write races in single-node deployments.
// - Defensive: creates directories/files as needed and recovers from corrupted JSON by backing up.
//
// Usage:
//   const db = require('../utils/db');
//   await db.ensureDb();
//   const data = await db.read();
//   await db.write(newData);
//   const item = await db.addItem({ name, description, ... });
//
// Note: For production, replace with a proper DB (Postgres, MongoDB, etc.)

const path = require('path');
const fs = require('fs-extra');

const APP_ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(APP_ROOT, 'database');
const DB_FILE = path.join(DB_DIR, 'db.json');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

const DEFAULT_DB = {
  users: [],
  items: [],
  sessions: []
};

// Simple in-process mutex to serialize writes
let writeLock = Promise.resolve();

async function ensureDirs() {
  await fs.ensureDir(DB_DIR);
  await fs.ensureDir(BACKUP_DIR);
}

/**
 * ensureDb
 * Ensures DB file exists and is valid JSON. If missing, creates with DEFAULT_DB.
 * If corrupted, moves corrupted file to backups and recreates a fresh DB.
 */
async function ensureDb() {
  await ensureDirs();
  const exists = await fs.pathExists(DB_FILE);
  if (!exists) {
    await fs.writeJson(DB_FILE, DEFAULT_DB, { spaces: 2 });
    return;
  }
  // Validate JSON
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    JSON.parse(raw);
  } catch (err) {
    // Corrupted JSON: backup and recreate
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const corruptName = path.join(BACKUP_DIR, `db-corrupt-${ts}.json`);
    await fs.move(DB_FILE, corruptName, { overwrite: true });
    await fs.writeJson(DB_FILE, DEFAULT_DB, { spaces: 2 });
  }
}

/**
 * read
 * Reads and returns parsed DB object.
 */
async function read() {
  await ensureDb();
  try {
    const data = await fs.readJson(DB_FILE);
    // Ensure top-level keys exist
    data.users = Array.isArray(data.users) ? data.users : [];
    data.items = Array.isArray(data.items) ? data.items : [];
    data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return data;
  } catch (err) {
    // If read fails, attempt to recover by ensuring DB and returning default
    await ensureDb();
    return { ...DEFAULT_DB };
  }
}

/**
 * write
 * Atomically writes the provided object to DB_FILE.
 * Serializes writes using an in-process mutex to avoid race conditions.
 */
async function write(obj) {
  // queue write operations
  writeLock = writeLock.then(async () => {
    await ensureDb();
    // Defensive: ensure object has required arrays
    const safe = Object.assign({}, DEFAULT_DB, obj);
    safe.users = Array.isArray(safe.users) ? safe.users : [];
    safe.items = Array.isArray(safe.items) ? safe.items : [];
    safe.sessions = Array.isArray(safe.sessions) ? safe.sessions : [];
    // Write atomically using writeJson (fs-extra uses atomic write on many platforms)
    await fs.writeJson(DB_FILE, safe, { spaces: 2 });
  }).catch(async (err) => {
    // If a write fails, log to console and rethrow
    console.error('DB write error', err);
    throw err;
  });
  return writeLock;
}

/**
 * backup
 * Creates a timestamped backup copy of the current DB file.
 * Returns the backup file path.
 */
async function backup() {
  await ensureDb();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `db-backup-${ts}.json`);
  await fs.copy(DB_FILE, dest, { overwrite: true });
  return dest;
}

/**
 * compact
 * Rewrites DB file with compacted JSON (removes whitespace) to save space.
 * Useful for large DB files in prototype.
 */
async function compact() {
  const data = await read();
  // write compact (no spaces)
  await writeLock.then(async () => {
    await fs.writeFile(DB_FILE, JSON.stringify(data), 'utf8');
  });
}

/* Convenience high-level helpers used by routes/models */

// addItem: appends item to items array (newest first)
async function addItem(item) {
  if (!item || typeof item !== 'object') throw new Error('Invalid item');
  const db = await read();
  db.items = db.items || [];
  db.items.unshift(item);
  await write(db);
  return item;
}

// updateItem: finds by id and merges updates
async function updateItem(id, updates = {}) {
  if (!id) throw new Error('id required');
  const db = await read();
  db.items = db.items || [];
  const idx = db.items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  db.items[idx] = Object.assign({}, db.items[idx], updates, { updatedAt: new Date().toISOString() });
  await write(db);
  return db.items[idx];
}

// findItem
async function findItem(id) {
  if (!id) return null;
  const db = await read();
  return (db.items || []).find(i => i.id === id) || null;
}

// listItems with optional filter function
async function listItems(filterFn = null) {
  const db = await read();
  let items = Array.isArray(db.items) ? db.items.slice() : [];
  if (typeof filterFn === 'function') items = items.filter(filterFn);
  return items;
}

// addUser
async function addUser(user) {
  if (!user || typeof user !== 'object') throw new Error('Invalid user');
  const db = await read();
  db.users = db.users || [];
  db.users.push(user);
  await write(db);
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

// findUserByUsername
async function findUserByUsername(username) {
  if (!username) return null;
  const db = await read();
  return (db.users || []).find(u => String(u.username).toLowerCase() === String(username).toLowerCase()) || null;
}

// listUsers
async function listUsers() {
  const db = await read();
  return Array.isArray(db.users) ? db.users.slice() : [];
}

// deleteItem (soft delete by setting status)
async function deleteItem(id) {
  return updateItem(id, { status: 'deleted' });
}

/* Exported API */
module.exports = {
  DB_DIR,
  DB_FILE,
  BACKUP_DIR,
  DEFAULT_DB,
  ensureDirs,
  ensureDb,
  read,
  write,
  backup,
  compact,
  // convenience helpers
  addItem,
  updateItem,
  findItem,
  listItems,
  deleteItem,
  addUser,
  findUserByUsername,
  listUsers
};
