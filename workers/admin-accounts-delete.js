
import { jsonResponse, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'DELETE') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const user = await requireAuthFromEnv(req, env);
      if (!user) return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      if (user.role !== 'admin') return jsonResponse({ ok: false, message: 'Admin only' }, 403);

      const url = new URL(req.url);
      const id = url.pathname.split('/').slice(-1)[0];
      if (id === user.id) return jsonResponse({ ok: false, message: 'Tidak dapat menghapus akun sendiri.' }, 400);

      const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
      if (!row) return jsonResponse({ ok: false, message: 'User tidak ditemukan.' }, 404);

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE userId = ?').bind(id).run();

      return jsonResponse({ ok: true, message: 'User dihapus.' });
    } catch (err) {
      console.error('admin-accounts-delete error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
