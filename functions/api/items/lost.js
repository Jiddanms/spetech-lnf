
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET: Ambil daftar barang hilang
  if (request.method === "GET") {
    const limit = url.searchParams.get("limit") || 50;
    const items = await env.DB.prepare(
      "SELECT * FROM items WHERE type = 'lost' AND status != 'archived' ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    
    return new Response(JSON.stringify(items.results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POST: Lapor barang hilang
  if (request.method === "POST") {
    const data = await request.json();
    const { item_name, description, location_name, reporter_name, owner_name } = data;

    if (!item_name || !location_name || !reporter_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const result = await env.DB.prepare(
      "INSERT INTO items (type, item_name, description, location_name, reporter_name, owner_name, status) VALUES ('lost', ?, ?, ?, ?, ?, 'pending')"
    ).bind(item_name, description, location_name, reporter_name, owner_name).run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
