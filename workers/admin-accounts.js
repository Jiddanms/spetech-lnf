
import { jsonResponse, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const user = await requireAuthFromEnv(req, env);
      if (!user) return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      if (user.role !== 'admin') return jsonResponse({ ok: false, message: 'Admin only' }, 403);

      const rows = await env.DB.prepare('SELECT id, username, role, createdAt FROM users ORDER BY createdAt DESC').all();
      return jsonResponse({ ok: true, users: rows.results || [] });
    } catch (err) {
      console.error('admin-accounts error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
