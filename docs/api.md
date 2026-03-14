# API仕様

ベースURL: `https://seedlog-api.harurahu.workers.dev`

`🔒` のついているエンドポイントは署名付き Cookie (`github_user`) による認証が必要。

> **認証について**: GitHub OAuth と Discord OAuth で連携・登録。`🔒` のエンドポイントは `github_user` Cookie に基づいて current user を解決する。

---

## ユーザー

### `POST /api/users` ✅ 実装済み

ユーザーを登録する。GitHub OAuth 経由の自動作成が主な登録経路だが、直接呼び出しも可能。

**Request**

```typescript
{
  discordId?: string;  // Discord ユーザーID（省略可。Discord OAuth 連携後に紐付け）
  githubLogin: string; // GitHub ユーザー名（必須）
}
```

**Response** `201 Created`

```typescript
{
  id: string; // nanoid() で生成される21文字のURL-safeな一意識別子
  discordId: string | null; // Discord 未連携の場合は null
  githubLogin: string;
  createdAt: string; // ISO 8601
}
```

**Error Responses**

- `409 Conflict` — discordId または githubLogin がすでに登録済み
  ```json
  {
    "error": {
      "code": "CONFLICT",
      "message": "discordIdはすでに登録されています"
    }
  }
  ```
- `400 Bad Request` — バリデーションエラー

### `GET /api/users/:id` ✅ 実装済み

ユーザー情報を取得。

**Response** `200 OK`

```typescript
{
  id: string;
  discordId: string | null; // Discord 未連携の場合は null
  githubLogin: string;
  createdAt: string; // ISO 8601
}
```

**Error Responses**

- `404 Not Found`
  ```json
  { "error": { "code": "NOT_FOUND", "message": "ユーザーが見つかりません" } }
  ```

---

## GitHub Webhook

### `POST /api/webhooks/github` ✅ 実装済み

GitHubからのpushイベントを受け取る。

**Headers**

```
X-Hub-Signature-256: sha256=<signature>
X-GitHub-Event: push
```

**処理の流れ**

1. `X-Hub-Signature-256` で HMAC-SHA256 署名を検証（`GITHUB_WEBHOOK_SECRET`）
2. `push` 以外のイベントは無視して 200 を返す
3. `pusher.name`（githubLogin）でユーザーを検索（未登録ユーザーは無視）
4. push内の `author` / `committer` / `pusher` を見て、対象ユーザーが関与した変更のみ処理
5. コミットの `added` + `modified` ファイル一覧を抽出し questions テーブルに保存

> `questionText` は現在 `"AI生成予定"` のプレースホルダー。#4 AI質問生成実装後に差し替え予定。

**Error Responses**

- `401 Unauthorized` — 署名が無効
  ```json
  { "error": { "code": "UNAUTHORIZED", "message": "署名が無効です" } }
  ```

---

## Discord連携

### `GET /api/auth/discord` ✅ 実装済み

Discord OAuth 認証フローを開始する（サーバー追加画面はこの時点では表示しない）。

**処理の流れ**

1. CSRF 対策用のランダム state を生成し `discord_oauth_state` cookie にセット（httpOnly, Secure, SameSite=Lax, 5分）
2. Discord の OAuth 認可画面へリダイレクト（scope: `identify guilds`）

**レスポンス**

- `302 Redirect` → Discord 認可画面

---

### `GET /api/auth/discord/install` ✅ 実装済み

Discord Bot をサーバーに追加するための招待フローを開始する。

**処理の流れ**

1. Discord OAuth 認可画面へリダイレクト（scope: `bot`, permissions: `2048`）

**レスポンス**

- `302 Redirect` → Discord Bot 招待画面

---

### `GET /api/auth/discord/callback` ✅ 実装済み

Discord OAuth コールバックを受け取り、ユーザー連携を確定する。

**処理の流れ（抜粋）**

1. CSRF state を検証
2. code でアクセストークン交換
3. Discord ユーザー情報を取得
4. `github_user` Cookie に紐づくユーザーへ `discordId` を保存
5. ユーザーが管理可能なサーバーに Bot が導入済みか判定
6. フロントへリダイレクト

