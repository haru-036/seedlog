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
type RepoWebhookAccessRecord = { userId: string; githubLogin: string };

type GitHubWebhookError = {
  resource: string;
  code: string;
  message: string;
};

type GitHubWebhookErrorBody = {
  errors?: GitHubWebhookError[];
};

type GitHubHook = {
  id: number;
  config: { url?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGitHubWebhookError(value: unknown): value is GitHubWebhookError {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.resource === "string" &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function parseGitHubWebhookErrorBody(value: unknown): GitHubWebhookErrorBody {
  if (!isRecord(value) || !Array.isArray(value.errors)) {
    return {};
  }

  const errors = value.errors.filter((item) => isGitHubWebhookError(item));
  return { errors };
}

function isGitHubHook(value: unknown): value is GitHubHook {
  if (!isRecord(value) || !isRecord(value.config)) {
    return false;
  }

  const { id, config } = value;
  return (
    typeof id === "number" &&
    (config.url === undefined || typeof config.url === "string")
  );
}

function isGitHubHookArray(value: unknown): value is GitHubHook[] {
  return Array.isArray(value) && value.every((hook) => isGitHubHook(hook));
}

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

function getRepoWebhookAccessKey(repo: string): string {
  return `webhook-access:${repo}`;
}

async function setRepoWebhookAccess(
  kv: KVNamespace,
  repo: string,
  access: RepoWebhookAccessRecord
): Promise<void> {
  await kv.put(getRepoWebhookAccessKey(repo), JSON.stringify(access));
}

function parseRepoWebhookAccessRecord(
  value: unknown
): RepoWebhookAccessRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.userId !== "string" ||
    typeof value.githubLogin !== "string"
  ) {
    return null;
  }
  return {
    userId: value.userId,
    githubLogin: value.githubLogin
  };
}

async function removeRepoWebhookAccessIfOwnedBy(
  kv: KVNamespace,
  repo: string,
  userId: string
): Promise<void> {
  const currentRaw = await kv.get(getRepoWebhookAccessKey(repo), "json");
  const current = parseRepoWebhookAccessRecord(currentRaw);
  if (current?.userId === userId) {
    await kv.delete(getRepoWebhookAccessKey(repo));
  }
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
      const errorBody = parseGitHubWebhookErrorBody(await res.json());
      const isAlreadyExists = errorBody.errors?.some(
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
            const hooksPayload = await hooksRes.json();
            if (!isGitHubHookArray(hooksPayload)) {
              throw hooksPayload;
            }
            const match = hooksPayload.find(
              (h) => h.config.url === c.env.GITHUB_WEBHOOK_URL
            );
            existingHookId = match?.id ?? null;
          }
        } catch (err) {
          console.error("既存 Webhook の hookId 取得に失敗:", err);
        }
        await addWebhookRecord(c.env.WEBHOOK_KV, user.id, repo, existingHookId);
        await setRepoWebhookAccess(c.env.WEBHOOK_KV, repo, {
          userId: user.id,
          githubLogin: user.githubLogin
        });
        return c.json({ ok: true, message: "webhookはすでに登録済みです" });
      }
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "webhook登録に失敗しました"
          }
        },
        422
      );
    }

    // 403/404: リポジトリへの管理者権限がない場合（コントリビューターなど）
    // GitHub Webhook の作成には管理者権限が必要なため、ここでは KV のみ登録する。
    // hookId=null で登録されるため unregister 時は GitHub API を呼び出さない。
    // プッシュ通知は github.ts の push ハンドラーで対象ユーザーを解決して配信するため、
    // KV 登録のみで通知は機能する（リポジトリオーナーが webhook を設定済みであることが前提）。
    if (res.status === 403 || res.status === 404) {
      console.warn(
        `GitHub webhook 作成: 権限なし (status=${res.status}) repo=${repo} user=${githubLogin}`
      );
      await addWebhookRecord(c.env.WEBHOOK_KV, user.id, repo, null);
      await setRepoWebhookAccess(c.env.WEBHOOK_KV, repo, {
        userId: user.id,
        githubLogin: user.githubLogin
      });
      return c.json({ ok: true, message: "no_admin_access" });
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

    const hookPayload = await res.json();
    if (!isGitHubHook(hookPayload)) {
      console.error("GitHub webhook 作成レスポンス不正:", hookPayload);
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

    await addWebhookRecord(c.env.WEBHOOK_KV, user.id, repo, hookPayload.id);
    await setRepoWebhookAccess(c.env.WEBHOOK_KV, repo, {
      userId: user.id,
      githubLogin: user.githubLogin
    });
    return c.json({ ok: true, hookId: hookPayload.id }, 201);
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
    await removeRepoWebhookAccessIfOwnedBy(c.env.WEBHOOK_KV, repo, user.id);
    return c.json({ ok: true });
  }
);

export { webhooksRoute };
