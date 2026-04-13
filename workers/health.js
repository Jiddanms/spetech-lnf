
import { jsonResponse } from './_helpers.js';

export default {
  async fetch(req) {
    if (req.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
    return jsonResponse({ ok: true, uptime: Math.floor(performance.now() / 1000) });
  }
};
