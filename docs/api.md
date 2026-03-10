# API仕様

ベースURL: `https://seedlog-api.harurahu.workers.dev`

`🔒` のついているエンドポイントはリクエストに `userId` が必要（query parameter or request body）。

> **認証について**: MVPでは簡易認証（Discord ID + GitHub usernameの登録のみ）。OAuth認証はP2で対応予定。

---

## ユーザー

### `POST /api/users` ✅ 実装済み

ユーザーを登録する。Discord ID と GitHub username を紐付ける。

**Request**

```typescript
{
  discordId: string;  // Discord ユーザーID
  githubLogin: string; // GitHub ユーザー名
}
```

**Response** `201 Created`

```typescript
{
  id: string;        // nanoid() で生成される21文字のURL-safeな一意識別子
  discordId: string;
  githubLogin: string;
  createdAt: string; // ISO 8601
}
```

**Error Responses**

- `409 Conflict` — discordId または githubLogin がすでに登録済み
  ```json
  { "error": { "code": "CONFLICT", "message": "discordIdはすでに登録されています" } }
  ```
- `400 Bad Request` — バリデーションエラー

### `GET /api/users/:id` ✅ 実装済み

ユーザー情報を取得。

**Response** `200 OK`

```typescript
{
  id: string;
  discordId: string;
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
4. コミットの `added` + `modified` ファイル一覧を抽出し questions テーブルに保存

> `questionText` は現在 `"AI生成予定"` のプレースホルダー。#4 AI質問生成実装後に差し替え予定。

**Error Responses**

- `401 Unauthorized` — 署名が無効
  ```json
  { "error": { "code": "UNAUTHORIZED", "message": "署名が無効です" } }
  ```

---

## Discord連携

### `GET /api/auth/discord` ✅ 実装済み

Discord OAuth 認証フローを開始する。

**処理の流れ**

1. CSRF 対策用のランダム state を生成し `discord_oauth_state` cookie にセット（httpOnly, Secure, SameSite=Lax, 5分）
2. Discord の OAuth 認可画面へリダイレクト（scope: `identify bot`, permissions: `2048`）

**必要な環境変数**

- `DISCORD_CLIENT_ID`
- `DISCORD_REDIRECT_URI`

**レスポンス**

- `302 Redirect` → Discord 認可画面

---

### `GET /api/auth/discord/callback` ✅ 実装済み

Discord OAuth コールバックを受け取る。

**Query Parameters**

```
code?: string   — Discord が返す認可コード
error?: string  — エラー時（例: "access_denied"）
```

**処理の流れ**

1. `discord_oauth_state` cookie と返ってきた `state` を比較（CSRF検証）
2. Discord に code でアクセストークンを交換
3. Discord ユーザー情報（id, username）を取得
4. 一時トークン（nanoid, TTL 5分）を D1 に保存
5. フロントエンドへリダイレクト（`?code=<one-time-token>`）

**必要な環境変数**

- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`
- `FRONTEND_URL`

**成功レスポンス**

- `302 Redirect` → `${FRONTEND_URL}/auth/discord/callback?code=<one-time-token>`

**エラーレスポンス**

- `302 Redirect` → `${FRONTEND_URL}/auth/error?reason=<reason>`
  - `reason=access_denied` — ユーザーが認証を拒否
  - `reason=state_mismatch` — CSRF 検証失敗
  - `reason=token_exchange` — Discord のトークン交換失敗
  - `reason=user_fetch` — Discord ユーザー情報の取得失敗

---

### `GET /api/auth/discord/token` ✅ 実装済み

フロントエンドが one-time code を Discord ユーザーデータと交換するエンドポイント。

**Query Parameters**

```
code: string — /api/auth/discord/callback で受け取った one-time token
```

**Response** `200 OK`

```typescript
{
  discordId: string;
  discordUsername: string;
}
```

**Error Responses**

- `400 Bad Request` — code パラメーターが missing
- `404 Not Found` — コードが存在しない
- `410 Gone` — コードの有効期限切れ（TTL: 5分）

---

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
4. モーダル送信（`question_reply:<questionId>`）→ logsテーブルに保存（`source: 'discord_reply'`）、questionの`answeredAt`を更新
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
userId: string（必須）
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
    content: string;
    source: "github_push" | "discord_reply" | "discord_command" | "web";
    createdAt: string; // ISO 8601
  }[];
  total: number;
  hasMore: boolean;
}
```

### `POST /api/logs` 🔒

手動でログを追加（WebアプリとDiscordコマンド共通）。

**Request**

```typescript
{
  userId: string;
  content: string;
  source: "discord_command" | "web";
}
```

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

### `POST /api/episodes` 🔒

過去のログをAIで整理・要約して返す。「LTネタまとめて」などのプロンプトに応答する。

**Request**

```typescript
{
  userId: string;
  prompt: string; // 例: "LTネタまとめて"、"今月の成長まとめて"
}
```

**Response**

```typescript
{
  episode: string; // AIが生成した要約テキスト
}
```

 
