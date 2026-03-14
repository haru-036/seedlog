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

export function DashboardClient() {
  const { data: currentUser } = useSWR("/api/auth/me", fetchCurrentUser);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("githubLogin", currentUser.githubLogin);
    }
  }, [currentUser]);

  // バックエンドの /api/logs からデータを取得
  const { data } = useSWR<LogsListResponse>(
    USE_MOCK ? null : "/api/logs",
    fetcher,
    {
      onError: (err) => console.warn("API fetch failed:", err.message),
      fallbackData: USE_MOCK ? MOCK_LOGS_RESPONSE : undefined
    }
  );

  const logs = USE_MOCK ? MOCK_LOGS_RESPONSE.logs : (data?.logs ?? []);

  const [prefillContent, setPrefillContent] = useState<string>("");

  const handleLogCreated = useCallback(() => {
    mutate("/api/logs");
    setPrefillContent("");
  }, []);

  const handleLogDeleted = useCallback(
    (deletedId: string) => {
      if (USE_MOCK) return;
      if (data) {
        mutate(
          "/api/logs",
          {
            ...data,
            logs: data.logs.filter((log) => log.id !== deletedId),
            total: data.total - 1
          },
          false
        );
      }
    },
    [data]
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
            <AIPanel logs={logs} />
          </div>
          <div className="space-y-4 lg:col-span-4 lg:space-y-6">
            <RepoSelectorPanel />
            <LogList logs={logs} onLogDeleted={handleLogDeleted} />
          </div>
        </div>
      </main>
    </div>
  );
}
