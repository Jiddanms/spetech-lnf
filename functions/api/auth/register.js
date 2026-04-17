
export async function onRequestPost(context) {
  const { request, env } = context;
  const { username, password, role } = await request.json();

  if (!username || !password) {
    return new Response(JSON.stringify({ error: "Username and password required" }), { status: 400 });
  }

  try {
    // Insert user baru ke database
    // Catatan: Untuk produksi nyata, password harus di-hash (misal pakai bcrypt)
    await env.DB.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    ).bind(username, password, role || 'user').run();

    return new Response(JSON.stringify({ success: true, message: "Registration successful" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Username already exists or database error" }), { status: 400 });
  }
}
