"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { LogResponse } from "@seedlog/schema";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LogCardProps {
  log: LogResponse;
  onDeleted?: (id: string) => void;
}

export function LogCard({ log, onDeleted }: LogCardProps) {
  const [isPending, setIsPending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const normalizedContent = log.content.replace(/\r\n/g, "\n").trim();

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "github_push":
        return null;
      case "discord_command":
        return "Discordで記録";
      case "discord_reply":
        return "質問に回答";
      default:
        return "手動入力";
    }
  };

  const getSourceTone = (source: string) => {
    switch (source) {
      case "github_push":
        return "border-slate-300 bg-slate-100 text-slate-700";
      case "discord_command":
        return "border-indigo-200 bg-indigo-50 text-indigo-700";
      case "discord_reply":
        return "border-violet-200 bg-violet-50 text-violet-700";
      default:
        return "border-sky-200 bg-sky-50 text-sky-700";
    }
  };

  const sourceLabel = getSourceLabel(log.source);

  return (
    <Card className="group relative border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {sourceLabel && (
              <Badge
                variant="outline"
                className={cn(
                  "h-auto rounded-full px-2.5 py-1 text-[11px] font-medium",
                  getSourceTone(log.source)
                )}
              >
                {sourceLabel}
              </Badge>
            )}
            {log.repo && (
              <Badge
                variant="outline"
                className="h-auto max-w-full rounded-full px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <span className="truncate">{log.repo}</span>
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(log.createdAt)}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground md:opacity-0 md:group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowConfirm(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <p className="whitespace-pre-wrap wrap-break-word text-base leading-normal text-foreground">
          {normalizedContent || "内容がありません"}
        </p>
      </CardContent>

      {showConfirm && (
        <div className="absolute inset-0 bg-background/95 flex items-center justify-center rounded-lg">
          <div className="flex flex-col gap-3 p-4 text-center">
            <p className="text-sm">このログを削除しますか？</p>
            <div className="flex gap-2 justify-center">
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
    </Card>
  );
}
