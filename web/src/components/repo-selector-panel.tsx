import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import type {
  Repo,
  ReposResponse,
  WebhooksListResponse
} from "@seedlog/schema";
import { webhookMutationResponseSchema } from "@seedlog/schema";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Lock,
  PanelsRightBottom,
  Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { apiFetch, fetcher } from "@/lib/api";

type RowStatus =
  | "idle"
  | "registering"
  | "unregistering"
  | "done"
  | "exists"
  | "error";

function RepoRow({
  repo,
  isRegistered
}: {
  repo: Repo;
  isRegistered: boolean;
}) {
  const [status, setStatus] = useState<RowStatus>(
    isRegistered ? "done" : "idle"
  );

  async function registerWebhook() {
    setStatus("registering");

    try {
      const res = await apiFetch("/api/webhooks/register", {
        method: "POST",
        body: JSON.stringify({ repo: repo.fullName })
      });

      const raw = await res.json();
      const parsed = webhookMutationResponseSchema.safeParse(raw);

      if (!res.ok || !parsed.success) {
        console.error(
          "Webhook登録に失敗しました",
          raw,
          parsed.success ? null : parsed.error
        );
        setStatus("error");
        return;
      }

      setStatus(parsed.data.message?.includes("すでに") ? "exists" : "done");
      await mutate("/api/webhooks");
    } catch (err) {
      console.error("Webhook登録中に例外が発生しました", err);
      setStatus("error");
    }
  }

  async function unregisterWebhook() {
    const shouldUnregister = window.confirm(
      `${repo.fullName} の通知連携を解除しますか？`
    );

    if (!shouldUnregister) {
      return;
    }

    setStatus("unregistering");

    try {
      const res = await apiFetch("/api/webhooks/unregister", {
        method: "DELETE",
        body: JSON.stringify({ repo: repo.fullName })
      });

      const raw = await res.json();
      const parsed = webhookMutationResponseSchema.safeParse(raw);

      if (!res.ok || !parsed.success) {
        console.error(
          "Webhook解除に失敗しました",
          raw,
          parsed.success ? null : parsed.error
        );
        setStatus("error");
        return;
      }

      setStatus("idle");
      await mutate("/api/webhooks");
    } catch (err) {
      console.error("Webhook解除中に例外が発生しました", err);
      setStatus("error");
    }
  }

  const effectiveRegistered =
    status === "done" || status === "exists" || isRegistered;

  return (
    <li className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/60 py-3 last:border-b-0">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={repo.fullName}
          >
            {repo.fullName}
          </p>
          {repo.private ? (
            <Badge
              variant="outline"
              className="h-auto items-center gap-1 rounded-full text-xs text-muted-foreground"
            >
              <Lock className="h-3 w-3" />
              Private
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-auto items-center gap-1 rounded-full text-xs text-muted-foreground"
            >
              <Globe className="h-3 w-3" />
              Public
            </Badge>
          )}
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">
          {repo.description?.trim() || "説明は設定されていません"}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        {!effectiveRegistered &&
          status !== "registering" &&
          status !== "error" && (
            <Button
              type="button"
              onClick={registerWebhook}
              size="xs"
              className="rounded-md bg-repo-action px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-repo-action-hover"
            >
              通知を有効化
            </Button>
          )}

        {(status === "done" || status === "exists" || effectiveRegistered) &&
          status !== "unregistering" && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {status === "exists" ? "登録済み" : "有効"}
              </span>
              <Button
                type="button"
                onClick={unregisterWebhook}
                variant="outline"
                size="xs"
                className="px-3 text-xs"
              >
                解除
              </Button>
            </div>
          )}

        {(status === "registering" || status === "unregistering") && (
          <span className="text-xs text-muted-foreground">
            {status === "registering" ? "反映中..." : "解除中..."}
          </span>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            <Button
              type="button"
              onClick={
                effectiveRegistered ? unregisterWebhook : registerWebhook
              }
              variant="link"
              size="xs"
              className="h-auto p-0 text-xs text-destructive"
            >
              再試行
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

export function RepoSelectorPanel() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const reposQuery = query.trim();
  const params = new URLSearchParams({
    page: String(page),
    per_page: "12"
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
  const normalizedRegistered = useMemo(() => {
    const unique = Array.from(new Set(webhooksData?.repos ?? []));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [webhooksData?.repos]);
  const registeredSet = useMemo(
    () => new Set(normalizedRegistered),
    [normalizedRegistered]
  );

  return (
    <Sheet>
      <Card className="border-border/70 bg-card/70 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.65)] backdrop-blur-sm">
        <CardHeader className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Integrations
            </p>
            <CardTitle className="text-base">通知対象リポジトリ</CardTitle>
          </div>

          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="xs">
              管理
              <PanelsRightBottom className="size-3.5" />
            </Button>
          </SheetTrigger>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">現在有効</p>
            <p className="text-sm font-semibold text-foreground">
              {normalizedRegistered.length} 件
            </p>
          </div>

          {normalizedRegistered.length > 0 ? (
            <ul className="space-y-1.5">
              {normalizedRegistered.slice(0, 3).map((repoName) => (
                <li key={repoName} className="truncate" title={repoName}>
                  <Badge
                    variant="secondary"
                    className="h-auto max-w-full justify-start overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs"
                  >
                    {repoName}
                  </Badge>
                </li>
              ))}
              {normalizedRegistered.length > 3 && (
                <li className="text-xs text-muted-foreground">
                  他 {normalizedRegistered.length - 3} 件
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              まだ通知対象がありません
            </p>
          )}
        </CardContent>
      </Card>

      <SheetContent
        side="right"
        className="w-full gap-0 border-border/70 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>通知対象リポジトリ</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <section className="space-y-3 border-b border-border/60 pb-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">現在有効</p>
              <p className="text-sm font-semibold text-foreground">
                {normalizedRegistered.length} 件
              </p>
            </div>

            {normalizedRegistered.length > 0 ? (
              <ul className="space-y-1.5">
                {normalizedRegistered.slice(0, 5).map((repoName) => (
                  <li key={repoName} className="truncate" title={repoName}>
                    <Badge
                      variant="secondary"
                      className="h-auto max-w-full justify-start overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs"
                    >
                      {repoName}
                    </Badge>
                  </li>
                ))}
                {normalizedRegistered.length > 5 && (
                  <li className="text-xs text-muted-foreground">
                    他 {normalizedRegistered.length - 5} 件
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                まだ通知対象がありません
              </p>
            )}
          </section>

          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                候補を比較
              </span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setPage(1);
                    setQuery(event.target.value);
                  }}
                  placeholder="owner/repo で検索"
                  className="pl-8"
                />
              </span>
            </label>

            <div className="min-h-0 flex-1 overflow-auto pr-1">
              {isLoading && (
                <p className="text-xs text-muted-foreground">読み込み中...</p>
              )}

              {error && (
                <div className="flex items-start gap-2 border-b border-border/60 pb-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>リポジトリ一覧の取得に失敗しました</p>
                </div>
              )}

              {!isLoading && !error && repos.length === 0 && (
                <p className="border-b border-dashed border-border pb-3 text-xs text-muted-foreground">
                  {reposQuery
                    ? "検索条件に一致するリポジトリがありません"
                    : "表示できるリポジトリがありません"}
                </p>
              )}

              {!error && repos.length > 0 && (
                <ul className="space-y-2">
                  {repos.map((repo) => (
                    <RepoRow
                      key={repo.fullName}
                      repo={repo}
                      isRegistered={registeredSet.has(repo.fullName)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {!isLoading && !error && (
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <Button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="xs"
                >
                  前へ
                </Button>

                <span className="text-xs text-muted-foreground">
                  {page} ページ
                </span>

                <Button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!data?.hasNextPage}
                  variant="outline"
                  size="xs"
                >
                  次へ
                </Button>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
