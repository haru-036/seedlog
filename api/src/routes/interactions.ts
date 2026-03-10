import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { createDb } from "../db";
import { logs, questions, users } from "../db/schema";

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
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5
} as const;

const RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  MODAL: 9
} as const;

type ModalComponent = { type: number; custom_id: string; value: string };
type ActionRow = { type: number; components: ModalComponent[] };

type Interaction = {
  type: number;
  data?: {
    custom_id?: string;
    components?: ActionRow[];
  };
  member?: { user: { id: string } };
  user?: { id: string };
};

interactionsRoute.post("/", async (c) => {
  const signature = c.req.header("x-signature-ed25519") ?? "";
  const timestamp = c.req.header("x-signature-timestamp") ?? "";
  const body = await c.req.text();

  if (!signature || !timestamp) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "署名ヘッダーがありません" } }, 401);
  }

  const isValid = await verifyDiscordSignature(c.env.DISCORD_PUBLIC_KEY, signature, timestamp, body);
  if (!isValid) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "署名が無効です" } }, 401);
  }

  let interaction: Interaction;
  try {
    interaction = JSON.parse(body) as Interaction;
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "不正なpayload形式です" } }, 400);
  }

  // PING — Discord Endpoint URL 検証用
  if (interaction.type === INTERACTION_TYPE.PING) {
    return c.json({ type: RESPONSE_TYPE.PONG });
  }

  // ボタンクリック → モーダルを表示
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id ?? "";
    if (customId.startsWith("open_reply_modal:")) {
      const questionId = customId.slice("open_reply_modal:".length);
      return c.json({
        type: RESPONSE_TYPE.MODAL,
        data: {
          custom_id: `question_reply:${questionId}`,
          title: "振り返り",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4, // TEXT_INPUT
                  custom_id: "reply_text",
                  style: 2, // PARAGRAPH
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
    }
  }

  // モーダル送信
  if (interaction.type === INTERACTION_TYPE.MODAL_SUBMIT) {
    const discordUserId = interaction.member?.user.id ?? interaction.user?.id;
    if (!discordUserId) {
      return c.json({
        type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "ユーザー情報が取得できませんでした。", flags: 64 }
      });
    }

    const content = (interaction.data?.components ?? [])
      .flatMap((row) => row.components)
      .find((comp) => comp.type === 4)?.value ?? "";

    if (!content.trim()) {
      return c.json({
        type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "内容を入力してください。", flags: 64 }
      });
    }

    const db = createDb(c.env.DB);
    const user = await db.select().from(users).where(eq(users.discordId, discordUserId)).get();
    if (!user) {
      return c.json({
        type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "ユーザーが見つかりませんでした。まず `/register` でユーザー登録してください。", flags: 64 }
      });
    }

    const customId = interaction.data?.custom_id ?? "";

    // 質問への回答
    if (customId.startsWith("question_reply:")) {
      const questionId = customId.slice("question_reply:".length);
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const question = await db.select().from(questions).where(eq(questions.id, questionId)).get();
            if (!question) {
              console.error("question_reply: questionが見つかりません", { questionId });
              return;
            }
            await db.insert(logs).values({
              id: nanoid(),
              userId: user.id,
              questionId,
              content,
              source: "discord_reply"
            });
            await db.update(questions).set({ answeredAt: new Date() }).where(eq(questions.id, questionId));
          } catch (err) {
            console.error("question_reply: ログ保存エラー", err);
          }
        })()
      );
      return c.json({
        type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "回答を記録しました！振り返り、お疲れさまでした 🌱", flags: 64 }
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
        data: { content: "ログを記録しました！今日も成長、お疲れさまでした 🌱", flags: 64 }
      });
    }

    return c.json({
      type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "不明な操作です。", flags: 64 }
    });
  }

  return c.json({ type: RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "対応していないInteractionです。", flags: 64 } });
});

export { interactionsRoute };
