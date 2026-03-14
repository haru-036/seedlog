import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import type {
  Repo,
  ReposResponse,
  WebhooksListResponse
} from "@seedlog/schema";
import { webhookMutationResponseSchema } from "@seedlog/schema";
import { apiFetch, API_BASE, fetcher } from "../lib/api";
import { Lock } from "lucide-react";

type WebhookStatus =
  | "idle"
  | "loading"
  | "unregistering"
  | "done"
  | "exists"
  | "error";

function RepoItem({
  repo,
  isRegistered
}: {
  repo: Repo;
  isRegistered: boolean;
}) {
  const [status, setStatus] = useState<WebhookStatus>(
    isRegistered ? "done" : "idle"
  );

  async function registerWebhook() {
    setStatus("loading");
    try {
      const res = await apiFetch("/api/webhooks/register", {
        method: "POST",
        body: JSON.stringify({ repo: repo.fullName })
      });

      const raw = await res.json();
      const parsed = webhookMutationResponseSchema.safeParse(raw);
      if (!res.ok) {
        console.error(raw);
        setStatus("error");
        return;
      }

      if (!parsed.success) {
        console.error("Webhook 登録レスポンス形式が不正です", parsed.error);
        setStatus("error");
        return;
      }

      const data = parsed.data;
      const newStatus = data.message?.includes("すでに") ? "exists" : "done";
      setStatus(newStatus);
      await mutate("/api/webhooks");
    } catch (err) {
      console.error("Webhook 登録に失敗しました:", err);
      setStatus("error");
    }
  }

  async function unregisterWebhook() {
    const shouldUnregister = window.confirm(
      `${repo.fullName} の Webhook 登録を解除しますか？`
    );
    if (!shouldUnregister) return;

    setStatus("unregistering");
    try {
      const res = await apiFetch("/api/webhooks/unregister", {
        method: "DELETE",
        body: JSON.stringify({ repo: repo.fullName })
      });

      const raw = await res.json();
      const parsed = webhookMutationResponseSchema.safeParse(raw);
      if (!res.ok) {
        console.error(raw);
        setStatus("error");
        return;
      }

      if (!parsed.success) {
        console.error("Webhook 解除レスポンス形式が不正です", parsed.error);
        setStatus("error");
        return;
      }

      setStatus("idle");
      await mutate("/api/webhooks");
    } catch (err) {
      console.error("Webhook 解除に失敗しました:", err);
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg">
      <div className="min-w-0">
        <p className="text-foreground font-medium truncate">{repo.fullName}</p>
        {repo.description && (
          <p className="text-muted-foreground text-sm truncate">
            {repo.description}
          </p>
        )}
        <p className="text-muted-foreground text-xs mt-0.5">
          {repo.private ? (
            <span>
              <Lock className="size-4 inline-block mr-1" />
              Private
            </span>
          ) : (
            "🌐 Public"
          )}
        </p>
      </div>
      <div className="ml-4 shrink-0">
        {status === "idle" && (
          <button
            onClick={registerWebhook}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-500 transition-colors"
          >
            Webhook 登録
          </button>
        )}
        {status === "loading" && (
          <span className="text-sm text-muted-foreground">登録中...</span>
        )}
        {status === "unregistering" && (
          <span className="text-sm text-muted-foreground">解除中...</span>
        )}
        {(status === "done" || status === "exists") && (
          <div className="flex items-center gap-3">
            <span
              className={`text-sm ${status === "exists" ? "text-yellow-400" : "text-green-400"}`}
            >
              {status === "exists" ? "⚠️ 既に登録済み" : "✅ 登録済み"}
            </span>
            <button
              onClick={unregisterWebhook}
              className="text-sm bg-neutral-800 text-neutral-200 px-3 py-1.5 rounded hover:bg-neutral-700 transition-colors"
            >
              解除
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2">
            <button
              onClick={registerWebhook}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-500 transition-colors"
            >
              登録を再試行
            </button>
            {isRegistered && (
              <button
                onClick={unregisterWebhook}
                className="text-sm bg-neutral-800 text-neutral-200 px-3 py-1.5 rounded hover:bg-neutral-700 transition-colors"
              >
                解除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReposPage() {
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [_discordBotInstallFlag, setDiscordBotInstallFlag] = useState<
    string | null
  >(null);
  const [discordDmDeliverable, setDiscordDmDeliverable] = useState<
    string | null
  >(null);
  const [discordDmReason, setDiscordDmReason] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setGithubLogin(localStorage.getItem("githubLogin"));
    const username = localStorage.getItem("discordUsername");
    setDiscordUsername(username);
    setDiscordBotInstallFlag(localStorage.getItem("discordBotInstalled"));
    setDiscordDmDeliverable(localStorage.getItem("discordDmDeliverable"));
    setDiscordDmReason(localStorage.getItem("discordDmReason"));
  }, []);

  const reposQuery = query.trim();
  const params = new URLSearchParams({
    page: String(page),
    per_page: "20"
  });
  if (reposQuery.length > 0) {
    params.set("query", reposQuery);
  }

  const { data, error, isLoading } = useSWR<ReposResponse>(
    `/api/repos?${params.toString()}`,
    fetcher
  );
  const { data: webhooksData } = useSWR<WebhooksListResponse>(
    "/api/webhooks",
    fetcher
  );

  const repos = data?.repos ?? [];
  const registeredSet = new Set(webhooksData?.repos ?? []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🌱 Seedlog</h1>
        <div className="flex items-center gap-4">
          {githubLogin && (
            <span className="text-sm text-muted-foreground">
              @{githubLogin}
            </span>
          )}
          {discordUsername ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Discord: {discordUsername}
              </span>
              {discordDmDeliverable === "1" && (
                <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded">
                  DM受信可能
                </span>
              )}
              {discordDmDeliverable === "0" && (
                <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">
                  DM受信不可
                </span>
              )}
            </div>
          ) : null}
          <a
            href={`${API_BASE}/api/auth/discord`}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors"
          >
            {discordUsername ? "Discord 再連携" : "Discord 連携"}
          </a>
          {discordUsername && (
            <a
              href={`${API_BASE}/api/auth/discord/install`}
              className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-500 transition-colors"
            >
              Bot をサーバーに追加
            </a>
          )}
        </div>
      </header>

      {discordUsername && discordDmDeliverable === "0" && (
        <div className="max-w-2xl mx-auto px-6 pt-4">
          <p className="text-sm text-red-300">
            DMを送信できませんでした（
            {discordDmReason === "blocked_or_closed"
              ? "DM受信設定またはBotブロック"
              : "不明なエラー"}
            ）。Discord 再連携で再チェックできます。
          </p>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">リポジトリ選択</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Webhook を登録するリポジトリを選んでください。push
            されると自動で質問が届きます。
          </p>
        </div>

        <div>
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="リポジトリ名で検索"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {isLoading && <p className="text-neutral-400 text-sm">読み込み中...</p>}
        {error && (
          <p className="text-red-400 text-sm">リポジトリの取得に失敗しました</p>
        )}
        {!isLoading && !error && repos.length === 0 && (
          <p className="text-neutral-400 text-sm">
            {reposQuery
              ? "検索条件に一致するリポジトリが見つかりませんでした。"
              : "リポジトリが見つかりませんでした。"}
          </p>
        )}

        <div className="space-y-2">
          {repos.map((repo) => {
            const isRegistered = registeredSet.has(repo.fullName);
            return (
              <RepoItem
                key={`${repo.fullName}-${String(isRegistered)}`}
                repo={repo}
                isRegistered={isRegistered}
              />
            );
          })}
        </div>

        {!isLoading && !error && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm px-3 py-1.5 rounded bg-neutral-800 text-neutral-300 disabled:opacity-40 hover:bg-neutral-700 transition-colors"
            >
              ← 前へ
            </button>
            <span className="text-sm text-neutral-500">{page} ページ</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.hasNextPage}
              className="text-sm px-3 py-1.5 rounded bg-neutral-800 text-neutral-300 disabled:opacity-40 hover:bg-neutral-700 transition-colors"
            >
              次へ →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
