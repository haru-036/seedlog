import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { githubPushPayloadSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { createDMChannel, sendDMMessage } from "../lib/discord";
import { generateQuestion } from "../lib/gemini";
import { decryptToken } from "../lib/token-crypto";
import { questions, users } from "../db/schema";

const githubRoute = new Hono<{ Bindings: CloudflareBindings }>();

type RepoWebhookAccessRecord = {
  userId: string;
  githubLogin: string;
};

type GitHubPullRequestSummary = {
  user: {
    login: string;
  };
  base: {
    ref: string;
  };
  head: {
    sha: string;
  };
  merged_at: string | null;
  merge_commit_sha: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRepoWebhookAccessRecord(
  value: unknown
): RepoWebhookAccessRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.userId !== "string" ||
    typeof value.githubLogin !== "string"
  ) {
    return null;
  }
  return {
    userId: value.userId,
    githubLogin: value.githubLogin
  };
}

function isGitHubPullRequestSummary(
  value: unknown
): value is GitHubPullRequestSummary {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isRecord(value.user) ||
    !isRecord(value.base) ||
    !isRecord(value.head) ||
    (value.merged_at !== null && typeof value.merged_at !== "string") ||
    (value.merge_commit_sha !== null &&
      value.merge_commit_sha !== undefined &&
      typeof value.merge_commit_sha !== "string")
  ) {
    return false;
  }

  return (
    typeof value.user.login === "string" &&
    typeof value.base.ref === "string" &&
    typeof value.head.sha === "string"
  );
}

function parseGitHubPullRequests(
  value: unknown
): GitHubPullRequestSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => isGitHubPullRequestSummary(item))) {
    return null;
  }
  return value;
}

function getRepoWebhookAccessKey(repoFullName: string): string {
  return `webhook-access:${repoFullName}`;
}

async function findPrAuthorLogin(params: {
  repoFullName: string;
  headCommitSha: string;
  env: CloudflareBindings;
}): Promise<string | null> {
  const { repoFullName, headCommitSha, env } = params;
  const accessRaw = await env.WEBHOOK_KV.get(
    getRepoWebhookAccessKey(repoFullName),
    "json"
  );
  const access = parseRepoWebhookAccessRecord(accessRaw);
  if (!access) {
    return null;
  }

  const db = createDb(env.DB);
  const accessUser = await db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      githubAccessToken: users.githubAccessToken
    })
    .from(users)
    .where(eq(users.id, access.userId))
    .get();
  if (!accessUser || !accessUser.githubAccessToken) {
    return null;
  }

  let accessToken: string;
  try {
    accessToken = await decryptToken(
      accessUser.githubAccessToken,
      env.GITHUB_TOKEN_ENCRYPTION_KEY
    );
  } catch {
    return null;
  }

  const [owner, repoName] = repoFullName.split("/");
  if (!owner || !repoName) {
    return null;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/commits/${headCommitSha}/pulls`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "seedlog-api",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (!res.ok) {
    console.warn(
      `PR解決API失敗: repo=${repoFullName} sha=${headCommitSha} status=${res.status}`
    );
    return null;
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    console.warn(`PR解決APIレスポンスパース失敗: repo=${repoFullName}`);
    return null;
  }
  const prs = parseGitHubPullRequests(raw);
  if (!prs || prs.length === 0) {
    return null;
  }

  const mainMerged = prs.filter(
    (pr) =>
      pr.base.ref === "main" &&
      pr.merged_at !== null &&
      (pr.merge_commit_sha === headCommitSha || pr.head.sha === headCommitSha)
  );
  if (mainMerged.length === 0) {
    return null;
  }

  mainMerged.sort((a, b) => {
    const aTime = a.merged_at ? Date.parse(a.merged_at) : 0;
    const bTime = b.merged_at ? Date.parse(b.merged_at) : 0;
    return bTime - aTime;
  });

  return mainMerged[0]?.user.login ?? null;
}

async function verifySignature(
  secret: string,
  body: string,
  signature: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const hex = signature.slice(7);
  if (hex.length % 2 !== 0) return false;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = new Uint8Array(
      hex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    );
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
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(body)
  );
}

githubRoute.post("/github", async (c) => {
  const event = c.req.header("X-GitHub-Event");
  const signature = c.req.header("X-Hub-Signature-256") ?? "";
  const body = await c.req.text();

  const valid = await verifySignature(
    c.env.GITHUB_WEBHOOK_SECRET,
    body,
    signature
  );
  if (!valid) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "署名が無効です" } },
      401
    );
  }

  if (event !== "push") {
    return c.json({ ok: true });
  }

  let parsed: ReturnType<typeof githubPushPayloadSchema.safeParse>;
  try {
    parsed = githubPushPayloadSchema.safeParse(JSON.parse(body));
  } catch {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } },
      400
    );
  }
  if (!parsed.success) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } },
      400
    );
  }

  const { pusher, repository, head_commit, commits, ref } = parsed.data;

  if (ref !== "refs/heads/main") {
    return c.json({ ok: true });
  }

  if (!head_commit) {
    return c.json({ ok: true });
  }

  const db = createDb(c.env.DB);

  const prAuthorLogin = await findPrAuthorLogin({
    repoFullName: repository.full_name,
    headCommitSha: head_commit.id,
    env: c.env
  });
  const targetLogin = prAuthorLogin ?? pusher.name;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.githubLogin, targetLogin))
    .get();
  if (!user) {
    return c.json({ ok: true });
  }

  const changedFiles = [
    ...new Set(
      commits.flatMap((commit) => [...commit.added, ...commit.modified])
    )
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
    if (!user.discordId) return; // Discord未連携はスキップ
    let messageId: string;
    try {
      const channelId = await createDMChannel(
        c.env.DISCORD_BOT_TOKEN,
        user.discordId
      );
      messageId = await sendDMMessage(
        c.env.DISCORD_BOT_TOKEN,
        channelId,
        questionText,
        {
          components: [
            {
              type: 1, // ACTION_ROW
              components: [
                {
                  type: 2, // BUTTON
                  style: 1, // PRIMARY
                  label: "回答する",
                  custom_id: `open_reply_modal:${questionId}`
                }
              ]
            }
          ]
        }
      );
    } catch (err) {
      console.error("Discord DM 送信エラー:", err);
      return;
    }

    try {
      await db
        .update(questions)
        .set({ discordMessageId: messageId })
        .where(eq(questions.id, questionId));
    } catch (err) {
      console.error("Discord DM sent but failed to save discordMessageId:", {
        err,
        messageId,
        questionId
      });
    }
  };
  c.executionCtx.waitUntil(sendDM());

  return c.json({ ok: true });
});

export { githubRoute };
