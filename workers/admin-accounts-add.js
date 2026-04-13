
import { jsonResponse, uuidv4, hashPassword, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const user = await requireAuthFromEnv(req, env);
      if (!user) return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      if (user.role !== 'admin') return jsonResponse({ ok: false, message: 'Admin only' }, 403);

      const { username, password, role = 'user' } = await req.json();
      if (!username || !password) return jsonResponse({ ok: false, message: 'Username & password wajib.' }, 400);

      const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (exists) return jsonResponse({ ok: false, message: 'Username sudah ada.' }, 400);

      const id = uuidv4();
      const hashed = await hashPassword(password);
      const createdAt = new Date().toISOString();

      await env.DB.prepare('INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)')
        .bind(id, username, hashed, role, createdAt)
        .run();

      return jsonResponse({ ok: true, user: { id, username, role } });
    } catch (err) {
      console.error('admin-accounts-add error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
