import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { githubPushPayloadSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { createDMChannel, sendDMMessage } from "../lib/discord";
import { generateQuestion } from "../lib/gemini";
import { questions, users } from "../db/schema";

const githubRoute = new Hono<{ Bindings: CloudflareBindings }>();

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const hex = signature.slice(7);
  if (hex.length % 2 !== 0) return false;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  } catch {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(body));
}

githubRoute.post("/github", async (c) => {
  const event = c.req.header("X-GitHub-Event");
  const signature = c.req.header("X-Hub-Signature-256") ?? "";
  const body = await c.req.text();

  const valid = await verifySignature(c.env.GITHUB_WEBHOOK_SECRET, body, signature);
  if (!valid) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "署名が無効です" } }, 401);
  }

  if (event !== "push") {
    return c.json({ ok: true });
  }

  let parsed: ReturnType<typeof githubPushPayloadSchema.safeParse>;
  try {
    parsed = githubPushPayloadSchema.safeParse(JSON.parse(body));
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } }, 400);
  }
  if (!parsed.success) {
    return c.json({ error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } }, 400);
  }

  const { pusher, repository, head_commit, commits } = parsed.data;

  if (!head_commit) {
    return c.json({ ok: true });
  }

  const db = createDb(c.env.DB);

  const user = await db.select().from(users).where(eq(users.githubLogin, pusher.name)).get();
  if (!user) {
    return c.json({ ok: true });
  }

  const changedFiles = [
    ...new Set(commits.flatMap((commit) => [...commit.added, ...commit.modified]))
  ];

  let questionText: string;
  try {
    questionText = await generateQuestion(c.env.GEMINI_API_KEY, changedFiles);
  } catch {
    questionText = "今日のコードで一番詰まったところはどこでしたか？";
  }

  const questionId = nanoid();
  await db.insert(questions).values({
    id: questionId,
    userId: user.id,
    githubRepo: repository.full_name,
    commitSha: head_commit.id,
    changedFiles: JSON.stringify(changedFiles),
    questionText
  });

  const sendDM = async () => {
    try {
      const channelId = await createDMChannel(c.env.DISCORD_BOT_TOKEN, user.discordId);
      const messageId = await sendDMMessage(c.env.DISCORD_BOT_TOKEN, channelId, questionText);
      await db.update(questions).set({ discordMessageId: messageId }).where(eq(questions.id, questionId));
    } catch (err) {
      console.error("Discord DM 送信エラー:", err);
    }
  };
  c.executionCtx.waitUntil(sendDM());

  return c.json({ ok: true });
});

export { githubRoute };
