
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Ambil token dari header Authorization (Bearer token)
  const authHeader = request.headers.get("Authorization");
  const token = authHeader ? authHeader.split(" ")[1] : null;

  let user = null;

  if (token) {
    // Cek apakah session ada di database dan belum expired
    const session = await env.DB.prepare(
      "SELECT s.*, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > DATETIME('now')"
    ).bind(token).first();

    if (session) {
      user = { id: session.user_id, username: session.username, role: session.role };
      // Simpan data user ke dalam context agar bisa dipakai file API lain
      context.data.user = user;
    }
  }

  // PROTEKSI: Jika mencoba akses API admin tapi bukan admin
  if (url.pathname.startsWith("/api/admin")) {
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Unauthorized: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return next();
}
