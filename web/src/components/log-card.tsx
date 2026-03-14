"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { LogResponse } from "@seedlog/schema";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LogCardProps {
  log: LogResponse;
  onDeleted?: (id: string) => void;
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSourceLabel(source: string): string | null {
  switch (source) {
    case "github_push":
      return null;
    case "discord_command":
      return "Discord";
    case "discord_reply":
      return "質問に回答";
    default:
      return "Web";
  }
}

function getDotColor(source: string): string {
  switch (source) {
    case "github_push":
      return "bg-slate-400";
    case "discord_command":
      return "bg-indigo-500";
    case "discord_reply":
      return "bg-violet-500";
    default:
      return "bg-sky-500";
  }
}

export function LogCard({ log, onDeleted }: LogCardProps) {
  const [isPending, setIsPending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedContent = log.content.replace(/\r\n/g, "\n").trim();
  const isLong =
    normalizedContent.length > 120 || normalizedContent.split("\n").length > 3;
  const sourceLabel = getSourceLabel(log.source);

  const handleDelete = async () => {
    setIsPending(true);
    try {
      await apiFetch(`/api/logs/${log.id}`, { method: "DELETE" });
      setShowConfirm(false);
      onDeleted?.(log.id);
    } catch (err) {
      console.error("削除エラー:", err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="group relative flex gap-3">
      {/* タイムライン: ドット + 縦線 */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "mt-2 h-2 w-2 shrink-0 rounded-full ring-2 ring-background",
            getDotColor(log.source)
          )}
        />
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      {/* コンテンツ */}
      <div className="min-w-0 flex-1 pb-8">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* メタ行 */}
            <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTime(log.createdAt)}
              </span>
              {sourceLabel && (
                <span className="text-xs text-muted-foreground/70">
                  {sourceLabel}
                </span>
              )}
              {log.repo && (
                <span className="max-w-[16rem] truncate text-xs text-muted-foreground/50">
                  {log.repo}
                </span>
              )}
            </div>

            {/* 本文 */}
            <p
              className={cn(
                "wrap-break-word whitespace-pre-wrap text-sm leading-relaxed text-foreground",
                !isExpanded && isLong && "line-clamp-3"
              )}
            >
              {normalizedContent || "内容がありません"}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="mt-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {isExpanded ? "折りたたむ" : "続きを見る"}
              </button>
            )}
          </div>

          {/* 削除ボタン */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            aria-label="削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 削除確認オーバーレイ（行全体を覆う） */}
      {showConfirm && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/95">
          <div className="flex flex-col gap-3 p-4 text-center">
            <p className="text-sm">このログを削除しますか？</p>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "削除中..." : "削除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
