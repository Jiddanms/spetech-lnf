
export async function onRequestPost(context) {
  const { request, env } = context;
  const { username, password } = await request.json();

  const user = await env.DB.prepare(
    "SELECT * FROM users WHERE username = ? AND password = ?"
  ).bind(username, password).first();

  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401 });
  }

  // Buat session ID (UUID sederhana)
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Session berlaku 7 hari

  // Simpan ke tabel sessions
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(sessionId, user.id, expiresAt.toISOString()).run();

  return new Response(JSON.stringify({
    success: true,
    token: sessionId,
    user: { username: user.username, role: user.role }
  }), { headers: { "Content-Type": "application/json" } });
}
