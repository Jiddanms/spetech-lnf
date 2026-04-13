
import { jsonResponse, uuidv4 } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const body = await req.json();
      const { name, description, location, photo } = body;
      if (!name || !description || !location) return jsonResponse({ ok: false, message: 'Field wajib belum lengkap.' }, 400);

      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const status = 'pending';

      await env.DB.prepare('INSERT INTO items (id, name, description, location, contact, photo, type, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, name, description, location, null, photo || null, 'found', status, createdAt, createdAt)
        .run();

      const item = { id, name, description, location, contact: null, photo: photo || null, type: 'found', status, createdAt, updatedAt: createdAt };
      return jsonResponse({ ok: true, item });
    } catch (err) {
      console.error('found-add error', err);
      return jsonResponse({ ok: false, message: 'Server error saat menambah laporan penemuan.' }, 500);
    }
  }
};
