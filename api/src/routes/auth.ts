import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { discordCallbackQuerySchema, githubCallbackQuerySchema } from "@seedlog/schema";
import { oauthCodes, users } from "../db/schema";

const authRoute = new Hono<{ Bindings: CloudflareBindings }>();

const DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

authRoute.get("/discord", (c) => {
  const state = generateState();
  setCookie(c, "discord_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 300,
    path: "/"
  });
  const params = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    redirect_uri: c.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify bot",
    permissions: "2048",
    state
  });
  return c.redirect(`${DISCORD_OAUTH_URL}?${params}`);
});

authRoute.get(
  "/discord/callback",
  zValidator("query", discordCallbackQuerySchema),
  async (c) => {
    const { code, error } = c.req.valid("query");
    const frontendError = (reason: string) =>
      c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=${reason}`);

    if (error === "access_denied") return frontendError("access_denied");
    if (error || !code) return frontendError("oauth_error");

    // CSRF: validate state
    const storedState = getCookie(c, "discord_oauth_state");
    const returnedState = c.req.query("state");
    deleteCookie(c, "discord_oauth_state", { path: "/" });

    if (!storedState || !returnedState || storedState !== returnedState) {
      return frontendError("state_mismatch");
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
      console.error("Discord token exchange error:", await tokenRes.text());
      return frontendError("token_exchange");
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      console.error("Discord user fetch error:", await userRes.text());
      return frontendError("user_fetch");
    }

    const discordUser = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string;
    };

    const db = drizzle(c.env.DB);
    const onetimeCode = nanoid();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分

    // 期限切れコードを掃除してから新規追加
    await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()));
    await db.insert(oauthCodes).values({
      code: onetimeCode,
      discordId: discordUser.id,
      discordUsername: discordUser.global_name ?? discordUser.username,
      expiresAt
    });

    const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/discord/callback`);
    redirectUrl.searchParams.set("code", onetimeCode);
    return c.redirect(redirectUrl.toString());
  }
);

// フロントが one-time code を Discord ユーザーデータと交換するエンドポイント
authRoute.get("/discord/token", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: { code: "BAD_REQUEST", message: "codeがありません" } }, 400);
  }

  const db = drizzle(c.env.DB);
  const [row] = await db
    .select()
    .from(oauthCodes)
    .where(eq(oauthCodes.code, code))
    .limit(1)
    .all();

  if (!row) {
    return c.json({ error: { code: "NOT_FOUND", message: "コードが見つかりません" } }, 404);
  }

  if (row.expiresAt < new Date()) {
    await db.delete(oauthCodes).where(eq(oauthCodes.code, code));
    return c.json({ error: { code: "GONE", message: "コードの有効期限が切れています" } }, 410);
  }

  // 単一使用：取得後即削除
  await db.delete(oauthCodes).where(eq(oauthCodes.code, code));
  return c.json({ discordId: row.discordId, discordUsername: row.discordUsername });
});

// ---- GitHub OAuth ----

const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

authRoute.get("/github", (c) => {
  const state = generateState();
  setCookie(c, "github_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 300,
    path: "/"
  });
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: c.env.GITHUB_REDIRECT_URI,
    scope: "admin:repo_hook read:user",
    state
  });
  return c.redirect(`${GITHUB_OAUTH_URL}?${params}`);
});

authRoute.get(
  "/github/callback",
  zValidator("query", githubCallbackQuerySchema),
  async (c) => {
    const { code, error } = c.req.valid("query");
    const frontendError = (reason: string) =>
      c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=${reason}`);

    if (error || !code) return frontendError("oauth_error");

    // CSRF: validate state
    const storedState = getCookie(c, "github_oauth_state");
    const returnedState = c.req.query("state");
    deleteCookie(c, "github_oauth_state", { path: "/" });

    if (!storedState || !returnedState || storedState !== returnedState) {
      return frontendError("state_mismatch");
    }

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: c.env.GITHUB_REDIRECT_URI
      })
    });

    if (!tokenRes.ok) {
      console.error("GitHub token exchange error:", await tokenRes.text());
      return frontendError("token_exchange");
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      console.error("GitHub token exchange failed:", tokenData);
      return frontendError("token_exchange");
    }

    const userRes = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "seedlog-api"
      }
    });

    if (!userRes.ok) {
      console.error("GitHub user fetch error:", await userRes.text());
      return frontendError("user_fetch");
    }

    const githubUser = (await userRes.json()) as { login: string };

    const db = drizzle(c.env.DB);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.githubLogin, githubUser.login))
      .get();

    if (!user) {
      return frontendError("user_not_found");
    }

    await db
      .update(users)
      .set({ githubAccessToken: tokenData.access_token })
      .where(eq(users.id, user.id));

    const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/github/callback`);
    redirectUrl.searchParams.set("githubLogin", githubUser.login);
    return c.redirect(redirectUrl.toString());
  }
);

export { authRoute };
