"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR, { mutate } from "swr";
import type { LogsListResponse } from "@seedlog/schema";
import { DashboardHeader } from "@/components/dashboard-header";
import { LogForm } from "@/components/log-form";
import { LogList } from "@/components/log-list";
import { AIPanel } from "@/components/ai-panel";
import { fetchCurrentUser, fetcher } from "@/lib/api";
import { RepoSelectorPanel } from "@/components/repo-selector-panel";
import { MOCK_LOGS_RESPONSE } from "@/lib/mock-data";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const PAGE_SIZE = 10;
const AI_LOGS_LIMIT = 100;

type SourceFilter = "all" | "web" | "discord_command" | "discord_reply";

export function DashboardClient() {
  const { data: currentUser } = useSWR("/api/auth/me", fetchCurrentUser);
  const [page, setPage] = useState(1);
  const [selectedSource, setSelectedSource] = useState<SourceFilter>("all");
  const offset = (page - 1) * PAGE_SIZE;
  const querySource = selectedSource === "all" ? null : selectedSource;
  const logsKey = `/api/logs?limit=${PAGE_SIZE}&offset=${offset}${querySource ? `&source=${querySource}` : ""}`;
  const aiLogsKey = `/api/logs?limit=${AI_LOGS_LIMIT}&offset=0`;

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("githubLogin", currentUser.githubLogin);
    }
  }, [currentUser]);

  // バックエンドの /api/logs からデータを取得
  const { data: listData } = useSWR<LogsListResponse>(
    USE_MOCK ? null : logsKey,
    fetcher,
    {
      onError: (err) => console.warn("API fetch failed:", err.message),
      fallbackData: USE_MOCK ? MOCK_LOGS_RESPONSE : undefined
    }
  );

  const { data: aiData } = useSWR<LogsListResponse>(
    USE_MOCK ? null : aiLogsKey,
    fetcher,
    {
      onError: (err) => console.warn("AI logs fetch failed:", err.message),
      fallbackData: USE_MOCK ? MOCK_LOGS_RESPONSE : undefined
    }
  );

  const mockFilteredLogs = querySource
    ? MOCK_LOGS_RESPONSE.logs.filter((log) => log.source === querySource)
    : MOCK_LOGS_RESPONSE.logs;
  const mockLogs = mockFilteredLogs.slice(offset, offset + PAGE_SIZE);
  const mockTotal = mockFilteredLogs.length;
  const mockHasMore = offset + mockLogs.length < mockTotal;

  const logs = USE_MOCK ? mockLogs : (listData?.logs ?? []);
  const total = USE_MOCK ? mockTotal : (listData?.total ?? 0);
  const hasMore = USE_MOCK ? mockHasMore : (listData?.hasMore ?? false);
  const aiLogs = USE_MOCK ? MOCK_LOGS_RESPONSE.logs : (aiData?.logs ?? []);

  const [prefillContent, setPrefillContent] = useState<string>("");

  const handleLogCreated = useCallback(() => {
    setPage(1);
    if (!USE_MOCK) {
      mutate((key) => typeof key === "string" && key.startsWith("/api/logs?"));
    }
    setPrefillContent("");
  }, []);

  const handleLogDeleted = useCallback((_deletedId: string) => {
    if (USE_MOCK) return;
    mutate((key) => typeof key === "string" && key.startsWith("/api/logs?"));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSourceChange = useCallback((value: SourceFilter) => {
    setSelectedSource(value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage > totalPages) return;
      setPage(nextPage);
    },
    [totalPages]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader />
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <div>
              <h1 className="text-2xl font-bold mb-1">開発ログ</h1>
              <p className="text-muted-foreground text-sm">
                まず記録し、次に振り返れる形で残します
              </p>
            </div>
            <LogForm
              onLogCreated={handleLogCreated}
              prefillContent={prefillContent}
            />
            <AIPanel logs={aiLogs} />
          </div>
          <div className="space-y-4 lg:col-span-4 lg:space-y-6">
            <RepoSelectorPanel />
            <LogList
              logs={logs}
              total={total}
              hasMore={hasMore}
              page={page}
              pageSize={PAGE_SIZE}
              selectedSource={selectedSource}
              onSourceChange={handleSourceChange}
              onPageChange={handlePageChange}
              onLogDeleted={handleLogDeleted}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
