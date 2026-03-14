"use client";

import { LogCard } from "./log-card";
import { FileText } from "lucide-react";
import type { LogResponse } from "@seedlog/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface LogListProps {
  logs: LogResponse[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  selectedSource: SourceFilter;
  onSourceChange: (value: SourceFilter) => void;
  onPageChange: (page: number) => void;
  onLogDeleted?: (id: string) => void;
}

type SourceFilter = "all" | "web" | "discord_command" | "discord_reply";

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

export function LogList({
  logs,
  total,
  hasMore,
  page,
  pageSize,
  selectedSource,
  onSourceChange,
  onPageChange,
  onLogDeleted
}: LogListProps) {
  const selectedSourceLabel =
    selectedSource === "all"
      ? undefined
      : SOURCES.find((source) => source.value === selectedSource)?.label;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // APIは新しい順で返ってくる前提で日付ごとにグループ化
  const dateGroups: { key: string; label: string; logs: LogResponse[] }[] = [];
  for (const log of logs) {
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
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground">ログ一覧</h2>
          <p className="text-xs text-muted-foreground">
            {logs.length}件表示 / 全{total}件
          </p>
        </div>

        <Select
          value={selectedSource}
          onValueChange={(value) => onSourceChange(value as SourceFilter)}
        >
          <SelectTrigger className="min-w-36">
            <SelectValue placeholder="表示ソースを選択" />
          </SelectTrigger>
          <SelectContent align="end" side="bottom">
            <SelectItem value="all">すべて</SelectItem>
            {SOURCES.map((source) => (
              <SelectItem key={source.value} value={source.value}>
                {source.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* タイムライン */}
      {logs.length === 0 ? (
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

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          前へ
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
        >
          次へ
        </Button>
      </div>
    </div>
  );
}
