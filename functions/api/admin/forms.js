
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET: Mengambil semua form (Lost & Found) untuk dashboard admin
  if (request.method === "GET") {
    const type = url.searchParams.get("type"); // filter 'lost' atau 'found'
    let query = "SELECT * FROM items ORDER BY created_at DESC";
    let params = [];

    if (type) {
      query = "SELECT * FROM items WHERE type = ? ORDER BY created_at DESC";
      params = [type];
    }

    const items = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify(items.results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // PATCH: Update status barang (misal: 'verified', 'completed', 'archived')
  if (request.method === "PATCH") {
    const { id, status } = await request.json();
    
    if (!id || !status) {
      return new Response(JSON.stringify({ error: "ID and Status required" }), { status: 400 });
    }

    await env.DB.prepare(
      "UPDATE items SET status = ?, updated_at = DATETIME('now') WHERE id = ?"
    ).bind(status, id).run();

    return new Response(JSON.stringify({ success: true, message: "Status updated" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // DELETE: Menghapus laporan secara permanen
  if (request.method === "DELETE") {
    const { id } = await request.json();
    await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
    
    return new Response(JSON.stringify({ success: true, message: "Form deleted" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
