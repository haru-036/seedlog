"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { Repo, ReposResponse } from "@seedlog/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Plus, Search, X } from "lucide-react";
import { apiFetch, fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface LogFormProps {
  onLogCreated?: () => void;
  prefillContent?: string;
}

export function LogForm({ onLogCreated, prefillContent }: LogFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [repo, setRepo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { data: reposData } = useSWR<ReposResponse>(
    isOpen ? "/api/repos?per_page=100" : null,
    fetcher
  );
  const repos: Repo[] = reposData?.repos ?? [];
  const trimmedContent = content.trim();
  const trimmedRepo = repo.trim();
  const hasDraft = content.length > 0 || repo !== "";
  const suggestedRepos = trimmedRepo
    ? repos
        .filter((item) =>
          item.fullName.toLowerCase().includes(trimmedRepo.toLowerCase())
        )
        .slice(0, 6)
    : repos.slice(0, 6);

  useEffect(() => {
    if (prefillContent) {
      setContent(prefillContent);
      setIsOpen(true);
    }
  }, [prefillContent]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmedContent) {
      setError("内容を入力してください");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const res = await apiFetch("/api/logs", {
        method: "POST",
        body: JSON.stringify({
          content: trimmedContent,
          source: "web",
          repo: trimmedRepo === "" ? null : trimmedRepo
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      setIsOpen(false);
      setContent("");
      setRepo("");
      onLogCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl border border-dashed border-border/70 bg-linear-to-br from-card via-card to-muted/30 p-5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" />
              </span>
              {hasDraft ? "書きかけのログを続ける" : "今日のログを書く"}
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              学んだこと、詰まった点、判断した理由、次に試すことをそのまま残せます。
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <Card className="border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle>今日のログを書く</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setIsOpen(false);
              setError(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-medium">
                内容
              </Label>
              <Textarea
                id="content"
                name="content"
                placeholder="今日学んだこと、詰まったエラー、解決策、次にやることなどを自由に書いてください。"
                maxLength={2000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="min-h-24 resize-none bg-background/80 leading-6"
              />
            </div>

            <div className="space-y-2">
              <div className="space-y-0.5">
                <Label htmlFor="repo" className="text-sm font-medium">
                  関連リポジトリ
                </Label>
                <p className="text-xs text-muted-foreground">
                  候補から選ぶか、owner/repo 形式で直接入力できます。
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="repo"
                  name="repo"
                  list="repo-suggestions"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="例: owner/repo"
                  className="h-9 bg-background pl-9"
                />
                <datalist id="repo-suggestions">
                  {repos.map((item) => (
                    <option key={item.fullName} value={item.fullName}>
                      {item.fullName}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setRepo("")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    repo === ""
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  リポジトリなし
                </button>
                {suggestedRepos.map((item) => (
                  <button
                    key={item.fullName}
                    type="button"
                    onClick={() => setRepo(item.fullName)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      repo === item.fullName
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {item.fullName}
                  </button>
                ))}
              </div>

              {reposData?.incomplete && (
                <p className="text-xs text-muted-foreground">
                  候補は一部のみ表示されています。見つからない場合は直接入力してください。
                </p>
              )}
            </div>

            {error && (
              <Alert
                variant="destructive"
                className="gap-1.5"
                aria-live="polite"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>保存できませんでした</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex gap-2 self-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                }}
              >
                閉じる
              </Button>
              <Button type="submit" disabled={isPending || !trimmedContent}>
                {isPending ? "保存中..." : "ログを保存"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
