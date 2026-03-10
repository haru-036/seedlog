import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { registerWebhookSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { users } from "../db/schema";

const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>();

webhooksRoute.post(
  "/register",
  zValidator("json", registerWebhookSchema),
  async (c) => {
    const { githubLogin, repo } = c.req.valid("json");
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

    const [owner, repoName] = repo.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/hooks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
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
      // 422 = すでに同じ webhook が登録済み
      return c.json({ ok: true, message: "webhookはすでに登録済みです" });
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
