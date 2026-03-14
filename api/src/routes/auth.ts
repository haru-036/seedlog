import { Hono } from "hono";
import {
  getCookie,
  setCookie,
  deleteCookie,
  getSignedCookie,
  setSignedCookie
} from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { describeRoute, resolver } from "hono-openapi";
import { drizzle } from "drizzle-orm/d1";
import { eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  discordCallbackQuerySchema,
  discordDmStatusSchema,
  type DiscordDmStatus,
  githubCallbackQuerySchema,
  userResponseSchema
} from "@seedlog/schema";
import { oauthCodes, users } from "../db/schema";
import { encryptToken } from "../lib/token-crypto";
import { createDMChannel, sendDMMessage } from "../lib/discord";
import { resolveCurrentUser } from "../lib/current-user";

const authRoute = new Hono<{ Bindings: CloudflareBindings }>();

const DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";
const DISCORD_USER_GUILDS_URL = "https://discord.com/api/users/@me/guilds";

const ADMINISTRATOR_PERMISSION = 0x8n;
const MANAGE_GUILD_PERMISSION = 0x20n;

function toUserResponse(user: {
  id: string;
  discordId: string | null;
  githubLogin: string;
  createdAt: Date;
}) {
  return userResponseSchema.parse({
    id: user.id,
    discordId: user.discordId,
    githubLogin: user.githubLogin,
    createdAt: user.createdAt.toISOString()
  });
}

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canManageGuild(guild: {
  owner?: boolean;
  permissions?: string;
}): boolean {
  if (guild.owner) return true;
  if (!guild.permissions) return false;
  try {
    const permissions = BigInt(guild.permissions);
    return (
      (permissions & ADMINISTRATOR_PERMISSION) !== 0n ||
      (permissions & MANAGE_GUILD_PERMISSION) !== 0n
    );
  } catch {
    return false;
  }
}

