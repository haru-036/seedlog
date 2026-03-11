# 意思決定記録（ADR）

Architecture Decision Recordsの一覧。
「なぜそう決めたか」「何を却下したか」を残しておく。

---

## ADR-001: Discord botをGateway接続にしない

**日付:** 2026-03-10
**状況:** DiscordにDMを送りユーザーの返信を受け取る機能が必要だった。最初はGateway接続（WebSocket常時接続）を前提に設計していた。

**決定:** Discord REST API + Interactions Endpoint を使う。

**理由:**

- DMを送るだけならDiscord REST APIをHTTPで叩けば十分
- ユーザーからの返信はInteractions Endpoint（モーダル）で受け取れる
- サーバーレスで完結できるためCloudflare Workersで動かせる

**却下した選択肢:**

- Gateway接続（discord.js） → 常時起動が必要でCloudflare Workers不可。Railwayなどが必要になり構成が複雑になる
- Cloudflare Workers + Durable Objects → WebSocket維持は可能だが有料・難易度が高い

---

## ADR-002: ホスティングをCloudflareに統一する

**日付:** 2026-03-10
**状況:** バックエンドのホスティング先を決める必要があった。

**決定:** Cloudflare Workers（api・web両方）+ Cloudflare D1

**理由:**

- ADR-001でGateway接続を使わない決定をしたことで、常時起動が不要になりCloudflareで完結できるようになった
- HonoはCloudflare Workers向けに作られたフレームワークで相性◎
- webはCloudflare Workers Static Assetsを使う（Cloudflare Pagesより現在推奨）
- インフラを一箇所に集約できる

**却下した選択肢:**

- Railway → Discord botのGateway接続が必要だった時の候補。設計変更により不要になった

---

## ADR-003: ORMはDrizzleを使う

**日付:** 2026-03-10
**状況:** Cloudflare D1を使うにあたりORMを選定する必要があった。

**決定:** Drizzle

**理由:**

- Cloudflare D1にネイティブ対応している
- スキーマをTypeScriptで書けるので `schema/` との型共有がしやすい

**却下した選択肢:**

- Prisma → エッジランタイムでのD1サポートが不安定

---

## ADR-004: webhookはユーザー単位で管理する

**日付:** 2026-03-10
**状況:** GitHubのwebhookをリポジトリ単位で管理するかユーザー単位で管理するか決める必要があった。

**決定:** ユーザー単位

**理由:**

- リポジトリごとに登録する手間をなくしてオンボーディングの摩擦を最小にする
- MVPとしてシンプルな設計を優先する

**却下した選択肢:**

- リポジトリ単位 → 細かく制御できるが、登録の手間が増える。必要になったら後から追加できる

---

## ADR-005: 1pushにつき質問は1つ生成する

**日付:** 2026-03-10
**状況:** 複数ファイルを変更した場合に質問を複数生成するか1つにするか決める必要があった。

**決定:** 1pushにつき1質問

**理由:**

- 複数質問が来ると回答の負荷が上がり、返信しなくなるリスクがある
- まず動くものを作って質問の質は使いながら改善する方針

**却下した選択肢:**

- 複数質問 → ファイルごとに質問を生成する。回答負荷が高くなるためMVPでは見送り

---

## ADR-006: Webhook登録状態の管理にCloudflare KVを使う

**日付:** 2026-03-11
**状況:** リポジトリ一覧ページでWebhook登録済みかどうかを初期表示するため、登録情報をサーバー側で永続化する必要があった。

**決定:** Cloudflare KV に `webhooks:{userId}` キーで `{ repo: string, hookId: number | null }[]` を保存する。

**理由:**

- DB（D1）にテーブルを追加すると migration が必要になり、スキーマ管理が複雑になる
- Webhook の登録・参照はユーザー単位で完結するため、KV の key-value 構造で十分
- hookId も保存することで将来の解除機能（`DELETE /repos/{owner}/{repo}/hooks/{hookId}`）に対応できる
- KV はセットアップが簡単で、Drizzle のスキーマ定義・migration 不要

**却下した選択肢:**

- D1 に webhooks テーブルを追加 → migration が必要・スキーマ管理コストが増える。hookId のような軽量データには過剰
- フロントエンドのみで管理（localStorage 等） → サーバー側に永続化されないため、他デバイス・再ログイン後に状態が消える

---

## ADR-007: リポジトリ一覧はページネーション方式にする

**日付:** 2026-03-11
**状況:** GitHub API からリポジトリ一覧を取得する際に、当初は全件ループ取得（Link ヘッダーで next を辿る while ループ）していた。

**決定:** クライアント指定のページネーション方式に変更（`page` / `per_page` クエリパラメータ）。

**理由:**

- 全件ループはリポジトリ数が多いユーザーで Workers の CPU 時間・レイテンシが増大する
- フロントで前へ/次へのページ遷移を実装することでユーザーが必要なページだけ取得できる
- デフォルト 20 件にすることで初期ロードが速くなる

**却下した選択肢:**

- 全件ループ取得（実装済みだったが変更）→ リポジトリ数が多いユーザーでパフォーマンス問題が発生しうる
