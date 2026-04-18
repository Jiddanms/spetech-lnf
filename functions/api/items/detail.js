
/**
 * functions/api/items/detail.js
 * Backend Handler: Ambil Detail Barang Spesifik
 * Deskripsi: Mengambil data lengkap satu item berdasarkan ID dari D1 Database.
 * UPDATE QoL 6.16: Dedicated Detail Fetcher (Flawless Integration)
 */

export async function onRequest(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Validasi Parameter ID
  if (!id) {
    return new Response(JSON.stringify({ error: "ID barang diperlukan" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Query D1: Ambil detail barang berdasarkan ID
    // Menggunakan parameter binding (?) untuk keamanan dari SQL Injection
    const item = await env.DB.prepare(`
      SELECT * FROM items 
      WHERE id = ? 
      LIMIT 1
    `).bind(parseInt(id)).first();

    // Jika barang tidak ditemukan
    if (!item) {
      return new Response(JSON.stringify({ error: "Barang tidak ditemukan" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Berhasil menemukan data, kirim kembali ke frontend
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (error) {
    // Error Handling jika database bermasalah
    return new Response(JSON.stringify({ 
      error: "Gagal mengambil data dari database",
      details: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Handle OPTIONS request untuk CORS (Cross-Origin Resource Sharing)
 * Memastikan frontend bisa berkomunikasi dengan backend tanpa hambatan.
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
