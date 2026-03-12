import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getSignedCookie } from "hono/cookie";
import { describeRoute, resolver, validator } from "hono-openapi";
import type { ReposResponse } from "@seedlog/schema";
import { reposQuerySchema, reposResponseSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { users } from "../db/schema";
import { decryptToken } from "../lib/token-crypto";

const reposRoute = new Hono<{ Bindings: CloudflareBindings }>();

type GitHubRepo = {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  updated_at: string;
};

reposRoute.get(
  "/",
  describeRoute({
    description: "GitHubリポジトリ一覧を取得する（要: github_user Cookie）",
    tags: ["Repos"],
    responses: {
      200: {
        description: "リポジトリ一覧",
        content: {
          "application/json": { schema: resolver(reposResponseSchema) }
        }
      },
      401: { description: "GitHub認証が必要です" }
    }
  }),
  validator("query", reposQuerySchema),
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

    let accessToken: string;
    try {
      accessToken = await decryptToken(
        user.githubAccessToken,
        c.env.GITHUB_TOKEN_ENCRYPTION_KEY
      );
    } catch {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message:
              "アクセストークンの復号に失敗しました。再度GitHubログインしてください。"
          }
        },
        401
      );
    }

    const { page, per_page } = c.req.valid("query");
    const url = `https://api.github.com/user/repos?type=owner&sort=updated&per_page=${per_page}&page=${page}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "seedlog-api",
          Accept: "application/vnd.github+json"
        }
      });
    } catch (err) {
      console.error("GitHub repos fetch error:", err);
      return c.json(
        {
          error: {
            code: "GITHUB_API_ERROR",
            message: "リポジトリ一覧の取得に失敗しました"
          }
        },
        502
      );
    }

    if (!res.ok) {
      console.error("GitHub API error:", res.status);
      return c.json(
        {
          error: {
            code: "GITHUB_API_ERROR",
            message: "リポジトリ一覧の取得に失敗しました"
          }
        },
        502
      );
    }

    const rawRepos = (await res.json()) as GitHubRepo[];
    const repos = rawRepos.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      description: r.description,
      updatedAt: r.updated_at
    }));

    const link = res.headers.get("Link") ?? "";
    const hasNextPage = link.includes('rel="next"');

    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");
    return c.json({ repos, hasNextPage } satisfies ReposResponse);
  }
);

export { reposRoute };
