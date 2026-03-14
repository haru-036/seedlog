import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { describeRoute, resolver, validator } from "hono-openapi";
import {
  createLogRequestSchema,
  logResponseSchema,
  logsListResponseSchema,
  logsQuerySchema
} from "@seedlog/schema";
import { createDb } from "../db";
import { logs } from "../db/schema";
import { resolveCurrentUser } from "../lib/current-user";

const logsRoute = new Hono<{ Bindings: CloudflareBindings }>();

logsRoute.get(
  "/",
  describeRoute({
    description: "ログ一覧を取得する",
    tags: ["Logs"],
    responses: {
      200: {
        description: "ログ一覧",
        content: {
          "application/json": { schema: resolver(logsListResponseSchema) }
        }
      }
    }
  }),
  validator("query", logsQuerySchema),
  async (c) => {
    const { source, limit, offset } = c.req.valid("query");
    const currentUser = await resolveCurrentUser(c);

    if (!currentUser.user) {
      c.header("Cache-Control", "private, no-store");
      c.header("Vary", "Cookie");
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        401
      );
    }

    const db = createDb(c.env.DB);

    const conditions = [eq(logs.userId, currentUser.user.id)];
    if (source) conditions.push(eq(logs.source, source));
    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(logs)
        .where(where)
        .orderBy(logs.createdAt, logs.id)
        .limit(limit)
        .offset(offset)
        .all(),
      db.select({ total: count() }).from(logs).where(where).get()
    ]);

    const total = totalResult?.total ?? 0;

    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");
    return c.json({
      logs: rows.map((row) =>
        logResponseSchema.parse({
          id: row.id,
          userId: row.userId,
          questionId: row.questionId,
          repo: row.repo,
          content: row.content,
          source: row.source,
          createdAt: row.createdAt.toISOString()
        })
      ),
      total,
      hasMore: offset + rows.length < total
    });
  }
);

logsRoute.post(
  "/",
  describeRoute({
    description: "ログを手動で追加する",
    tags: ["Logs"],
    responses: {
      201: {
        description: "作成されたログ",
        content: {
          "application/json": { schema: resolver(logResponseSchema) }
        }
      },
      401: { description: "未認証" }
    }
  }),
  validator("json", createLogRequestSchema),
  async (c) => {
    const currentUser = await resolveCurrentUser(c);

    if (!currentUser.user) {
      c.header("Cache-Control", "private, no-store");
      c.header("Vary", "Cookie");
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        401
      );
    }

    const { content, source, repo } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = nanoid();
    const createdAt = new Date();

    await db.insert(logs).values({
      id,
      userId: currentUser.user.id,
      questionId: null,
      repo,
      content,
      source,
      createdAt
    });

    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");
    return c.json(
      logResponseSchema.parse({
        id,
        userId: currentUser.user.id,
        questionId: null,
        repo,
        content,
        source,
        createdAt: createdAt.toISOString()
      }),
      201
    );
  }
);

export { logsRoute };
