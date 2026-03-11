# Seedlog — プロジェクトガイド

## 構成

Bun + Turborepo によるモノレポ構成。

```
seedlog/
├── api/          # Hono API → Cloudflare Workers
├── web/          # Vite + React → Cloudflare Workers (Static Assets)
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

各パッケージ単体で実行する場合は `api/` や `web/` に移動してから実行。

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

### api/ (Hono + Cloudflare Workers)

- ランタイムは Cloudflare Workers
- `export default app` でエントリポイントを公開する（`Bun.serve()` は使わない）
- バリデーションは `@hono/zod-validator` + `@seedlog/schema` を使う
- `wrangler.jsonc` で Workers の設定を管理

```sh
bun run dev         # wrangler dev でローカル起動
bun run cf-typegen  # CloudflareBindings 型を自動生成（シークレット追加後に必ず実行）
bun run deploy      # wrangler deploy で本番デプロイ
```

#### シークレット・バインディングの追加手順

**必ずこの順番で行うこと:**

1. `api/.dev.vars` にローカル用の値を追加する
2. `cd api && bun run cf-typegen` を実行して `CloudflareBindings` 型を自動生成する
3. `wrangler.jsonc` にバインディング（KV・D1 等）を追記する（シークレットは不要）
4. 本番環境には `wrangler secret put <KEY>` または Cloudflare ダッシュボードで設定する

**やってはいけないこと:**

- `bindings.d.ts` を手動で作成・編集する → `cf-typegen` で自動生成されるため不要

### web/ (Vite + React + Tailwind CSS → Cloudflare Workers Static Assets)

- Tailwind CSS v4（`tailwind.config.js` 不要、`@import "tailwindcss"` のみ）
- スキーマの型は `@seedlog/schema` から import して使う
- `@cloudflare/vite-plugin` で Cloudflare Workers にデプロイ
- `wrangler.jsonc` で Workers の設定を管理

```sh
bun run dev      # Vite dev server 起動（port 5173）
bun run build    # 本番ビルド（dist/ に出力）
bun run deploy   # ビルド → wrangler deploy
```

## デプロイ

| パッケージ | サービス                           | コマンド         |
| ---------- | ---------------------------------- | ---------------- |
| api/       | Cloudflare Workers                 | `bun run deploy` |
| web/       | Cloudflare Workers (Static Assets) | `bun run deploy` |

初回は `wrangler login` で認証が必要。

## 開発ルール

- **型は必ず `@seedlog/schema` で一元管理** — フロント・バックで同じ型を使う
- **`any` は使わない** — strict モードを維持する
- **新しいパッケージマネージャーは使わない** — Bun のみ（`npm` / `yarn` / `pnpm` 禁止）
- **フロントのフレームワーク追加時は Vite プラグイン経由** — `@tailwindcss/vite` のように
- **実装後はルートで `bun run check` を実行する** — フォーマット（oxfmt）+ リント（oxlint）を必ず確認する

## git・gh コマンドの実行ルール

`git commit` / `git push` / `gh issue create` など**リポジトリの状態を変更するコマンドは、必ず実行前にユーザーの承認を得ること**。

承認不要（読み取り専用）: `git status`, `git log`, `git diff`, `gh issue list` など。

## ドキュメント更新ルール

`docs/` 配下のファイルは以下のルールで管理する。

### いつ更新するか

| 変更内容                                           | 更新するファイル       |
| -------------------------------------------------- | ---------------------- |
| APIエンドポイントの追加・変更・削除                | `docs/api.md`          |
| DBスキーマの変更（テーブル・カラム）               | `docs/architecture.md` |
| 設計上の意思決定（なぜそうするか・何を却下したか） | `docs/decisions.md`    |
| 技術スタックの変更                                 | `docs/architecture.md` |

### docs/api.md

- エンドポイントを追加・変更したら **必ず同時に更新する**
- リクエスト/レスポンスの型はDBスキーマ（`api/src/db/schema.ts`）と一致させる
- 未実装・将来対応予定の機能は `> P2: 〜` のように注記する

### docs/decisions.md

- **ADR（Architecture Decision Record）形式** で書く
- 一度書いたADRは削除しない（変更した場合は新しいADRを追加して旧ADRに参照を書く）
- フォーマット:
  ```
  ## ADR-NNN: タイトル
  **日付:** YYYY-MM-DD
  **状況:** なぜこの決定が必要だったか
  **決定:** 何を決めたか
  **理由:** なぜそう決めたか
  **却下した選択肢:** 何を検討して却下したか
  ```

### docs/architecture.md

- 意思決定の詳細は書かない（decisions.mdに書く）
- 技術スタック表・構成図・データフローを最新に保つ
