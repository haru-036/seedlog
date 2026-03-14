import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { discordInteractionSchema } from "@seedlog/schema";
import { createDb } from "../db";
import { episodes, logs, questions, users } from "../db/schema";
import { generateEpisode } from "../lib/gemini";

const interactionsRoute = new Hono<{ Bindings: CloudflareBindings }>();

function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

async function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      hexToUint8Array(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToUint8Array(signature),
      encoder.encode(timestamp + body)
    );
  } catch {
    return false;
  }
}

const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5
} as const;

const RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  MODAL: 9
} as const;

const DISCORD_MESSAGE_MAX_LENGTH = 2000;
const EPHEMERAL_FLAG = 64;
const DISCORD_API = "https://discord.com/api/v10";

function ephemeralMessage(content: string) {
  return {
    type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL_FLAG }
  };
}

function truncateForDiscordMessage(content: string): string {
  if (content.length <= DISCORD_MESSAGE_MAX_LENGTH) {
    return content;
  }

  const suffix = "\n\n...（文字数上限のため一部省略しました）";
  return content.slice(0, DISCORD_MESSAGE_MAX_LENGTH - suffix.length) + suffix;
}

async function sendInteractionFollowup(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const res = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, flags: EPHEMERAL_FLAG })
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord follow-up error ${res.status}: ${text}`);
  }
}

const REPLY_MODAL_COMPONENTS = (customId: string) => ({
  type: RESPONSE_TYPE.MODAL,
  data: {
    custom_id: customId,
    title: "振り返り",
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: "reply_text",
            style: 2,
            label: "今日の振り返り",
            placeholder: "詰まったところや解決策、学んだことを書いてください",
            required: true,
            max_length: 2000
          }
        ]
      }
    ]
  }
});

const LOG_MODAL = {
  type: RESPONSE_TYPE.MODAL,
  data: {
    custom_id: "log_entry",
    title: "今日のログを記録",
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: "log_text",
            style: 2,
            label: "今日学んだこと・詰まったこと",
            placeholder: "今日の気づきや詰まったことを自由に書いてください",
            required: true,
            max_length: 2000
          }
        ]
      }
    ]
  }
};

interactionsRoute.post("/", async (c) => {
  const signature = c.req.header("x-signature-ed25519") ?? "";
  const timestamp = c.req.header("x-signature-timestamp") ?? "";
  const body = await c.req.text();

  if (!signature || !timestamp) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "署名ヘッダーがありません" } },
      401
    );
  }

  const isValid = await verifyDiscordSignature(
    c.env.DISCORD_PUBLIC_KEY,
    signature,
    timestamp,
    body
  );
  if (!isValid) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "署名が無効です" } },
      401
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(body);
  } catch {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } },
      400
    );
  }

  const parsed = discordInteractionSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } },
      400
    );
  }
  const interaction = parsed.data;

  // PING — Discord Endpoint URL 検証用
  if (interaction.type === INTERACTION_TYPE.PING) {
    return c.json({ type: RESPONSE_TYPE.PONG });
  }

  // /log スラッシュコマンド → モーダルを表示
  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    if (interaction.data?.name === "log") {
      return c.json(LOG_MODAL);
    }

    if (interaction.data?.name === "episode") {
      const discordUserId = interaction.member?.user.id ?? interaction.user?.id;
      if (!discordUserId) {
        return c.json(ephemeralMessage("ユーザー情報が取得できませんでした。"));
      }

      const prompt =
        interaction.data.options
          ?.find((option) => option.name === "prompt")
          ?.value?.trim() ?? "";
      if (!prompt) {
        return c.json(
          ephemeralMessage(
            "promptが空です。`/episode prompt:今週の成長をまとめて` のように入力してください。"
          )
        );
      }

      const applicationId = interaction.application_id;
      const interactionToken = interaction.token;
      if (!applicationId || !interactionToken) {
        return c.json(
          ephemeralMessage(
            "Discord情報が不足しているため処理できませんでした。しばらくしてから再試行してください。"
          )
        );
      }

      c.executionCtx.waitUntil(
        (async () => {
          try {
            const db = createDb(c.env.DB);
            const user = await db
              .select()
              .from(users)
              .where(eq(users.discordId, discordUserId))
              .get();
            if (!user) {
              await sendInteractionFollowup(
                applicationId,
                interactionToken,
                "ユーザーが見つかりませんでした。まず `/register` でユーザー登録してください。"
              );
              return;
            }

            const userLogs = await db
              .select({ content: logs.content, createdAt: logs.createdAt })
              .from(logs)
              .where(eq(logs.userId, user.id))
              .orderBy(logs.createdAt, logs.id)
              .all();
            if (userLogs.length === 0) {
              await sendInteractionFollowup(
                applicationId,
                interactionToken,
                "ログがまだありません。`/log` でログを記録してからお試しください。"
              );
              return;
            }

            const episode = await generateEpisode(
              c.env.GEMINI_API_KEY,
              userLogs.map((log) => log.content),
              prompt
            );

            await db.insert(episodes).values({
              id: nanoid(),
              userId: user.id,
              prompt,
              content: episode
            });

            await sendInteractionFollowup(
              applicationId,
              interactionToken,
              truncateForDiscordMessage(episode)
            );
          } catch (err) {
            console.error("episode_command: エラー", err);
            try {
              await sendInteractionFollowup(
                applicationId,
                interactionToken,
                "エピソード生成中にエラーが発生しました。しばらくしてから再試行してください。"
              );
            } catch (followupErr) {
              console.error(
                "episode_command: フォローアップ送信エラー",
                followupErr
              );
            }
          }
        })()
      );

      return c.json(ephemeralMessage("エピソードを生成中です…"));
    }
  }

  // ボタンクリック → 振り返りモーダルを表示
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id ?? "";
    if (customId.startsWith("open_reply_modal:")) {
      const questionId = customId.slice("open_reply_modal:".length);
      return c.json(REPLY_MODAL_COMPONENTS(`question_reply:${questionId}`));
    }
  }

  // モーダル送信
  if (interaction.type === INTERACTION_TYPE.MODAL_SUBMIT) {
    const discordUserId = interaction.member?.user.id ?? interaction.user?.id;
    if (!discordUserId) {
      return c.json(ephemeralMessage("ユーザー情報が取得できませんでした。"));
    }

    const content =
      (interaction.data?.components ?? [])
        .flatMap((row) => row.components ?? [])
        .find((comp) => comp.type === 4)?.value ?? "";

    if (!content.trim()) {
      return c.json(ephemeralMessage("内容を入力してください。"));
    }

    const db = createDb(c.env.DB);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.discordId, discordUserId))
      .get();
    if (!user) {
      return c.json(
        ephemeralMessage(
          "ユーザーが見つかりませんでした。まず `/register` でユーザー登録してください。"
        )
      );
    }

    const customId = interaction.data?.custom_id ?? "";

    // 質問への回答（answeredAt IS NULL の条件付き UPDATE で重複書き込みを防止）
    if (customId.startsWith("question_reply:")) {
      const questionId = customId.slice("question_reply:".length);
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const updated = await db
              .update(questions)
              .set({ answeredAt: new Date() })
              .where(
                and(
                  eq(questions.id, questionId),
                  eq(questions.userId, user.id),
                  isNull(questions.answeredAt)
                )
              )
              .returning({
                id: questions.id,
                githubRepo: questions.githubRepo
              });

            if (updated.length === 0) {
              // 既回答 or 別ユーザーの質問
              console.warn("question_reply: スキップ（既回答または権限なし）", {
                questionId,
                userId: user.id
              });
              return;
            }

            await db.insert(logs).values({
              id: nanoid(),
              userId: user.id,
              questionId,
              repo: updated[0].githubRepo,
              content,
              source: "discord_reply"
            });
          } catch (err) {
            console.error("question_reply: ログ保存エラー", err);
          }
        })()
      );
      return c.json({
        type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "回答を記録しました！振り返り、お疲れさまでした 🌱",
          flags: EPHEMERAL_FLAG
        }
      });
    }

    // /log コマンドからの手動ログ
    if (customId === "log_entry") {
      c.executionCtx.waitUntil(
        (async () => {
          try {
            await db.insert(logs).values({
              id: nanoid(),
              userId: user.id,
              questionId: null,
              repo: null,
              content,
              source: "discord_command"
            });
          } catch (err) {
            console.error("log_entry: ログ保存エラー", err);
          }
        })()
      );
      return c.json({
        type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "ログを記録しました！今日も成長、お疲れさまでした 🌱",
          flags: EPHEMERAL_FLAG
        }
      });
    }

    return c.json(ephemeralMessage("不明な操作です。"));
  }

  return c.json(ephemeralMessage("対応していないInteractionです。"));
});

export { interactionsRoute };
