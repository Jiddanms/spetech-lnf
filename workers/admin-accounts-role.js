
import { jsonResponse, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'PATCH') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const user = await requireAuthFromEnv(req, env);
      if (!user) return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      if (user.role !== 'admin') return jsonResponse({ ok: false, message: 'Admin only' }, 403);

      const url = new URL(req.url);
      const id = url.pathname.split('/').slice(-2)[0]; // /accounts/:id/role
      const { role } = await req.json();
      if (!role || !['user', 'admin'].includes(role)) return jsonResponse({ ok: false, message: 'Role tidak valid.' }, 400);

      const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      if (!row) return jsonResponse({ ok: false, message: 'User tidak ditemukan.' }, 404);

      if (row.id === user.id && row.role === 'admin' && role !== 'admin') {
        return jsonResponse({ ok: false, message: 'Tidak dapat mengubah role akun sendiri.' }, 400);
      }

      const updatedAt = new Date().toISOString();
      await env.DB.prepare('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?').bind(role, updatedAt, id).run();
      const updated = await env.DB.prepare('SELECT id, username, role FROM users WHERE id = ?').bind(id).first();
      return jsonResponse({ ok: true, user: updated });
    } catch (err) {
      console.error('admin-accounts-role error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
