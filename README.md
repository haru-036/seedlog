# Seedlog

## 技術スタック

| レイヤー       | 技術                                                |
| -------------- | --------------------------------------------------- |
| フロントエンド | Vite + React + TypeScript + Tailwind CSS v4         |
| バックエンド   | Hono (Cloudflare Workers)                           |
| 共通スキーマ   | Zod                                                 |
| ビルドシステム | Turborepo + Bun workspaces                          |
| デプロイ       | Cloudflare Workers (web) / Cloudflare Workers (api) |

## ディレクトリ構成

```
seedlog/
├── web/      # フロントエンド (port 5173)
├── api/      # バックエンド API (port 8787)
└── schema/   # フロント・バックで共有する Zod スキーマ
```

### 初回セットアップ

```sh
git clone <repository-url>
cd seedlog
bun install
```

### 開発サーバーの起動

全パッケージを一括起動する場合：

```sh
bun run dev
```

- フロントエンド: http://localhost:5173
- API: http://localhost:8787

担当パッケージだけを起動する場合：

```sh
# フロントエンドのみ
cd web && bun run dev

# API のみ
cd api && bun run dev
```

## よく使うコマンド

```sh
bun run dev          # 全パッケージを並列で開発起動
bun run build        # 全パッケージをビルド
bun run type-check   # 全パッケージの型チェック
bun run fmt          # コードフォーマット（oxfmt）
bun run lint         # リント（oxlint）
```

## スキーマの追加方法

フロントとバックで共有する型・バリデーションは `schema/src/index.ts` に追加します。

```ts
// schema/src/index.ts
import { z } from "zod";

export const mySchema = z.object({ ... });
export type MyType = z.infer<typeof mySchema>;
```

各パッケージから `@seedlog/schema` としてインポートできます。

```ts
import { mySchema, type MyType } from "@seedlog/schema";
```

## デプロイ

初回は Cloudflare アカウントへの認証が必要です。

```sh
cd api && bun run deploy   # Cloudflare Workers にデプロイ
cd web && bun run deploy   # Cloudflare Workers にデプロイ
```
