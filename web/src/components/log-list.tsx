"use client";

import { useState } from "react";
import { LogCard } from "./log-card";
import { FileText } from "lucide-react";
import type { LogResponse } from "@seedlog/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

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

function getDateKey(dateString: string): string {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateHeader(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

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

  // APIは新しい順で返ってくる前提で日付ごとにグループ化
  const dateGroups: { key: string; label: string; logs: LogResponse[] }[] = [];
  for (const log of filteredLogs) {
    const key = getDateKey(log.createdAt);
    const last = dateGroups[dateGroups.length - 1];
    if (last?.key === key) {
      last.logs.push(log);
    } else {
      dateGroups.push({
        key,
        label: formatDateHeader(log.createdAt),
        logs: [log]
      });
    }
  }

  return (
    <div className="flex flex-col gap-5 px-2">
      {/* フィルタバー */}
      <div className="flex justify-between items-center gap-2">
        <h2 className="font-semibold text-foreground">ログ一覧</h2>

        <Select
          value={selectedSource ?? "all"}
          onValueChange={(value) =>
            setSelectedSource(value === "all" ? null : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="表示ソースを選択" />
          </SelectTrigger>
          <SelectContent align="end" side="bottom">
            <SelectItem value="all">すべて ({logs.length})</SelectItem>
            {SOURCES.map((source) => (
              <SelectItem key={source.value} value={source.value}>
                {source.label} ({sourceCounts[source.value] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* タイムライン */}
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
        <div className="flex flex-col gap-4 px-1">
          {dateGroups.map((group) => (
            <div key={group.key}>
              {/* 日付ヘッダー */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs tabular-nums text-muted-foreground/60">
                  {group.logs.length}件
                </span>
              </div>

              {/* ログ行 */}
              <div className="pl-1">
                {group.logs.map((log) => (
                  <LogCard key={log.id} log={log} onDeleted={onLogDeleted} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
