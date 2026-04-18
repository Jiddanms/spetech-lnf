
/**
 * functions/api/items/found.js
 * Backend Handler: Pelaporan Barang Ditemukan (Found)
 * UPDATE QoL 6.17 - 6.19: Fix Connection Error & Payload Sync
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED (530+ Lines Context Sync)
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. GET: Ambil daftar barang yang ditemukan
  if (request.method === "GET") {
    try {
      const limit = url.searchParams.get("limit") || 50;
      const items = await env.DB.prepare(
        "SELECT * FROM items WHERE type = 'found' AND status != 'archived' ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();
      
      return new Response(JSON.stringify(items.results), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Gagal mengambil data penemuan" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // 2. POST: Lapor penemuan barang - FIX QoL 6.19 (Anti-Connection Error)
  if (request.method === "POST") {
    try {
      const data = await request.json();
      const { item_name, description, location_name, reporter_name, image_url } = data;

      // Validasi Field Utama sesuai kebutuhan Frontend
      if (!item_name || !location_name || !reporter_name) {
        return new Response(JSON.stringify({ error: "Nama barang, lokasi, dan penemu wajib diisi" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // FIX: Query disesuaikan dengan skema tabel items terbaru (Tanpa owner_name)
      // Bind data secara berurutan agar masuk ke database D1 tanpa flaw
      await env.DB.prepare(
        "INSERT INTO items (type, item_name, description, location_name, reporter_name, image_url, status) VALUES ('found', ?, ?, ?, ?, ?, 'pending')"
      ).bind(
        item_name, 
        description || "", 
        location_name, 
        reporter_name, 
        image_url || null
      ).run();

      return new Response(JSON.stringify({ success: true, message: "Laporan penemuan berhasil disimpan" }), {
        status: 201,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err) {
      // Menangani error jika database gagal merespon (Penyebab utama 'Kesalahan Koneksi')
      return new Response(JSON.stringify({ error: "Database Error: " + err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle OPTIONS request untuk pre-flight CORS (Sangat Penting agar tidak blocked)
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

  return new Response(JSON.stringify({ error: "Method not allowed" }), { 
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
