import { zValidator } from "@hono/zod-validator";
import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { createUserSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { users } from "../db/schema";

const usersRoute = new Hono<{ Bindings: CloudflareBindings }>();

usersRoute.post("/", zValidator("json", createUserSchema), async (c) => {
  const { discordId, githubLogin } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.discordId, discordId), eq(users.githubLogin, githubLogin)))
    .get();

  if (existing) {
    const field = existing.discordId === discordId ? "discordId" : "githubLogin";
    return c.json({ error: { code: "CONFLICT", message: `${field}はすでに登録されています` } }, 409);
  }

  const id = nanoid();
  await db.insert(users).values({ id, discordId, githubLogin });

  const user = await db.select().from(users).where(eq(users.id, id)).get();
  if (!user) {
    return c.json({ error: { code: "INTERNAL_ERROR", message: "ユーザーの作成に失敗しました" } }, 500);
  }

  return c.json(
    {
      id: user.id,
      discordId: user.discordId,
      githubLogin: user.githubLogin,
      createdAt: user.createdAt.toISOString()
    },
    201
  );
});

usersRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const user = await db.select().from(users).where(eq(users.id, id)).get();
  if (!user) {
    return c.json({ error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } }, 404);
  }

  return c.json({
    id: user.id,
    discordId: user.discordId,
    githubLogin: user.githubLogin,
    createdAt: user.createdAt.toISOString()
  });
});

export { usersRoute };