async function hasBotInAnyManageableGuild(
  accessToken: string,
  botToken: string,
  applicationId: string
): Promise<boolean> {
  const guildRes = await fetch(DISCORD_USER_GUILDS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!guildRes.ok) {
    console.error("Discord guild list fetch error:", await guildRes.text());
    return false;
  }

  const guilds = (await guildRes.json()) as Array<{
    id: string;
    owner?: boolean;
    permissions?: string;
  }>;

  const manageableGuildIds = guilds.filter(canManageGuild).map((g) => g.id);
  if (manageableGuildIds.length === 0) return false;

  const checks = manageableGuildIds.map(async (guildId) => {
    try {
      const memberRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${applicationId}`,
        {
          headers: { Authorization: `Bot ${botToken}` }
        }
      );

      if (memberRes.ok) {
        return true;
      }

      if (memberRes.status !== 404) {
        console.error(
          `Discord bot member check failed for guild ${guildId}: ${memberRes.status}`
        );
      }
    } catch (err) {
      console.error(
        `Discord bot member check error for guild ${guildId}:`,
        err
      );
    }

    throw new Error("BOT_NOT_IN_GUILD");
  });

  try {
    await Promise.any(checks);
    return true;
  } catch {
    return false;
  }
}

async function testDmDeliverability(
  botToken: string,
  discordUserId: string
): Promise<DiscordDmStatus> {
  try {
    const channelId = await createDMChannel(botToken, discordUserId);
    await sendDMMessage(
      botToken,
      channelId,
      "Seedlog: 接続テストDMです。今後の振り返り質問はこのDMに届きます。"
    );
    return discordDmStatusSchema.parse({ deliverable: true, reason: "ok" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isBlockedOrClosed = /Discord API error (400|403):/.test(msg);
    return discordDmStatusSchema.parse({
      deliverable: false,
      reason: isBlockedOrClosed ? "blocked_or_closed" : "unknown_error"
    });
  }
}

authRoute.get(
  "/me",
  describeRoute({
    description: "現在ログイン中のユーザー情報を取得する",
    tags: ["Auth"],
    responses: {
      200: {
        description: "現在のユーザー情報",
        content: {
          "application/json": { schema: resolver(userResponseSchema) }
        }
      },
      401: { description: "未認証" },
      404: { description: "ユーザーが見つからない" }
    }
  }),
  async (c) => {
    const currentUser = await resolveCurrentUser(c);

    if (!currentUser.githubLogin) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        401
      );
    }

    if (!currentUser.user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        404
      );
    }

    return c.json(toUserResponse(currentUser.user));
  }
);

authRoute.get("/discord", async (c) => {
  // githubLogin はクライアントから受け取らず、サーバー側の署名済み Cookie から取得
  const githubLogin =
    (await getSignedCookie(c, c.env.COOKIE_SECRET, "github_user")) ?? "";
  const csrf = generateState();
  const state = btoa(JSON.stringify({ csrf, githubLogin }));
  setCookie(c, "discord_oauth_state", csrf, {
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
    scope: "identify guilds",
    state
  });
  return c.redirect(`${DISCORD_OAUTH_URL}?${params}`);
});

authRoute.get("/discord/install", (c) => {
  const params = new URLSearchParams({
    client_id: c.env.APPLICATION_ID,
    scope: "bot",
    permissions: "2048"
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
    const storedCsrf = getCookie(c, "discord_oauth_state");
    const returnedState = c.req.query("state");
    deleteCookie(c, "discord_oauth_state", { path: "/" });

    let githubLogin = "";
    if (returnedState) {
      try {
        const decoded = JSON.parse(atob(returnedState)) as {
          csrf: string;
          githubLogin: string;
        };
        if (!storedCsrf || decoded.csrf !== storedCsrf)
          return frontendError("state_mismatch");
        githubLogin = decoded.githubLogin ?? "";
      } catch {
        return frontendError("state_mismatch");
      }
    } else {
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

    const hasInstalledBot = await hasBotInAnyManageableGuild(
      tokenData.access_token,
      c.env.DISCORD_BOT_TOKEN,
      c.env.APPLICATION_ID
    );
    const dmStatus = await Promise.race<DiscordDmStatus>([
      testDmDeliverability(c.env.DISCORD_BOT_TOKEN, discordUser.id),
      new Promise<DiscordDmStatus>((_, reject) => {
        setTimeout(() => reject(new Error("DM_TEST_TIMEOUT")), 3000);
      })
    ]).catch(() => ({ deliverable: false, reason: "unknown_error" }));

    const db = drizzle(c.env.DB);
    const onetimeCode = nanoid();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分

    // githubLogin があればユーザーに discordId を紐付け
    if (githubLogin) {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.githubLogin, githubLogin))
        .get();
      if (user) {
        await db
          .update(users)
          .set({ discordId: discordUser.id })
          .where(eq(users.id, user.id));
      }
    }

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
    redirectUrl.searchParams.set(
      "needsBotInstall",
      hasInstalledBot ? "0" : "1"
    );
    redirectUrl.searchParams.set(
      "dmDeliverable",
      dmStatus.deliverable ? "1" : "0"
    );
    redirectUrl.searchParams.set("dmReason", dmStatus.reason);
    return c.redirect(redirectUrl.toString());
  }
);

// フロントが one-time code を Discord ユーザーデータと交換するエンドポイント
authRoute.post("/discord/token", async (c) => {
  const body = await c.req
    .json<{ code?: string }>()
    .catch(() => ({ code: undefined }));
  const code = body.code;
  if (!code) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "codeがありません" } },
      400
    );
  }

  const db = drizzle(c.env.DB);
  const [row] = await db
    .select()
    .from(oauthCodes)
    .where(eq(oauthCodes.code, code))
    .limit(1)
    .all();

  if (!row) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "コードが見つかりません" } },
      404
    );
  }

  if (row.expiresAt < new Date()) {
    await db.delete(oauthCodes).where(eq(oauthCodes.code, code));
    return c.json(
      { error: { code: "GONE", message: "コードの有効期限が切れています" } },
      410
    );
  }

  // 単一使用：取得後即削除
  await db.delete(oauthCodes).where(eq(oauthCodes.code, code));
  return c.json({
    discordId: row.discordId,
    discordUsername: row.discordUsername
  });
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
    const { code, error, state: returnedState } = c.req.valid("query");
    const frontendError = (reason: string) =>
      c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=${reason}`);

    if (error || !code) return frontendError("oauth_error");

    // CSRF: validate state
    const storedState = getCookie(c, "github_oauth_state");
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

    const encryptedToken = await encryptToken(
      tokenData.access_token,
      c.env.GITHUB_TOKEN_ENCRYPTION_KEY
    );

    const db = drizzle(c.env.DB);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.githubLogin, githubUser.login))
      .get();

    if (user) {
      // 既存ユーザー → token を更新
      await db
        .update(users)
        .set({ githubAccessToken: encryptedToken })
        .where(eq(users.id, user.id));
    } else {
      // 新規ユーザー → 自動作成
      await db.insert(users).values({
        id: nanoid(),
        githubLogin: githubUser.login,
        githubAccessToken: encryptedToken
      });
    }

    // 署名付き httpOnly Cookie でサーバー側のユーザー識別を保持
    await setSignedCookie(
      c,
      "github_user",
      githubUser.login,
      c.env.COOKIE_SECRET,
      {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 60 * 60 * 24 * 30,
        path: "/"
      }
    );

    const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/github/callback`);
    redirectUrl.searchParams.set("githubLogin", githubUser.login);
    return c.redirect(redirectUrl.toString());
  }
);

export { authRoute };
