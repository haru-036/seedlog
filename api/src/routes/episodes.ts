import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { episodeRequestSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { logs, users } from "../db/schema";
import { generateEpisode } from "../lib/gemini";

const episodesRoute = new Hono<{ Bindings: CloudflareBindings }>();

episodesRoute.post(
  "/",
  zValidator("json", episodeRequestSchema),
  async (c) => {
    const { userId, prompt } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        404
      );
    }

    const userLogs = await db
      .select({ content: logs.content, createdAt: logs.createdAt })
      .from(logs)
      .where(eq(logs.userId, userId))
      .orderBy(logs.createdAt)
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

    return c.json({ episode });
  }
);

export { episodesRoute };
