
export async function onRequest(context) {
  const { request, env } = context;

  // GET: Ambil daftar lokasi untuk dashboard management
  if (request.method === "GET") {
    const locations = await env.DB.prepare("SELECT * FROM locations ORDER BY name ASC").all();
    return new Response(JSON.stringify(locations.results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POST: Tambah lokasi baru (misal: 'Lab Fisika')
  if (request.method === "POST") {
    const { name, description } = await request.json();
    const qrPayload = `lokasi=${encodeURIComponent(name)}`;

    try {
      await env.DB.prepare(
        "INSERT INTO locations (name, description, qr_code_payload) VALUES (?, ?, ?)"
      ).bind(name, description, qrPayload).run();
      
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Location already exists" }), { status: 400 });
    }
  }

  // DELETE: Hapus lokasi
  if (request.method === "DELETE") {
    const { id } = await request.json();
    await env.DB.prepare("DELETE FROM locations WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
