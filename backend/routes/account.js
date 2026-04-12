
// routes/account.js
// Express router for account endpoints (register, login, logout)
// Endpoints:
//  - POST /account/register   -> { username, password, role }
//  - POST /account/login      -> { username, password }
//  - POST /account/logout     -> (optional, prototype-friendly)
//
// Note: This implementation uses the same file-based DB (database/db.json).
// For production, replace with proper DB and session/auth mechanism.

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const APP_ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(APP_ROOT, 'database', 'db.json');
const SALT_ROUNDS = 10;

// Helpers
async function readDb() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return { users: [], items: [] };
    return await fs.readJson(DB_FILE);
  } catch (err) {
    console.error('readDb error (account route)', err);
    return { users: [], items: [] };
  }
}
async function writeDb(data) {
  await fs.ensureFile(DB_FILE);
  await fs.writeJson(DB_FILE, data, { spaces: 2 });
}

/**
 * POST /account/register
 * Body: { username, password, role }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Username dan password wajib.' });
    }

    const db = await readDb();
    db.users = db.users || [];

    const exists = db.users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
    if (exists) return res.json({ ok: false, message: 'Username sudah terdaftar.' });

    const hashed = await bcrypt.hash(String(password), SALT_ROUNDS);
    const user = {
      id: uuidv4(),
      username: String(username).trim(),
      password: hashed,
      role: String(role).trim(),
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    await writeDb(db);

    return res.json({ ok: true, message: 'Registrasi berhasil.' });
  } catch (err) {
    console.error('POST /account/register error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat registrasi.' });
  }
});

/**
 * POST /account/login
 * Body: { username, password }
 * Returns: { ok: true, user: { id, username, role } } on success
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Username dan password wajib.' });
    }

    const db = await readDb();
    const user = (db.users || []).find(u => u.username.toLowerCase() === String(username).toLowerCase());
    if (!user) return res.json({ ok: false, message: 'User tidak ditemukan.' });

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) return res.json({ ok: false, message: 'Password salah.' });

    // Return safe user object (no password)
    const safeUser = { id: user.id, username: user.username, role: user.role };
    return res.json({ ok: true, user: safeUser });
  } catch (err) {
    console.error('POST /account/login error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat login.' });
  }
});

/**
 * POST /account/logout
 * Prototype-friendly endpoint: simply returns ok.
 * In production, this should clear session/JWT on server or instruct client to remove token.
 */
router.post('/logout', async (req, res) => {
  try {
    return res.json({ ok: true, message: 'Logout berhasil.' });
  } catch (err) {
    console.error('POST /account/logout error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat logout.' });
  }
});

module.exports = router;
