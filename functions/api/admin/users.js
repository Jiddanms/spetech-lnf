
/**
 * functions/api/admin/users.js
 * Backend Handler: User Management Admin
 * UPDATE QoL 6.16: Fix Delete User Bug & Self-Deletion Protection
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED
 */

export async function onRequest(context) {
  const { request, env } = context;

  // GET: Daftar semua user
  if (request.method === "GET") {
    const users = await env.DB.prepare("SELECT id, username, role, created_at FROM users").all();
    return new Response(JSON.stringify(users.results), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
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

  // DELETE: Menghapus akun user - FIX QoL 6.16
  if (request.method === "DELETE") {
    const { id } = await request.json();
    
    try {
      // Proteksi Tambahan: Pastikan ID valid
      if (!id) throw new Error("ID tidak ditemukan");

      // Logic Original: Proteksi admin tidak hapus diri sendiri (diperkuat)
      const currentUser = context.data?.user;
      if (currentUser && currentUser.id === parseInt(id)) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400 });
      }

      // Eksekusi Hapus
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(parseInt(id)).run();
      
      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // Handle OPTIONS for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
