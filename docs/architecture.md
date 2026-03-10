# アーキテクチャ

## 技術スタック

| 役割           | 技術                               |
| -------------- | ---------------------------------- |
| フロントエンド | Vite + React                       |
| バックエンド   | Hono                               |
| DB             | Cloudflare D1                      |
| ORM            | Drizzle                            |
| ホスティング   | Cloudflare Workers（api・web両方） |
| モノレポ       | bun workspaces + Turborepo         |

---

## モノレポ構成

```
seedlog/
├── schema/              # 共通スキーマ（Zod + Drizzle）
├── web/                 # Vite + React → Cloudflare Workers (Static Assets)
├── api/                 # Hono → Cloudflare Workers
├── docs/
├── turbo.json
└── package.json         # bun workspaces
```

---

## フロー

```
GitHub push
　↓
Cloudflare Worker が webhook を受け取る
　↓
コミット情報（ファイル名・変更回数・コミットメッセージ）をAIに渡して質問を生成
　↓
Discord REST API を叩いてユーザーにDMを送る
　↓
ユーザーがDiscordで返信（Interactions Endpoint / モーダル）
　↓
Cloudflare Worker が返信を受け取りDBに保存
```

---

## 意思決定の記録

設計上の意思決定（なぜそう決めたか・却下した選択肢）は [`docs/decisions.md`](./decisions.md) を参照。
