import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getSignedCookie } from "hono/cookie";
import { describeRoute, resolver, validator } from "hono-openapi";
import {
  webhookMutationResponseSchema,
  registerWebhookSchema,
  unregisterWebhookSchema,
  webhooksListResponseSchema
} from "@seedlog/schema";
import { createDb } from "../db";
import { users } from "../db/schema";
import { decryptToken } from "../lib/token-crypto";

type WebhookRecord = { repo: string; hookId: number | null };

async function getWebhookRecords(
  kv: KVNamespace,
  userId: string
): Promise<WebhookRecord[]> {
  const data = await kv.get<WebhookRecord[]>(`webhooks:${userId}`, "json");
  return data ?? [];
}

async function addWebhookRecord(
  kv: KVNamespace,
  userId: string,
  repo: string,
  hookId: number | null
): Promise<void> {
  const records = await getWebhookRecords(kv, userId);
  if (!records.some((r) => r.repo === repo)) {
    records.push({ repo, hookId });
    await kv.put(`webhooks:${userId}`, JSON.stringify(records));
  }
}

async function removeWebhookRecord(
  kv: KVNamespace,
  userId: string,
  repo: string
): Promise<void> {
  const records = await getWebhookRecords(kv, userId);
  const nextRecords = records.filter((record) => record.repo !== repo);
  await kv.put(`webhooks:${userId}`, JSON.stringify(nextRecords));
}

const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>();

webhooksRoute.get(
  "/",
  describeRoute({
    description:
      "登録済み Webhook リポジトリ一覧を取得する（要: github_user Cookie）",
    tags: ["Webhooks"],
    responses: {
      200: {
        description: "Webhook 登録済みリポジトリ一覧",
        content: {
          "application/json": { schema: resolver(webhooksListResponseSchema) }
        }
      },
      401: { description: "GitHub認証が必要です" }
    }
  }),
  async (c) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");

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

    const db = createDb(c.env.DB);
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.githubLogin, githubLogin))
      .get();

    if (!user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        404
      );
    }

    const records = await getWebhookRecords(c.env.WEBHOOK_KV, user.id);
    return c.json({ repos: records.map((r) => r.repo) });
  }
);

webhooksRoute.post(
  "/register",
  describeRoute({
    description:
      "GitHub リポジトリに Webhook を登録する（要: github_user Cookie）",
    tags: ["Webhooks"],
    responses: {
      201: { description: "Webhook 登録成功" },
      200: { description: "Webhook は登録済み" },
      401: { description: "GitHub認証が必要です" }
    }
  }),
  validator("json", registerWebhookSchema),
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
        // 既存 Webhook の実際の hookId を GitHub API から取得する
        let existingHookId: number | null = null;
        try {
          const hooksRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/hooks`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "seedlog-api",
                Accept: "application/vnd.github+json"
              }
            }
          );
          if (hooksRes.ok) {
            const hooks = (await hooksRes.json()) as {
              id: number;
              config: { url?: string };
            }[];
            const match = hooks.find(
              (h) => h.config.url === c.env.GITHUB_WEBHOOK_URL
            );
            existingHookId = match?.id ?? null;
          }
        } catch (err) {
          console.error("既存 Webhook の hookId 取得に失敗:", err);
        }
        await addWebhookRecord(c.env.WEBHOOK_KV, user.id, repo, existingHookId);
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
    await addWebhookRecord(c.env.WEBHOOK_KV, user.id, repo, hook.id);
    return c.json({ ok: true, hookId: hook.id }, 201);
  }
);

webhooksRoute.delete(
  "/unregister",
  describeRoute({
    description:
      "GitHub リポジトリの Webhook を解除する（要: github_user Cookie）",
    tags: ["Webhooks"],
    responses: {
      200: {
        description: "Webhook 解除成功",
        content: {
          "application/json": {
            schema: resolver(webhookMutationResponseSchema)
          }
        }
      },
      401: { description: "GitHub認証が必要です" },
      404: { description: "ユーザーまたは Webhook が見つかりません" },
      502: { description: "GitHub API エラー" }
    }
  }),
  validator("json", unregisterWebhookSchema),
  async (c) => {
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

    const records = await getWebhookRecords(c.env.WEBHOOK_KV, user.id);
    const record = records.find((item) => item.repo === repo);
    if (!record) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Webhook が登録されていません"
          }
        },
        404
      );
    }

    if (record.hookId !== null) {
      const accessToken = await decryptToken(
        user.githubAccessToken,
        c.env.GITHUB_TOKEN_ENCRYPTION_KEY
      );
      const [owner, repoName] = repo.split("/");
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/hooks/${record.hookId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "seedlog-api"
          }
        }
      );

      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        console.error("GitHub webhook 解除エラー:", text);
        return c.json(
          {
            error: {
              code: "GITHUB_API_ERROR",
              message: "webhook解除に失敗しました"
            }
          },
          502
        );
      }
    }

    await removeWebhookRecord(c.env.WEBHOOK_KV, user.id, repo);
    return c.json({ ok: true });
  }
);

export { webhooksRoute };
