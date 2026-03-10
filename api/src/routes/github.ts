import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { githubPushPayloadSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { questions, users } from "../db/schema";

const githubRoute = new Hono<{ Bindings: CloudflareBindings }>();

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
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

  const parsed = githubPushPayloadSchema.safeParse(JSON.parse(body));
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

  await db.insert(questions).values({
    id: nanoid(),
    userId: user.id,
    githubRepo: repository.full_name,
    commitSha: head_commit.id,
    changedFiles: JSON.stringify(changedFiles),
    questionText: "AI生成予定"
  });

  return c.json({ ok: true });
});

export { githubRoute };
