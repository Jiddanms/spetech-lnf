
import { jsonResponse, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'DELETE') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const user = await requireAuthFromEnv(req, env);
      if (!user) return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      if (user.role !== 'admin') return jsonResponse({ ok: false, message: 'Admin only' }, 403);

      const url = new URL(req.url);
      const id = url.pathname.split('/').slice(-1)[0]; // /forms/:id
      const row = await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
      if (!row) return jsonResponse({ ok: false, message: 'Item tidak ditemukan.' }, 404);

      const updatedAt = new Date().toISOString();
      await env.DB.prepare('UPDATE items SET status = ?, updatedAt = ? WHERE id = ?').bind('deleted', updatedAt, id).run();
      return jsonResponse({ ok: true, message: 'Item dihapus.' });
    } catch (err) {
      console.error('admin-forms-delete error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
