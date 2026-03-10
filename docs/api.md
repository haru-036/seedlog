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

### `POST /api/webhooks/github`

GitHubからのpushイベントを受け取る。

**Headers**

```
X-Hub-Signature-256: sha256=<signature>
X-GitHub-Event: push
```

**処理の流れ**

1. `X-Hub-Signature-256` でsignatureを検証
2. コミット情報（ファイル名・変更回数・コミットメッセージ）をAI（Gemini）に渡して質問を生成
3. Discord REST APIでユーザーにDMを送信
4. questionsテーブルに質問とDiscordメッセージIDを保存

---

## Discord連携

### `POST /api/interactions`

DiscordからのInteractions（モーダル返信・スラッシュコマンド）を受け取る。

**処理の流れ**

1. Discordのリクエスト署名を検証（`DISCORD_PUBLIC_KEY`）
2. `PING` リクエストに応答（Discord Endpoint URL検証用）
3. Modal Submitの返信内容をlogsテーブルに保存（`source: 'discord_command'` または `'github_push'` に紐づく返信）

---

## ログ

### `GET /api/logs` 🔒

ログ一覧を取得。

**Query Parameters**

```
userId: string（必須）
source?: 'github_push' | 'discord_command' | 'web'
limit?: number（デフォルト20）
offset?: number
```

**Response**

```typescript
{
  logs: {
    id: string;
    content: string;
    source: "github_push" | "discord_command" | "web";
    questionId: string | null; // 紐づくquestionのID（手動追加の場合はnull）
    createdAt: string;
  }
  [];
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
