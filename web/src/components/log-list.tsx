"use client";

import { useState } from "react";
import { LogCard } from "./log-card";
import { FileText } from "lucide-react";
import type { LogResponse } from "@seedlog/schema";
import { cn } from "@/lib/utils";

interface LogListProps {
  logs: LogResponse[];
  onLogDeleted?: (id: string) => void;
}

const SOURCES = [
  {
    value: "web",
    label: "Webで記録",
    color: "border-sky-200 bg-sky-50 text-sky-700"
  },
  {
    value: "discord_command",
    label: "Discordで記録",
    color: "border-indigo-200 bg-indigo-50 text-indigo-700"
  },
  {
    value: "discord_reply",
    label: "質問に回答",
    color: "border-violet-200 bg-violet-50 text-violet-700"
  }
];

export function LogList({ logs, onLogDeleted }: LogListProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const sourceCounts = logs.reduce<Record<string, number>>((counts, log) => {
    counts[log.source] = (counts[log.source] ?? 0) + 1;
    return counts;
  }, {});

  const filteredLogs = selectedSource
    ? logs.filter((log) => log.source === selectedSource)
    : logs;

  const selectedSourceLabel = SOURCES.find(
    (source) => source.value === selectedSource
  )?.label;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                ログ一覧
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredLogs.length}件表示 / 全{logs.length}件
            </p>
          </div>

          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2 whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  selectedSource === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <span>すべて</span>
                <span className="min-w-4 text-center text-xs tabular-nums opacity-80">
                  {logs.length}
                </span>
              </button>
              {SOURCES.map((source) => (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => setSelectedSource(source.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selectedSource === source.value
                      ? source.color
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span>{source.label}</span>
                  <span className="min-w-4 text-center text-xs tabular-nums opacity-80">
                    {sourceCounts[source.value] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-14 text-center text-muted-foreground">
          <FileText className="mb-4 h-12 w-12 opacity-50" />
          <p className="text-base font-medium text-foreground">
            {selectedSourceLabel
              ? `${selectedSourceLabel}のログはまだありません`
              : "ログはまだありません"}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {selectedSourceLabel
              ? "フィルタを切り替えるか、新しいログを追加するとここに表示されます。"
              : "上のフォームから今日の学びや判断を書き残すと、ここに時系列で並びます。"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredLogs.map((log) => (
            <LogCard key={log.id} log={log} onDeleted={onLogDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
