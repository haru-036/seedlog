import { Hono } from "hono";

const authRoute = new Hono<{ Bindings: CloudflareBindings }>();

const DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

authRoute.get("/discord", (c) => {
  const params = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    redirect_uri: c.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify"
  });
  return c.redirect(`${DISCORD_OAUTH_URL}?${params}`);
});

authRoute.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: { code: "BAD_REQUEST", message: "codeがありません" } }, 400);
  }

  const tokenRes = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.env.DISCORD_CLIENT_ID,
      client_secret: c.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: c.env.DISCORD_REDIRECT_URI
    })
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Discord token exchange error:", text);
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=token_exchange`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!userRes.ok) {
    const text = await userRes.text();
    console.error("Discord user fetch error:", text);
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=user_fetch`);
  }

  const discordUser = (await userRes.json()) as { id: string; username: string; global_name?: string };

  const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/discord/callback`);
  redirectUrl.searchParams.set("discordId", discordUser.id);
  redirectUrl.searchParams.set("discordUsername", discordUser.global_name ?? discordUser.username);
  return c.redirect(redirectUrl.toString());
});

export { authRoute };
