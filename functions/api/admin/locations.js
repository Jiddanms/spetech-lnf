
/**
 * functions/api/admin/locations.js
 * Backend Handler untuk Manajemen Lokasi - Spetech Lost and Found
 * Menangani: GET (List), POST (Add), DELETE (Remove)
 * UPDATE QoL 6.16: Fix Delete Bug & ID Parsing
 * UPDATE QoL 6.18: Total Location Sync & Auto QR Generator
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED (140+ Lines)
 */

export async function onRequest(context) {
  const { request, env } = context;

  // 1. GET: Ambil daftar lokasi untuk dashboard management & dropdown
  if (request.method === "GET") {
    try {
      const locations = await env.DB.prepare("SELECT * FROM locations ORDER BY name ASC").all();
      return new Response(JSON.stringify(locations.results), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Gagal mengambil data lokasi" }), { status: 500 });
    }
  }

  // 2. POST: Tambah lokasi baru - UPDATE QoL 6.18 (Support Gambar & Auto QR)
  if (request.method === "POST") {
    try {
      const { name, description, image_url } = await request.json();
      
      if (!name) {
        return new Response(JSON.stringify({ error: "Nama lokasi wajib diisi" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Step A: Insert data dasar terlebih dahulu untuk mendapatkan ID
      const info = await env.DB.prepare(
        "INSERT INTO locations (name, description, image_url) VALUES (?, ?, ?)"
      ).bind(name, description || "", image_url || null).run();

      const lastId = info.meta.last_row_id;

      // Step B: Generate QR Payload & QR Image URL secara otomatis
      const qrPayload = `?lokasi=${lastId}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

      // Step C: Update baris tadi dengan QR info yang sudah digenerate
      await env.DB.prepare(
        "UPDATE locations SET qr_code_payload = ?, qr_image_url = ? WHERE id = ?"
      ).bind(qrPayload, qrImageUrl, lastId).run();
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Lokasi & QR berhasil dibuat",
        id: lastId 
      }), { 
        status: 201,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Gagal menambah lokasi: " + e.message }), { 
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }

  // 3. DELETE: Hapus lokasi berdasarkan ID - FIX QoL 6.16
  if (request.method === "DELETE") {
    try {
      const { id } = await request.json();
      
      if (!id) {
        return new Response(JSON.stringify({ error: "ID lokasi diperlukan untuk menghapus" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // FIX: Menggunakan parseInt untuk memastikan ID adalah number agar sinkron dengan D1
      await env.DB.prepare("DELETE FROM locations WHERE id = ?").bind(parseInt(id)).run();
      
      return new Response(JSON.stringify({ success: true, message: "Lokasi berhasil dihapus" }), { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Gagal menghapus lokasi" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle OPTIONS request untuk CORS (Pre-flight request)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  // 4. Fallback: Method not allowed
  return new Response(JSON.stringify({ error: "Method not allowed" }), { 
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
