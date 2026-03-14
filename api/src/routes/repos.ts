import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
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

type RepoListItem = ReposResponse["repos"][number];

type GitHubReposPageResult =
  | {
      ok: true;
      repos: RepoListItem[];
      hasNextPage: boolean;
    }
  | {
      ok: false;
      status: number | "network" | "invalid_payload";
      error?: unknown;
    };

const GITHUB_REPOS_SCAN_PER_PAGE = 100;
const GITHUB_REPOS_SCAN_MAX_PAGES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGitHubRepo(value: unknown): value is GitHubRepo {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.full_name === "string" &&
    typeof value.private === "boolean" &&
    (typeof value.description === "string" || value.description === null) &&
    typeof value.updated_at === "string"
  );
}

function isGitHubRepoArray(value: unknown): value is GitHubRepo[] {
  return Array.isArray(value) && value.every((repo) => isGitHubRepo(repo));
}

async function fetchGitHubReposPage(params: {
  accessToken: string;
  page: number;
  perPage: number;
}): Promise<GitHubReposPageResult> {
  const { accessToken, page, perPage } = params;
  const url = `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=${perPage}&page=${page}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "seedlog-api",
        Accept: "application/vnd.github+json"
      }
    });
  } catch (error) {
    return { ok: false, status: "network", error };
  }

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (error) {
    return {
      ok: false,
      status: "invalid_payload",
      error
    };
  }
  if (!isGitHubRepoArray(payload)) {
    return {
      ok: false,
      status: "invalid_payload",
      error: payload
    };
  }

  const repos = payload.map((repo) => ({
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    description: repo.description,
    updatedAt: repo.updated_at
  }));
  const link = res.headers.get("Link") ?? "";
  const hasNextPage = link.includes('rel="next"');

  return { ok: true, repos, hasNextPage };
}

function githubReposErrorResponse(
  c: Context<{ Bindings: CloudflareBindings }>,
  status: number | "network" | "invalid_payload",
  error?: unknown
) {
  if (status === "network" || status === "invalid_payload") {
    console.error("GitHub repos fetch error:", error);
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

  console.error("GitHub API error:", status);
  if (status === 401 || status === 403) {
    return c.json(
      {
        error: {
          code: "GITHUB_AUTH_ERROR",
          message: "GitHub認証に失敗しました。再度ログインしてください"
        }
      },
      status
    );
  }

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

    const { page, per_page, query } = c.req.valid("query");

    if (!query) {
      const result = await fetchGitHubReposPage({
        accessToken,
        page,
        perPage: per_page
      });
      if (!result.ok) {
        return githubReposErrorResponse(c, result.status, result.error);
      }

      c.header("Cache-Control", "private, no-store");
      c.header("Vary", "Cookie");
      return c.json({
        repos: result.repos,
        hasNextPage: result.hasNextPage
      } satisfies ReposResponse);
    }

    const keyword = query.toLowerCase();
    const startIndex = (page - 1) * per_page;
    const endExclusive = startIndex + per_page;
    let matchedCount = 0;
    const repos: RepoListItem[] = [];

    let githubPage = 1;
    let hasGitHubNextPage = true;

    while (
      hasGitHubNextPage &&
      githubPage <= GITHUB_REPOS_SCAN_MAX_PAGES &&
      matchedCount <= endExclusive
    ) {
      const result = await fetchGitHubReposPage({
        accessToken,
        page: githubPage,
        perPage: GITHUB_REPOS_SCAN_PER_PAGE
      });
      if (!result.ok) {
        return githubReposErrorResponse(c, result.status, result.error);
      }

      for (const repo of result.repos) {
        const searchable =
          `${repo.name} ${repo.fullName} ${repo.description ?? ""}`
            .toLowerCase()
            .trim();

        if (!searchable.includes(keyword)) {
          continue;
        }

        matchedCount += 1;
        if (matchedCount > startIndex && repos.length < per_page + 1) {
          repos.push(repo);
        }
      }

      hasGitHubNextPage = result.hasNextPage;
      githubPage += 1;
    }

    const hasNextPage = repos.length > per_page;
    const pageRepos = repos.slice(0, per_page);

    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");
    return c.json({ repos: pageRepos, hasNextPage } satisfies ReposResponse);
  }
);

export { reposRoute };
