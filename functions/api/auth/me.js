
export async function onRequestGet(context) {
  const user = context.data.user;

  if (!user) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({
    loggedIn: true,
    user: user
  }), { headers: { "Content-Type": "application/json" } });
}