**成功レスポンス**

- `302 Redirect` → `${FRONTEND_URL}/auth/discord/callback?code=<one-time-code>&needsBotInstall=<0|1>&dmDeliverable=<0|1>&dmReason=<reason>`

`needsBotInstall=1` の場合は、別途 `GET /api/auth/discord/install` で Bot 招待が必要。

`dmDeliverable` は OAuth 完了時にテストDMを実送信して判定される。

- `dmDeliverable=1` : 現時点でDM到達可能
- `dmDeliverable=0` : 現時点でDM到達不可

`dmReason` は以下のいずれか。

- `ok` : 送達成功
- `blocked_or_closed` : ユーザー側DM受信設定またはBotブロックの可能性
- `unknown_error` : 一時障害など判別不能な失敗

---

## GitHub連携

### `GET /api/auth/github` ✅ 実装済み

GitHub OAuth 認証フローを開始する。

**処理の流れ**

1. CSRF 対策用のランダム state を生成し `github_oauth_state` cookie にセット（httpOnly, Secure, SameSite=Lax, 5分）
2. GitHub の OAuth 認可画面へリダイレクト（scope: `repo read:org admin:repo_hook read:user`）

**必要な環境変数**

- `GITHUB_CLIENT_ID`, `GITHUB_REDIRECT_URI`

**レスポンス**

- `302 Redirect` → GitHub 認可画面

---

### `GET /api/auth/github/callback` ✅ 実装済み

GitHub OAuth コールバックを受け取る。

**Query Parameters**

```http
code?: string
state?: string
error?: string
```

**処理の流れ**

1. CSRF state の検証（`github_oauth_state` Cookie と比較）
2. GitHub に code でアクセストークンを交換
3. GitHub ユーザー情報（login）を取得
4. DB の users テーブルから githubLogin でユーザーを検索し、未登録なら自動作成
5. `githubAccessToken` を暗号化して DB に保存
6. 署名付き `github_user` Cookie をセット（30日間有効）
7. フロントエンドへリダイレクト

**必要な環境変数**

- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`, `FRONTEND_URL`
- `GITHUB_TOKEN_ENCRYPTION_KEY`, `COOKIE_SECRET`

**成功レスポンス**

- `302 Redirect` → `${FRONTEND_URL}/auth/github/callback?githubLogin=<login>`

### `GET /api/auth/me` ✅ 実装済み 🔒

現在ログイン中ユーザーを取得する。

**Response** `200 OK`

```typescript
{
  id: string;
  discordId: string | null;
  githubLogin: string;
  createdAt: string; // ISO 8601
}
```

**Error Responses**

- `401 Unauthorized` — `github_user` Cookie が未設定または不正
- `404 Not Found` — Cookie に対応するユーザーが存在しない

**エラーレスポンス**

- `302 Redirect` → `${FRONTEND_URL}/auth/error?reason=<reason>`
  - `reason=state_mismatch` — CSRF 検証失敗
  - `reason=token_exchange` — GitHub のトークン交換失敗
  - `reason=user_fetch` — GitHub ユーザー情報取得失敗

---

### `GET /api/repos` ✅ 実装済み

ログイン済みユーザーの GitHub リポジトリ一覧を取得する。フロントエンドでリポジトリを選択し、`POST /api/webhooks/register` に渡すために使用する。

**認証**

`github_user` 署名済み Cookie（GitHub OAuth ログイン後に自動セット）

**Query Parameters**

| パラメータ | 型     | デフォルト | 説明                                  |
| ---------- | ------ | ---------- | ------------------------------------- |
| `page`     | number | `1`        | ページ番号（1始まり）                 |
| `per_page` | number | `20`       | 1ページあたりの件数（最大 100）       |
| `query`    | string | なし       | 部分一致検索キーワード（最大100文字） |

**Response** `200 OK`

```typescript
{
  repos: {
    name: string; // リポジトリ名
    fullName: string; // "owner/repo" 形式
    private: boolean;
    description: string | null;
    updatedAt: string; // ISO 8601
  }
  [];
  hasNextPage: boolean; // 次のページが存在するか
  incomplete?: boolean; // true の場合は検索結果が上限で打ち切られている
  message?: string; // incomplete=true のときの補足メッセージ
}
```

**取得条件**

- affiliation=owner,collaborator,organization_member（オーナー・コラボレータ・組織所属リポジトリ）
- organisation リポジトリは `permissions.admin=true`（認証ユーザーが admin 権限を持つもの）のみを返却
- sort=updated（最終更新順）
- `query` 指定時は `name` / `fullName` / `description` を対象にサーバー側で部分一致検索し、検索結果に対して `page` / `per_page` を適用
- `query` 指定時の走査は最大 5000 件（100件 × 50ページ）。上限に達しても続きがある場合、`incomplete: true` が返る

**Error Responses**

- `401 Unauthorized` — 未ログイン、または GitHub 未連携
- `404 Not Found` — ユーザーが見つからない
- `502 Bad Gateway` — GitHub API エラー

---

### `GET /api/webhooks` ✅ 実装済み

ログイン済みユーザーが Webhook 登録済みのリポジトリ一覧を返す。フロントエンドでの初期表示に使用する。

**認証**

`github_user` 署名済み Cookie（GitHub OAuth ログイン後に自動セット）

**Response** `200 OK`

```typescript
{
  repos: string[]; // 登録済みリポジトリの fullName 一覧（"owner/repo" 形式）
}
```

**Error Responses**

- `401 Unauthorized` — 未ログイン
- `404 Not Found` — ユーザーが見つからない

---

### `POST /api/webhooks/register` ✅ 実装済み

指定リポジトリに GitHub Webhook を自動登録する。

**Request**

```typescript
{
  repo: string; // "owner/repo" 形式（認証ユーザーは github_user 署名済み Cookie から解決）
}
```

**処理の流れ**

1. `github_user` cookie から認証済みユーザーの GitHub login を解決
2. DB の users テーブルから githubLogin でユーザーを検索し、暗号化された `githubAccessToken` を取得・復号
3. GitHub API `POST /repos/{owner}/{repo}/hooks` を呼び出し
4. Webhook URL: `GITHUB_WEBHOOK_URL`、イベント: `push`、署名: `GITHUB_WEBHOOK_SECRET`

**必要な環境変数**

- `GITHUB_WEBHOOK_URL`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`

**Response** `201 Created`

```typescript
{
  ok: true;
  hookId: number | null; // 新規登録時は GitHub の hook ID、既存確認に失敗した場合は null
}
```

**Error Responses**

- `401 Unauthorized` — `github_user` cookie が未設定、または GitHub 未連携（githubAccessToken が未設定）
- `404 Not Found` — ユーザーが見つからない
- `200 OK` — すでに同じ Webhook が登録済み（`{ ok: true, message: "webhookはすでに登録済みです" }`）
- `422 Unprocessable Entity` — GitHub API バリデーションエラー（重複以外）
- `500 Internal Server Error` — `GITHUB_WEBHOOK_SECRET` が未設定
- `502 Bad Gateway` — GitHub API エラー

---

### `DELETE /api/webhooks/unregister` ✅ 実装済み

指定リポジトリの GitHub Webhook 登録を解除する。

**Request**

```typescript
{
  repo: string; // "owner/repo" 形式（認証ユーザーは github_user 署名済み Cookie から解決）
}
```

**処理の流れ**

1. `github_user` cookie から認証済みユーザーの GitHub login を解決
2. KV に保存された対象 repo の webhook record を取得
3. `hookId` がある場合のみ GitHub API `DELETE /repos/{owner}/{repo}/hooks/{hookId}` を呼び出し
4. GitHub 側が 404 または `hookId` が null の場合も、KV 上の登録記録は削除する

**Response** `200 OK`

```typescript
{
  ok: true;
}
```

**Error Responses**

