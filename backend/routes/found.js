
// routes/found.js
// Express router for "found" endpoints
// Endpoints:
//  - POST  /found/add      -> add found report (multipart/form-data, photo optional)
//  - GET   /found/list     -> list found items
//  - GET   /found/recent   -> recent found items (for home quick view)

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Paths (consistent with server.js layout)
const APP_ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(APP_ROOT, 'database', 'db.json');
const UPLOADS_DIR = path.join(APP_ROOT, 'uploads');

// Ensure uploads dir exists
fs.ensureDirSync(UPLOADS_DIR);

// Multer setup for file uploads (same limits as server.js)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Helper: read DB
async function readDb() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return { users: [], items: [] };
    return await fs.readJson(DB_FILE);
  } catch (err) {
    console.error('readDb error (found route)', err);
    return { users: [], items: [] };
  }
}

// Helper: write DB
async function writeDb(data) {
  await fs.ensureFile(DB_FILE);
  await fs.writeJson(DB_FILE, data, { spaces: 2 });
}

/**
 * POST /found/add
 * multipart/form-data: fields { name, description, location } and optional file 'photo'
 */
router.post('/add', upload.single('photo'), async (req, res) => {
  try {
    const { name, description, location } = req.body || {};
    if (!name || !description || !location) {
      // Clean up uploaded file if present
      if (req.file && req.file.path) await fs.remove(req.file.path).catch(()=>{});
      return res.status(400).json({ ok: false, message: 'Field wajib: name, description, location.' });
    }

    const db = await readDb();
    const photoPath = req.file ? `/uploads/${path.basename(req.file.path)}` : null;

    const item = {
      id: uuidv4(),
      name: String(name).trim(),
      description: String(description).trim(),
      location: String(location).trim(),
      contact: '',
      photo: photoPath,
      type: 'found',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.items = db.items || [];
    db.items.unshift(item);
    await writeDb(db);

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('POST /found/add error', err);
    // attempt to remove uploaded file on error
    if (req.file && req.file.path) await fs.remove(req.file.path).catch(()=>{});
    return res.status(500).json({ ok: false, message: 'Server error saat menambah laporan penemuan.' });
  }
});

/**
 * GET /found/list
 * Returns all found items except those marked deleted
 */
router.get('/list', async (req, res) => {
  try {
    const db = await readDb();
    const items = (db.items || []).filter(i => i.type === 'found' && i.status !== 'deleted');
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /found/list error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat mengambil daftar penemuan.' });
  }
});

/**
 * GET /found/recent
 * Returns a short list for home (limit 8)
 */
router.get('/recent', async (req, res) => {
  try {
    const db = await readDb();
    const items = (db.items || [])
      .filter(i => i.type === 'found' && i.status !== 'deleted')
      .slice(0, 8);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /found/recent error', err);
    return res.status(500).json({ ok: false, message: 'Server error saat mengambil data recent.' });
  }
});

module.exports = router;
