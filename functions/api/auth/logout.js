
export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  const token = authHeader ? authHeader.split(" ")[1] : null;

  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
  }

  return new Response(JSON.stringify({ success: true, message: "Logged out" }), {
    headers: { "Content-Type": "application/json" }
  });
}
