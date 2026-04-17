
export async function onRequestGet(context) {
  const { env, params } = context;
  const itemId = params.id;

  if (!itemId) {
    return new Response(JSON.stringify({ error: "Item ID is required" }), { status: 400 });
  }

  const item = await env.DB.prepare(
    "SELECT * FROM items WHERE id = ?"
  ).bind(itemId).first();

  if (!item) {
    return new Response(JSON.stringify({ error: "Barang tidak ditemukan" }), { status: 404 });
  }

  return new Response(JSON.stringify(item), {
    headers: { "Content-Type": "application/json" }
  });
}
