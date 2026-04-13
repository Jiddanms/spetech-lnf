
import { jsonResponse, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const user = await requireAuthFromEnv(req, env);
      if (!user) return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      if (user.role !== 'admin') return jsonResponse({ ok: false, message: 'Admin only' }, 403);

      const url = new URL(req.url);
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');

      let sql = 'SELECT * FROM items WHERE status != ?';
      const binds = ['deleted'];
      if (type) { sql += ' AND type = ?'; binds.push(type); }
      if (status) { sql += ' AND status = ?'; binds.push(status); }
      sql += ' ORDER BY createdAt DESC';

      const rows = await env.DB.prepare(sql).bind(...binds).all();
      return jsonResponse({ ok: true, items: rows.results || [] });
    } catch (err) {
      console.error('admin-forms error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
