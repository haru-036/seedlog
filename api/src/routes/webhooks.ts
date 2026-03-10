import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getSignedCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { registerWebhookSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { users } from "../db/schema";
import { decryptToken } from "../lib/token-crypto";

const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>();

webhooksRoute.post(
  "/register",
  zValidator("json", registerWebhookSchema),
  async (c) => {
    if (!c.env.GITHUB_WEBHOOK_SECRET) {
      console.error("GITHUB_WEBHOOK_SECRET is required but not set");
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "GITHUB_WEBHOOK_SECRET is required"
          }
        },
        500
      );
    }

    const githubLogin = await getSignedCookie(
      c,
      c.env.COOKIE_SECRET,
      "github_user"
    );
    if (!githubLogin) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "GitHub認証が必要です" } },
        401
      );
    }

    const { repo } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.githubLogin, githubLogin))
      .get();

    if (!user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        404
      );
    }
    if (!user.githubAccessToken) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "GitHub連携が完了していません"
          }
        },
        401
      );
    }

    const accessToken = await decryptToken(
      user.githubAccessToken,
      c.env.GITHUB_TOKEN_ENCRYPTION_KEY
    );

    const [owner, repoName] = repo.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/hooks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "seedlog-api"
        },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["push"],
          config: {
            url: c.env.GITHUB_WEBHOOK_URL,
            content_type: "json",
            secret: c.env.GITHUB_WEBHOOK_SECRET,
            insecure_ssl: "0"
          }
        })
      }
    );

    if (res.status === 422) {
      const body = (await res.json()) as {
        errors?: { resource: string; code: string; message: string }[];
      };
      const isAlreadyExists = body.errors?.some(
        (e) =>
          e.resource === "Hook" &&
          e.code === "custom" &&
          e.message === "Hook already exists on this repository"
      );
      if (isAlreadyExists) {
        return c.json({ ok: true, message: "webhookはすでに登録済みです" });
      }
      return c.json({ ok: false, error: body }, 422);
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("GitHub webhook 登録エラー:", text);
      return c.json(
        {
          error: {
            code: "GITHUB_API_ERROR",
            message: "webhook登録に失敗しました"
          }
        },
        502
      );
    }

    const hook = (await res.json()) as { id: number };
    return c.json({ ok: true, hookId: hook.id }, 201);
  }
);

export { webhooksRoute };
