import type { LogsListResponse } from "@seedlog/schema";

const uid = "mock-user-1";

export const MOCK_LOGS_RESPONSE: LogsListResponse = {
  total: 18,
  hasMore: false,
  logs: [
    // ---- 今日 ----
    {
      id: "log-01",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "タイムライン形式に UI を変更。カードを廃止してドット＋縦線で時系列を表現するレイアウトにした。日付ごとにグループ化することで「今日何件記録したか」が一目でわかるようになった。",
      source: "web",
      createdAt: ts(0, 14, 23)
    },
    {
      id: "log-02",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "log-card.tsx から Card コンポーネントを完全に除去し、フラットな div 構造に変更。",
      source: "web",
      createdAt: ts(0, 11, 5)
    },
    {
      id: "log-03",
      userId: uid,
      questionId: null,
      repo: null,
      content:
        "Tailwind の line-clamp-3 で長文を折りたたむ挙動を確認。whitespace-pre-wrap との組み合わせは問題なし。",
      source: "discord_command",
      createdAt: ts(0, 10, 30)
    },
    {
      id: "log-04",
      userId: uid,
      questionId: "q-01",
      repo: null,
      content:
        "line-clamp は overflow: hidden + webkit-box を使っているので、whitespace-pre-wrap と組み合わせると改行が先に来た場合に3行よりも短くなることがある。",
      source: "discord_reply",
      createdAt: ts(0, 10, 35)
    },
    {
      id: "log-05",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "feat: timeline layout\n\n- Replace card stack with dot+line timeline\n- Group logs by date\n- Add expand/collapse for long entries",
      source: "github_push",
      createdAt: ts(0, 9, 0)
    },
    // ---- 昨日 ----
    {
      id: "log-06",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "SWR の mutate でログ削除時に楽観的更新を実装した。API レスポンスを待たずに UI を先に更新する。",
      source: "web",
      createdAt: ts(1, 20, 15)
    },
    {
      id: "log-07",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "Cloudflare Workers の KV と D1 の使い分けを整理した。セッショントークンは KV（TTL あり）、構造化データは D1 で管理する。",
      source: "discord_command",
      createdAt: ts(1, 18, 42)
    },
    {
      id: "log-08",
      userId: uid,
      questionId: null,
      repo: null,
      content:
        "Hono の zValidator と hono-openapi/validator の違いを確認。OpenAPI スペックに自動登録されるかどうかが主な差分。",
      source: "web",
      createdAt: ts(1, 16, 0)
    },
    {
      id: "log-09",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content: "fix: correct token expiry check in auth middleware",
      source: "github_push",
      createdAt: ts(1, 13, 20)
    },
    {
      id: "log-10",
      userId: uid,
      questionId: null,
      repo: null,
      content:
        "Drizzle ORM の migrate 関数は wrangler の D1 ローカル DB に対しても普通に使える。",
      source: "discord_reply",
      createdAt: ts(1, 11, 55)
    },
    // ---- 3日前 ----
    {
      id: "log-11",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "ログ一覧のフィルタ実装。ソース種別（Web / Discord / GitHub）でフィルタリングできるようにした。件数バッジも同時表示。",
      source: "web",
      createdAt: ts(3, 19, 30)
    },
    {
      id: "log-12",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "oxlint を導入。ESLint より体感 10 倍以上速い。ルールセットは recommended + no-unused-vars だけで今は十分。",
      source: "web",
      createdAt: ts(3, 17, 10)
    },
    {
      id: "log-13",
      userId: uid,
      questionId: null,
      repo: null,
      content:
        "React の useCallback 依存配列に data を入れ忘れて古いクロージャを掴んでいた。削除時に楽観的更新がズレる原因だった。",
      source: "discord_command",
      createdAt: ts(3, 15, 48)
    },
    {
      id: "log-14",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content: "chore: add oxlint and oxfmt to CI pipeline",
      source: "github_push",
      createdAt: ts(3, 14, 0)
    },
    // ---- 1週間前 ----
    {
      id: "log-15",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "Discord Webhook でログを受け取る bot 実装。コマンド形式と質問への返答形式で source を分けて記録する設計にした。",
      source: "web",
      createdAt: ts(7, 22, 5)
    },
    {
      id: "log-16",
      userId: uid,
      questionId: null,
      repo: null,
      content:
        "Zod の z.infer で型を自動導出することで、スキーマとランタイムバリデーションと TypeScript 型を1箇所で管理できる。",
      source: "discord_reply",
      createdAt: ts(7, 20, 30)
    },
    {
      id: "log-17",
      userId: uid,
      questionId: null,
      repo: "seedlog",
      content:
        "feat: add Discord bot integration\nfeat: split discord_command / discord_reply sources",
      source: "github_push",
      createdAt: ts(7, 18, 0)
    },
    {
      id: "log-18",
      userId: uid,
      questionId: null,
      repo: null,
      content:
        "モノレポで共有スキーマパッケージを切った。フロント・バックで型をコピーしなくてよくなった。",
      source: "web",
      createdAt: ts(7, 16, 45)
    }
  ]
};

/** daysAgo 日前の HH:MM timestamp を ISO 文字列で返す */
function ts(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
