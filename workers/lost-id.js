
import { jsonResponse } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      const row = await env.DB.prepare('SELECT * FROM items WHERE id = ? AND type = ? AND status != ?').bind(id, 'lost', 'deleted').first();
      if (!row) return jsonResponse({ ok: false, message: 'Item tidak ditemukan.' }, 404);
      return jsonResponse({ ok: true, item: row });
    } catch (err) {
      console.error('lost-id error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
