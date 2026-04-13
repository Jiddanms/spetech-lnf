
// Optional helper module. If you prefer self-contained files, ignore this and copy helpers into each file.
// This file shows helper functions used across workers: json response, uuid, hashPassword, auth helpers.
export async function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function uuidv4() {
  // simple UUID v4 using crypto API
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

export async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function requireAuthFromEnv(req, env) {
  const auth = req.headers.get('authorization') || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  const sessionRow = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!sessionRow) return null;
  if (new Date(sessionRow.expiresAt) < new Date()) return null;
  const userRow = await env.DB.prepare('SELECT id, username, role FROM users WHERE id = ?').bind(sessionRow.userId).first();
  if (!userRow) return null;
  return { id: userRow.id, username: userRow.username, role: userRow.role, token };
}
