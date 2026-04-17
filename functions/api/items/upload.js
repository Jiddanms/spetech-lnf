
export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
    }

    // Mengubah file menjadi Base64 string agar bisa disimpan di database D1
    // (Solusi cerdas untuk project KTI tanpa perlu setup storage tambahan yang rumit)
    const arrayBuffer = await file.arrayBuffer();
    const base64String = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );
    const dataUrl = `data:${file.type};base64,${base64String}`;

    return new Response(JSON.stringify({ url: dataUrl }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Upload failed: " + e.message }), { status: 500 });
  }
}
