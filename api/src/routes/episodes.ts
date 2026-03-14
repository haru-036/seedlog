import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { describeRoute, resolver, validator } from "hono-openapi";
import { episodeRequestSchema, episodeResponseSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { episodes, logs } from "../db/schema";
import { generateEpisode } from "../lib/gemini";
import { resolveCurrentUser } from "../lib/current-user";

const episodesRoute = new Hono<{ Bindings: CloudflareBindings }>();

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
