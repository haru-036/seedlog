import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import type {
  Repo,
  ReposResponse,
  WebhooksListResponse
} from "@seedlog/schema";
import { apiFetch, API_BASE, fetcher } from "../lib/api";

type WebhookStatus = "idle" | "loading" | "done" | "exists" | "error";

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

  useEffect(() => {
    setStatus((prev) => {
      // 登録済みに変化したときだけ "done" に更新する（ユーザー操作中は上書きしない）
      if (isRegistered && prev === "idle") return "done";
      if (!isRegistered && prev === "done") return "idle";
      return prev;
    });
  }, [isRegistered]);

  async function registerWebhook() {
    setStatus("loading");
    try {
      const res = await apiFetch("/api/webhooks/register", {
        method: "POST",
        body: JSON.stringify({ repo: repo.fullName })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: { code: string; message: string };
      };
      if (!res.ok) {
        console.error(data.error);
        setStatus("error");
        return;
      }
      const newStatus = data.message?.includes("すでに") ? "exists" : "done";
      setStatus(newStatus);
      await mutate("/api/webhooks");
    } catch (err) {
      console.error("Webhook 登録に失敗しました:", err);
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
      <div className="min-w-0">
        <p className="text-white font-medium truncate">{repo.fullName}</p>
        {repo.description && (
          <p className="text-gray-400 text-sm truncate">{repo.description}</p>
        )}
        <p className="text-gray-500 text-xs mt-0.5">
          {repo.private ? "🔒 Private" : "🌐 Public"}
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
          <span className="text-sm text-gray-400">登録中...</span>
        )}
        {status === "done" && (
          <span className="text-sm text-green-400">✅ 登録済み</span>
        )}
        {status === "exists" && (
          <span className="text-sm text-yellow-400">⚠️ 既に登録済み</span>
        )}
        {status === "error" && (
          <button
            onClick={registerWebhook}
            className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-500 transition-colors"
          >
            失敗（再試行）
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReposPage() {
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setGithubLogin(localStorage.getItem("githubLogin"));
  }, []);

  const { data, error, isLoading } = useSWR<ReposResponse>(
    `/api/repos?page=${page}&per_page=20`,
    fetcher
  );
  const { data: webhooksData } = useSWR<WebhooksListResponse>(
    "/api/webhooks",
    fetcher
  );

  const repos = data?.repos ?? [];
  const registeredSet = new Set(webhooksData?.repos ?? []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🌱 Seedlog</h1>
        <div className="flex items-center gap-4">
          {githubLogin && (
            <span className="text-sm text-gray-400">@{githubLogin}</span>
          )}
          <a
            href={`${API_BASE}/api/auth/discord`}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors"
          >
            Discord 連携
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">リポジトリ選択</h2>
          <p className="text-gray-400 text-sm mt-1">
            Webhook を登録するリポジトリを選んでください。push
            されると自動で質問が届きます。
          </p>
        </div>

        {isLoading && <p className="text-gray-400 text-sm">読み込み中...</p>}
        {error && (
          <p className="text-red-400 text-sm">リポジトリの取得に失敗しました</p>
        )}
        {!isLoading && !error && repos.length === 0 && (
          <p className="text-gray-400 text-sm">
            リポジトリが見つかりませんでした。
          </p>
        )}

        <div className="space-y-2">
          {repos.map((repo) => (
            <RepoItem
              key={repo.fullName}
              repo={repo}
              isRegistered={registeredSet.has(repo.fullName)}
            />
          ))}
        </div>

        {!isLoading && !error && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm px-3 py-1.5 rounded bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              ← 前へ
            </button>
            <span className="text-sm text-gray-500">{page} ページ</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.hasNextPage}
              className="text-sm px-3 py-1.5 rounded bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              次へ →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
