import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getSignedCookie } from "hono/cookie";
import { createDb } from "../db";
import { users } from "../db/schema";
import { decryptToken } from "../lib/token-crypto";

const reposRoute = new Hono<{ Bindings: CloudflareBindings }>();

reposRoute.get("/", async (c) => {
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

  const accessToken = await decryptToken(
    user.githubAccessToken,
    c.env.GITHUB_TOKEN_ENCRYPTION_KEY
  );

  const res = await fetch(
    "https://api.github.com/user/repos?type=owner&sort=updated&per_page=100",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "seedlog-api",
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (!res.ok) {
    console.error("GitHub repos fetch error:", await res.text());
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

  const rawRepos = (await res.json()) as {
    name: string;
    full_name: string;
    private: boolean;
    description: string | null;
    updated_at: string;
  }[];

  const repos = rawRepos.map((r) => ({
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    description: r.description,
    updatedAt: r.updated_at
  }));

  return c.json({ repos });
});

export { reposRoute };
