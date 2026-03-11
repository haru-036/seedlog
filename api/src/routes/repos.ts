import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getSignedCookie } from "hono/cookie";
import type { Repo, ReposResponse } from "@seedlog/schema";
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

async function fetchAllRepos(accessToken: string): Promise<Repo[]> {
  const repos: Repo[] = [];
  let url: string | null =
    "https://api.github.com/user/repos?type=owner&sort=updated&per_page=100";

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "seedlog-api",
        Accept: "application/vnd.github+json"
      }
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const page = (await res.json()) as GitHubRepo[];
    repos.push(
      ...page.map((r) => ({
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        description: r.description,
        updatedAt: r.updated_at
      }))
    );

    const link: string = res.headers.get("Link") ?? "";
    const nextMatch: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return repos;
}

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

  let repos: Repo[];
  try {
    repos = await fetchAllRepos(accessToken);
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

  c.header("Cache-Control", "private, no-store");
  c.header("Vary", "Cookie");
  return c.json({ repos } satisfies ReposResponse);
});

export { reposRoute };

