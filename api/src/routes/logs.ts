import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import {
  logResponseSchema,
  logsListResponseSchema,
  logsQuerySchema
} from "@seedlog/schema";
import { createDb } from "../db";
import { logs } from "../db/schema";

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
    const { userId, source, limit, offset } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(logs.userId, userId)];
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

    return c.json({
      logs: rows.map((row) =>
        logResponseSchema.parse({
          id: row.id,
          userId: row.userId,
          questionId: row.questionId,
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

export { logsRoute };
