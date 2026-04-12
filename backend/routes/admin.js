
// routes/admin.js (baru, sesuai blueprint C)
const express = require('express');
const router = express.Router();
const itemModel = require('../models/itemModel');
const userModel = require('../models/userModel');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Semua route admin harus lewat middleware admin-only
router.use(requireAuth, requireAdmin);

/**
 * FORM MANAGEMENT
 * - List semua items (lost/found)
 * - Update status item (verified, completed, archived)
 * - Delete item
 */
router.get('/forms', async (req, res) => {
  try {
    const items = await itemModel.listItems({ includeDeleted: false });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /admin/forms error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.patch('/forms/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await itemModel.updateItem(req.params.id, { status });
    if (!updated) return res.json({ ok: false, message: 'Item tidak ditemukan.' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('PATCH /admin/forms/:id/status error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.delete('/forms/:id', async (req, res) => {
  try {
    const deleted = await itemModel.softDeleteItem(req.params.id);
    if (!deleted) return res.json({ ok: false, message: 'Item tidak ditemukan.' });
    return res.json({ ok: true, message: 'Item berhasil dihapus.' });
  } catch (err) {
    console.error('DELETE /admin/forms/:id error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

/**
 * ACCOUNT MANAGEMENT
 * - List akun
 * - Create akun baru
 * - Update role akun
 * - Delete akun
 */
router.get('/accounts', async (req, res) => {
  try {
    const users = await userModel.listUsers();
    return res.json({ ok: true, users });
  } catch (err) {
    console.error('GET /admin/accounts error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await userModel.createUser({ username, password, role });
    return res.json({ ok: true, user });
  } catch (err) {
    console.error('POST /admin/accounts error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.patch('/accounts/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const updated = await userModel.updateUserRole(req.params.id, role);
    if (!updated) return res.json({ ok: false, message: 'User tidak ditemukan.' });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('PATCH /admin/accounts/:id/role error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const success = await userModel.deleteUser(req.params.id);
    if (!success) return res.json({ ok: false, message: 'User tidak ditemukan.' });
    return res.json({ ok: true, message: 'User berhasil dihapus.' });
  } catch (err) {
    console.error('DELETE /admin/accounts/:id error', err);
    return res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;
