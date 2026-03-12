import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { nanoid } from "nanoid";
import { createUserSchema, userResponseSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { users } from "../db/schema";

const usersRoute = new Hono<{ Bindings: CloudflareBindings }>();

function toUserResponse(user: {
  id: string;
  discordId: string | null;
  githubLogin: string;
  createdAt: Date;
}) {
  return userResponseSchema.parse({
    id: user.id,
    discordId: user.discordId,
    githubLogin: user.githubLogin,
    createdAt: user.createdAt.toISOString()
  });
}

usersRoute.post(
  "/",
  describeRoute({
    description: "ユーザーを登録する",
    tags: ["Users"],
    responses: {
      201: {
        description: "ユーザー作成成功",
        content: {
          "application/json": { schema: resolver(userResponseSchema) }
        }
      },
      409: { description: "githubLogin または discordId が重複" }
    }
  }),
  validator("json", createUserSchema),
  async (c) => {
    const { discordId, githubLogin } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const existing = await db
      .select()
      .from(users)
      .where(
        discordId
          ? or(
              eq(users.discordId, discordId),
              eq(users.githubLogin, githubLogin)
            )
          : eq(users.githubLogin, githubLogin)
      )
      .get();

    if (existing) {
      const field =
        existing.githubLogin === githubLogin
          ? "githubLogin"
          : discordId && existing.discordId === discordId
            ? "discordId"
            : "githubLogin";
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `${field}はすでに登録されています`
          }
        },
        409
      );
    }

    const id = nanoid();
    try {
      await db.insert(users).values({ id, discordId, githubLogin });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE")) {
        const field = msg.includes("discord_id") ? "discordId" : "githubLogin";
        return c.json(
          {
            error: {
              code: "CONFLICT",
              message: `${field}はすでに登録されています`
            }
          },
          409
        );
      }
      throw err;
    }

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "ユーザーの作成に失敗しました"
          }
        },
        500
      );
    }

    return c.json(toUserResponse(user), 201);
  }
);

usersRoute.get(
  "/:id",
  describeRoute({
    description: "ユーザー情報を取得する",
    tags: ["Users"],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } }
    ],
    responses: {
      200: {
        description: "ユーザー情報",
        content: {
          "application/json": { schema: resolver(userResponseSchema) }
        }
      },
      404: { description: "ユーザーが見つかりません" }
    }
  }),
  async (c) => {
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        404
      );
    }

    return c.json(toUserResponse(user));
  }
);

export { usersRoute };
