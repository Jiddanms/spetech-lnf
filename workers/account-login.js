
import { jsonResponse, hashPassword } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const { username, password } = await req.json();
      if (!username || !password) return jsonResponse({ ok: false, message: 'Username dan password wajib.' }, 400);

      const user = await env.DB.prepare('SELECT id, username, passwordHash, role FROM users WHERE username = ?').bind(username).first();
      if (!user) return jsonResponse({ ok: false, message: 'Username atau password salah.' }, 401);

      const hashed = await hashPassword(password);
      if (hashed !== user.passwordHash) return jsonResponse({ ok: false, message: 'Username atau password salah.' }, 401);

      // create session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const createdAt = new Date().toISOString();

      await env.DB.prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)')
        .bind(token, user.id, createdAt, expiresAt)
        .run();

      return jsonResponse({ ok: true, user: { id: user.id, username: user.username, role: user.role }, token });
    } catch (err) {
      console.error('account-login error', err);
      return jsonResponse({ ok: false, message: 'Server error saat login.' }, 500);
    }
  }
};
