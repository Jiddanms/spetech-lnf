
// routes/lost.js
// Express router for "lost" endpoints
// Endpoints:
//  - POST  /lost/add      -> add lost report
//  - GET   /lost/list     -> list lost items
//  - GET   /lost/recent   -> recent lost items (for home quick view)

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// DB file path (shared file-based DB)
const DB_FILE = path.join(__dirname, '..', 'database', 'db.json');

// Helper: read DB
async function readDb() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return { users: [], items: [] };
    return await fs.readJson(DB_FILE);
  } catch (err) {
    console.error('readDb error (lost route)', err);
    return { users: [], items: [] };
  }
}

// Helper: write DB
async function writeDb(data) {
  await fs.ensureFile(DB_FILE);
  await fs.writeJson(DB_FILE, data, { spaces: 2 });
}

/**
 * POST /lost/add
 * Body: { name, description, location, contact }
 */
router.post('/add', async (req, res) => {
  try {
    const { name, description, location, contact } = req.body || {};
    if (!name || !description || !location) {
      return res.status(400).json({ ok: false, message: 'Field wajib: name, description, location.' });
    }

    const db = await readDb();
    const item = {
      id: uuidv4(),
      name: String(name).trim(),
      description: String(description).trim(),
      location: String(location).trim(),
      contact: contact ? String(contact).trim() : '',
      photo: null,
      type: 'lost',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Prepend to keep newest first
    db.items = db.items || [];
    db.items.unshift(item);
    await writeDb(db);

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('POST /lost/add error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat menambah laporan kehilangan.' });
  }
});

/**
 * GET /lost/list
 * Returns all lost items except those marked deleted
 */
router.get('/list', async (req, res) => {
  try {
    const db = await readDb();
    const items = (db.items || []).filter(i => i.type === 'lost' && i.status !== 'deleted');
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /lost/list error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat mengambil daftar kehilangan.' });
  }
});

/**
 * GET /lost/recent
 * Returns a short list for home (limit 8)
 */
router.get('/recent', async (req, res) => {
  try {
    const db = await readDb();
    const items = (db.items || [])
      .filter(i => i.type === 'lost' && i.status !== 'deleted')
      .slice(0, 8);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /lost/recent error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat mengambil data recent.' });
  }
});

module.exports = router;