- `401 Unauthorized` — `github_user` cookie が未設定、または GitHub 未連携（githubAccessToken が未設定）
- `404 Not Found` — ユーザーまたは対象 webhook record が見つからない
- `502 Bad Gateway` — GitHub API エラー

---

## Discord Interactions

### `POST /api/interactions` ✅ 実装済み

DiscordからのInteractions（ボタン・モーダル返信・スラッシュコマンド）を受け取る。

**Headers**

```
X-Signature-Ed25519: <signature>
X-Signature-Timestamp: <timestamp>
```

**処理の流れ**

1. Ed25519署名を検証（`DISCORD_PUBLIC_KEY`）
2. `PING` に `PONG` を返す（Discord Endpoint URL検証用）
3. ボタンクリック（`open_reply_modal:<questionId>`）→ 振り返りモーダルを表示
4. モーダル送信（`question_reply:<questionId>`）→ logsテーブルに保存（`source: 'discord_reply'`、`repo` は question の `githubRepo` を引き継ぐ）、questionの`answeredAt`を更新
5. `/log` コマンドのモーダル送信（`log_entry`）→ logsテーブルに保存（`source: 'discord_command'`）

**Error Responses**

- `401 Unauthorized` — 署名が無効
  ```json
  { "error": { "code": "UNAUTHORIZED", "message": "署名が無効です" } }
  ```

---

## ログ

### `GET /api/logs` ✅ 実装済み 🔒

ログ一覧を取得。

**Query Parameters**

```
source?: 'github_push' | 'discord_reply' | 'discord_command' | 'web'
limit?: number（デフォルト20）
offset?: number
```

**Response**

```typescript
{
  logs: {
    id: string;
    userId: string;
    questionId: string | null;
    repo: string | null; // "owner/repo"（手動ログは null）
    content: string;
    source: "github_push" | "discord_reply" | "discord_command" | "web";
    createdAt: string; // ISO 8601
  }
  [];
  total: number;
  hasMore: boolean;
}
```

### `POST /api/logs` ✅ 実装済み 🔒

手動でログを追加（WebアプリとDiscordコマンド共通）。

**Request**

```typescript
{
  content: string;
  source?: "discord_command" | "web"; // 省略時は "web"
  repo?: string | null; // "owner/repo" 形式 or null
}
```

**Response** `201 Created`

```typescript
{
  id: string;
  userId: string;
  questionId: null;
  repo: string | null;
  content: string;
  source: "discord_command" | "web";
  createdAt: string; // ISO 8601
}
```

**Error Responses**

- `401 Unauthorized` — 未認証
- `400 Bad Request` — 入力バリデーションエラー（例: repo が owner/repo 形式ではない）

### `GET /api/logs/:id` 🔒

ログの詳細を取得。

### `PUT /api/logs/:id` 🔒

ログの内容を編集。

**Request**

```typescript
{
  content: string;
}
```

### `DELETE /api/logs/:id` 🔒

ログを削除。

---

## エピソード

### `POST /api/episodes` ✅ 実装済み 🔒

過去のログをAIで整理・要約して返す。「LTネタまとめて」などのプロンプトに応答する。

**Request**

```typescript
{
  prompt: string; // 例: "LTネタまとめて"、"今月の成長まとめて"
}
```

**Response** `200 OK`

```typescript
{
  episode: string; // AIが生成した要約テキスト
}
```

**処理の流れ**

1. `github_user` Cookie から current user を解決
2. そのユーザーの全ログを取得（`createdAt` 昇順）
3. ログ内容 + ユーザーのプロンプトを Gemini に渡して要約生成
4. 生成結果を `episodes` テーブルへ保存（`userId`, `prompt`, `content`）
5. 生成結果を返す（Gemini エラー時はフォールバックメッセージを返す）

**必要な環境変数**

- `GEMINI_API_KEY`

**Error Responses**

- `401 Unauthorized` — 未認証
- `422 Unprocessable Entity` — ログが0件
  ```json
  {
    "error": {
      "code": "NO_LOGS",
      "message": "ログがまだありません。ログを記録してからお試しください。"
    }
  }
  ```
