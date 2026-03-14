import type { Context } from "hono";
import { getSignedCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { users } from "../db/schema";

type AppContext = Context<{ Bindings: CloudflareBindings }>;

export interface CurrentUserResolution {
  githubLogin: string | null;
  user: {
    id: string;
    discordId: string | null;
    githubLogin: string;
    githubAccessToken: string | null;
    createdAt: Date;
  } | null;
}

export async function resolveCurrentUser(
  c: AppContext
): Promise<CurrentUserResolution> {
  const githubLogin =
    (await getSignedCookie(c, c.env.COOKIE_SECRET, "github_user")) ?? null;

  if (!githubLogin) {
    return { githubLogin: null, user: null };
  }

  const db = createDb(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.githubLogin, githubLogin))
    .get();

  return {
    githubLogin,
    user: user ?? null
  };
}
