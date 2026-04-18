
/**
 * functions/api/items/lost.js
 * Backend Handler: Pelaporan Barang Hilang
 * UPDATE QoL 6.17: Database Sync (Drop owner_name) & Image Support
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED (Baris Bertambah)
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. GET: Ambil daftar barang hilang
  if (request.method === "GET") {
    try {
      const limit = url.searchParams.get("limit") || 50;
      const items = await env.DB.prepare(
        "SELECT * FROM items WHERE type = 'lost' AND status != 'archived' ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();
      
      return new Response(JSON.stringify(items.results), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Gagal mengambil data" }), { status: 500 });
    }
  }

  // 2. POST: Lapor barang hilang - FIX QoL 6.17
  if (request.method === "POST") {
    try {
      const data = await request.json();
      // QoL 6.17: owner_name dihapus dari ekstraksi karena kolom sudah tidak ada di DB
      const { item_name, description, location_name, reporter_name, image_url } = data;

      // Validasi Field Utama
      if (!item_name || !location_name || !reporter_name) {
        return new Response(JSON.stringify({ error: "Missing required fields (Nama, Lokasi, atau Pelapor)" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Query Insert: Menyesuaikan kolom terbaru (tanpa owner_name, tambah image_url)
      const result = await env.DB.prepare(
        "INSERT INTO items (type, item_name, description, location_name, reporter_name, image_url, status) VALUES ('lost', ?, ?, ?, ?, ?, 'pending')"
      ).bind(item_name, description || "", location_name, reporter_name, image_url || null).run();

      return new Response(JSON.stringify({ success: true, message: "Laporan berhasil dicatat" }), {
        status: 201,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err) {
      // Menangani error koneksi atau database crash
      return new Response(JSON.stringify({ error: "Database Error: " + err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle OPTIONS untuk pre-flight request CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}
