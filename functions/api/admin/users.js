
export async function onRequest(context) {
  const { request, env } = context;

  // GET: Daftar semua user
  if (request.method === "GET") {
    const users = await env.DB.prepare("SELECT id, username, role, created_at FROM users").all();
    return new Response(JSON.stringify(users.results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POST: Admin membuat akun baru (Admin/User)
  if (request.method === "POST") {
    const { username, password, role } = await request.json();
    try {
      await env.DB.prepare(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
      ).bind(username, password, role).run();
      
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
      return new Response(JSON.stringify({ error: "User already exists" }), { status: 400 });
    }
  }

  // DELETE: Menghapus akun user
  if (request.method === "DELETE") {
    const { id } = await request.json();
    // Proteksi: Admin tidak bisa hapus dirinya sendiri lewat API ini
    const currentUser = context.data.user;
    if (currentUser.id === id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400 });
    }

    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
