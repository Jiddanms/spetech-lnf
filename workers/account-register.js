
import { jsonResponse, uuidv4, hashPassword } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const body = await req.json();
      const { username, password, role = 'user' } = body;
      if (!username || !password) return jsonResponse({ ok: false, message: 'Username dan password wajib.' }, 400);

      // check existing
      const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (exists) return jsonResponse({ ok: false, message: 'Username sudah ada.' }, 400);

      const id = uuidv4();
      const hashed = await hashPassword(password);
      const createdAt = new Date().toISOString();

      await env.DB.prepare('INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)')
        .bind(id, username, hashed, role, createdAt)
        .run();

      return jsonResponse({ ok: true, message: 'Registrasi berhasil.', user: { id, username, role, createdAt } });
    } catch (err) {
      console.error('account-register error', err);
      return jsonResponse({ ok: false, message: 'Server error saat registrasi.' }, 500);
    }
  }
};
