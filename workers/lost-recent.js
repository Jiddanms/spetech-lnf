
import { jsonResponse } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const rows = await env.DB.prepare('SELECT * FROM items WHERE type = ? AND status != ? ORDER BY createdAt DESC LIMIT 8').bind('lost', 'deleted').all();
      return jsonResponse({ ok: true, items: rows.results || [] });
    } catch (err) {
      console.error('lost-recent error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
