
/**
 * functions/api/locations/list.js
 * Backend Handler: Public Location List
 * Deskripsi: Mengambil seluruh daftar lokasi dari database D1 untuk tampilan publik.
 * UPDATE QoL 6.18: Total Location Sync (Image & QR Support)
 * PRINSIP: NO DELETION - ALL ORIGINAL LOGIC PRESERVED
 */

export async function onRequest(context) {
  const { env } = context;

  try {
    // Query D1: Ambil semua kolom dari tabel locations
    // Mengurutkan berdasarkan nama secara alfabetis agar rapi di UI
    const locations = await env.DB.prepare(
      "SELECT id, name, description, image_url, qr_image_url, qr_code_payload, created_at FROM locations ORDER BY name ASC"
    ).all();

    // Berhasil mengambil data, kirim kembali ke frontend dengan header CORS
    return new Response(JSON.stringify(locations.results), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });

  } catch (error) {
    // Error Handling jika database bermasalah atau tabel belum siap
    return new Response(JSON.stringify({ 
      error: "Gagal mengambil daftar lokasi publik",
      details: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Handle OPTIONS request untuk CORS (Pre-flight)
 * Memastikan browser mengizinkan akses GET dari origin manapun.
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
