
import { jsonResponse } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const rows = await env.DB.prepare('SELECT id, username, role, createdAt FROM users ORDER BY createdAt DESC').all();
      return jsonResponse({ ok: true, users: rows.results || [] });
    } catch (err) {
      console.error('accounts error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
