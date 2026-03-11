# アーキテクチャ

## 技術スタック

| 役割           | 技術                               |
| -------------- | ---------------------------------- |
| フロントエンド | Vite + React                       |
| バックエンド   | Hono                               |
| DB             | Cloudflare D1                      |
| KV             | Cloudflare KV                      |
| ORM            | Drizzle                            |
| ホスティング   | Cloudflare Workers（api・web両方） |
| モノレポ       | bun workspaces + Turborepo         |
| データフェッチ | SWR（フロントエンド）              |

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

### GitHub push → ログ記録

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

### ユーザー認証フロー（GitHub OAuth）

```
ユーザーが web にアクセス
　↓
GET /api/auth/github → GitHub OAuth 認可画面へリダイレクト
　↓
GitHub でログイン・許可
　↓
GET /api/auth/github/callback → アクセストークン取得・暗号化してDB保存
　↓
署名付き httpOnly cookie（github_user）をセット
　↓
フロントに githubLogin をクエリパラメータで渡してリダイレクト
```

---

## 意思決定の記録

設計上の意思決定（なぜそう決めたか・却下した選択肢）は [`docs/decisions.md`](./decisions.md) を参照。
