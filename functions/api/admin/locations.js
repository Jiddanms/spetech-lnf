
/**
 * functions/api/admin/locations.js
 * Backend Handler untuk Manajemen Lokasi - Spetech Lost and Found
 * Menangani: GET (List), POST (Add), DELETE (Remove)
 * UPDATE QoL 6.16: Fix Delete Bug & ID Parsing
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

  // 2. POST: Tambah lokasi baru (Contoh: 'Gedung D', 'Lab Komputer')
  if (request.method === "POST") {
    try {
      const { name, description } = await request.json();
      
      if (!name) {
        return new Response(JSON.stringify({ error: "Nama lokasi wajib diisi" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Payload QR otomatis mengikuti format pendeteksian di main.js
      const qrPayload = `?lokasi=${encodeURIComponent(name)}`;

      await env.DB.prepare(
        "INSERT INTO locations (name, description, qr_code_payload) VALUES (?, ?, ?)"
      ).bind(name, description || "", qrPayload).run();
      
      return new Response(JSON.stringify({ success: true, message: "Lokasi berhasil ditambahkan" }), { 
        status: 201,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e) {
      // Menangani kasus jika lokasi dengan nama yang sama sudah terdaftar (Unique Constraint)
      return new Response(JSON.stringify({ error: "Nama lokasi sudah ada di database" }), { 
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

  return new Response(JSON.stringify({ error: "Method not allowed" }), { 
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
