
// backend/lib/db.js
// Centralized DB utility for Spetech LNF backend
// - Local dev: read/write db.json
// - Production (Cloudflare Workers): use env.DB (D1 binding)
// - Provides safe read/write, normalization, and optional backup

const fs = require('fs-extra');
const path = require('path');
const { DB_FILE, DB_DIR } = require('../config');

const LOG_PREFIX = '[db]';

// Ensure DB dir exists
fs.ensureDirSync(DB_DIR);

// Default normalized structure
function defaultDb() {
  return { users: [], items: [], sessions: [], locations: [] };
}

/**
 * Local dev: read db.json
 */
async function readDb() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return defaultDb();

    const raw = await fs.readFile(DB_FILE, 'utf8');
    if (!raw || !raw.trim()) return defaultDb();

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn(`${LOG_PREFIX} JSON parse error: ${err.message}`);
      return defaultDb();
    }

    // Normalize
    return {
      users: Array.isArray(data.users) ? data.users : [],
      items: Array.isArray(data.items) ? data.items : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      locations: Array.isArray(data.locations) ? data.locations : []
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} readDb error:`, err);
    return defaultDb();
  }
}

/**
 * Local dev: write db.json atomically
 */
async function writeDb(dbObj) {
  try {
    const data = Object.assign({}, defaultDb(), dbObj);
    const json = JSON.stringify(data, null, 2);

    const tmpName = `.db.tmp.${Date.now()}.${Math.random().toString(36).slice(2,8)}`;
    const tmpPath = path.join(DB_DIR, tmpName);

    await fs.writeFile(tmpPath, json, 'utf8');
    await fs.move(tmpPath, DB_FILE, { overwrite: true });

    console.debug(`${LOG_PREFIX} writeDb: wrote ${DB_FILE} (${json.length} bytes)`);
    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} writeDb failed:`, err);
    throw err;
  }
}

/**
 * Optional backup
 */
async function backupDb() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(DB_DIR, 'backups');
    await fs.ensureDir(backupDir);
    const dest = path.join(backupDir, `db.backup.${stamp}.json`);
    await fs.copy(DB_FILE, dest);
    console.debug(`${LOG_PREFIX} backupDb: created backup at ${dest}`);
    return dest;
  } catch (err) {
    console.warn(`${LOG_PREFIX} backupDb failed:`, err);
    return null;
  }
}

/**
 * Production helper (Cloudflare Workers)
 * Use env.DB (D1 binding) directly in worker files.
 * Example:
 *   const rows = await env.DB.prepare("SELECT * FROM users").all();
 */
function d1Helper(env) {
  return env.DB;
}

module.exports = {
  readDb,
  writeDb,
  backupDb,
  d1Helper,
  DB_FILE
};
