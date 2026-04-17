
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET: Ambil daftar barang yang ditemukan
  if (request.method === "GET") {
    const limit = url.searchParams.get("limit") || 50;
    const items = await env.DB.prepare(
      "SELECT * FROM items WHERE type = 'found' AND status != 'archived' ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    
    return new Response(JSON.stringify(items.results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POST: Lapor penemuan barang (Integrasi QR & Image)
  if (request.method === "POST") {
    const data = await request.json();
    const { item_name, description, location_name, reporter_name, image_url } = data;

    // Logika QR: Jika location_name kosong tapi ada data parameter di frontend, 
    // pastikan backend memvalidasi data tersebut tidak null.
    if (!item_name || !location_name || !reporter_name) {
      return new Response(JSON.stringify({ error: "Nama barang, lokasi, dan penemu wajib diisi" }), { status: 400 });
    }

    const result = await env.DB.prepare(
      "INSERT INTO items (type, item_name, description, location_name, reporter_name, image_url, status) VALUES ('found', ?, ?, ?, ?, ?, 'pending')"
    ).bind(item_name, description, location_name, reporter_name, image_url || null).run();

    return new Response(JSON.stringify({ success: true, message: "Laporan penemuan berhasil disimpan" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
