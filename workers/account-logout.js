
import { jsonResponse, requireAuthFromEnv } from './_helpers.js';

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    try {
      const auth = req.headers.get('authorization') || '';
      const parts = auth.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
      const token = parts[1];

      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      return jsonResponse({ ok: true, message: 'Logged out' });
    } catch (err) {
      console.error('account-logout error', err);
      return jsonResponse({ ok: false, message: 'Server error.' }, 500);
    }
  }
};
