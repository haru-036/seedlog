import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { describeRoute, resolver, validator } from "hono-openapi";
import {
  episodeItemSchema,
  episodeRequestSchema,
  episodeResponseSchema,
  episodesListResponseSchema,
  episodesQuerySchema
} from "@seedlog/schema";
import { createDb } from "../db";
import { episodes, logs } from "../db/schema";
import { generateEpisode } from "../lib/gemini";
import { resolveCurrentUser } from "../lib/current-user";

const episodesRoute = new Hono<{ Bindings: CloudflareBindings }>();

episodesRoute.get(
  "/",
  describeRoute({
    description: "生成済みエピソード一覧を取得する",
    tags: ["Episodes"],
    responses: {
      200: {
        description: "エピソード一覧",
        content: {
          "application/json": { schema: resolver(episodesListResponseSchema) }
        }
      },
      401: { description: "未認証" }
    }
  }),
  validator("query", episodesQuerySchema),
  async (c) => {
    const { limit, offset } = c.req.valid("query");
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

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(episodes)
        .where(eq(episodes.userId, currentUser.user.id))
        .orderBy(desc(episodes.createdAt), episodes.id)
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ total: count() })
        .from(episodes)
        .where(eq(episodes.userId, currentUser.user.id))
        .get()
    ]);

    const total = totalResult?.total ?? 0;

    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");
    return c.json({
      episodes: rows.map((row) =>
        episodeItemSchema.parse({
          id: row.id,
          prompt: row.prompt,
          content: row.content,
          createdAt: row.createdAt.toISOString()
        })
      ),
      total,
      hasMore: offset + rows.length < total
    });
  }
);

episodesRoute.post(
  "/",
  describeRoute({
    description: "過去のログをAIで整理・要約してエピソードを生成する",
    tags: ["Episodes"],
    responses: {
      200: {
        description: "生成されたエピソード",
        content: {
          "application/json": { schema: resolver(episodeResponseSchema) }
        }
      },
      401: { description: "未認証" },
      422: { description: "ログがまだありません" }
    }
  }),
  validator("json", episodeRequestSchema),
  async (c) => {
    const { prompt } = c.req.valid("json");
    const currentUser = await resolveCurrentUser(c);

    if (!currentUser.user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        401
      );
    }

    const db = createDb(c.env.DB);

    const userLogs = await db
      .select({ content: logs.content, createdAt: logs.createdAt })
      .from(logs)
      .where(eq(logs.userId, currentUser.user.id))
      .orderBy(logs.createdAt, logs.id)
      .all();

    if (userLogs.length === 0) {
      return c.json(
        {
          error: {
            code: "NO_LOGS",
            message: "ログがまだありません。ログを記録してからお試しください。"
          }
        },
        422
      );
    }

    const logContents = userLogs.map((l) => l.content);
    const episode = await generateEpisode(
      c.env.GEMINI_API_KEY,
      logContents,
      prompt
    );

    await db.insert(episodes).values({
      id: nanoid(),
      userId: currentUser.user.id,
      prompt,
      content: episode
    });

    return c.json({ episode });
  }
);

export { episodesRoute };
