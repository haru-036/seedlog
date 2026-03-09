# Seedlog — プロジェクトガイド

## 構成

Bun + Turborepo によるモノレポ構成。

```
seedlog/
├── api/          # Hono API → Cloudflare Workers
├── web/          # Vite + React → Cloudflare Pages
├── schema/       # 共通 Zod スキーマ (@seedlog/schema)
├── turbo.json
└── package.json
```

## よく使うコマンド

```sh
bun install          # 全パッケージの依存関係をインストール
bun run dev          # 全パッケージを並列で開発起動
bun run build        # 全パッケージをビルド（依存順）
bun run type-check   # 全パッケージの型チェック
bun run fmt          # コードフォーマット（oxfmt）
bun run fmt:check    # フォーマットチェックのみ（CI用）
bun run lint         # リント（oxlint）
```

各パッケージ単体で実行する場合は `apps/api` や `apps/web` に移動してから実行。

## 各パッケージの詳細

### packages/schema (`@seedlog/schema`)

- フロントとバックエンドで共有する Zod スキーマを定義する
- 型は `z.infer<typeof schema>` で自動導出
- 新しいエンティティを追加するときはここに追加する

```ts
import { z } from "zod";

export const exampleSchema = z.object({ ... });
export type Example = z.infer<typeof exampleSchema>;
```

### apps/api (Hono + Cloudflare Workers)

- ランタイムは Cloudflare Workers
- `export default app` でエントリポイントを公開する（`Bun.serve()` は使わない）
- バリデーションは `@hono/zod-validator` + `@seedlog/schema` を使う
- `wrangler.jsonc` で Workers の設定を管理

```sh
bun run dev      # wrangler dev でローカル起動
bun run deploy   # wrangler deploy で本番デプロイ
```

### apps/web (Vite + React + Tailwind CSS → Cloudflare Pages)

- Tailwind CSS v4（`tailwind.config.js` 不要、`@import "tailwindcss"` のみ）
- スキーマの型は `@seedlog/schema` から import して使う
- `wrangler.jsonc` で Pages の設定を管理

```sh
bun run dev      # Vite dev server 起動（port 5173）
bun run build    # 本番ビルド（dist/ に出力）
bun run deploy   # ビルド → wrangler pages deploy
```

## デプロイ

| パッケージ | サービス           | コマンド         |
| ---------- | ------------------ | ---------------- |
| apps/api   | Cloudflare Workers | `bun run deploy` |
| apps/web   | Cloudflare Pages   | `bun run deploy` |

初回は `wrangler login` で認証が必要。

## 開発ルール

- **型は必ず `@seedlog/schema` で一元管理** — フロント・バックで同じ型を使う
- **`any` は使わない** — strict モードを維持する
- **新しいパッケージマネージャーは使わない** — Bun のみ（`npm` / `yarn` / `pnpm` 禁止）
- **フロントのフレームワーク追加時は Vite プラグイン経由** — `@tailwindcss/vite` のように
