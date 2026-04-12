
// backend/config.js
// Centralized configuration for backend paths and environment settings.
// Purpose: provide a single source of truth for DB path (DB_FILE, DB_DIR, APP_ROOT)
// so all backend modules use the same file and avoid creating duplicate DB files.

const path = require('path');
const fs = require('fs-extra');

const APP_ROOT = path.resolve(__dirname, '..');          // project root
const DB_DIR = path.join(APP_ROOT, 'database');          // canonical database folder
const DB_FILE = path.join(DB_DIR, 'db.json');            // canonical DB file
const FRONTEND_DIR = path.join(APP_ROOT, 'frontend');    // frontend static files
const UPLOADS_DIR = path.join(APP_ROOT, 'uploads');      // uploads folder (photos, etc.)

// Ensure required directories exist at startup (idempotent)
try {
  fs.ensureDirSync(DB_DIR);
  fs.ensureDirSync(UPLOADS_DIR);
  fs.ensureDirSync(FRONTEND_DIR);
} catch (err) {
  // If directory creation fails, throw so server startup fails fast and visible
  // Caller (server.js) can catch and log more context if needed.
  throw new Error(`Failed to ensure required directories: ${err.message}`);
}

module.exports = {
  APP_ROOT,
  DB_DIR,
  DB_FILE,
  FRONTEND_DIR,
  UPLOADS_DIR
};
