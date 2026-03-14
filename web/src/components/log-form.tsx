"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { Repo, ReposResponse } from "@seedlog/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { apiFetch, fetcher } from "@/lib/api";

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

  useEffect(() => {
    if (prefillContent) {
      setContent(prefillContent);
      setIsOpen(true);
    }
  }, [prefillContent]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      // APIに送信（titleやtagsは不要、sourceはweb）
      const res = await apiFetch("/api/logs", {
        method: "POST",
        body: JSON.stringify({
          content,
          source: "web",
          repo: repo === "" ? null : repo
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full"
        variant="outline"
      >
        <Plus className="h-4 w-4 mr-2" />
        今日やったことを記録する
      </Button>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">新しいログ</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repo" className="text-sm font-medium">
              リポジトリ（任意）
            </label>
            <select
              id="repo"
              name="repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              <option value="">リポジトリなし</option>
              {repos.map((item) => (
                <option key={item.fullName} value={item.fullName}>
                  {item.fullName}
                </option>
              ))}
            </select>
            {reposData?.incomplete && (
              <p className="text-muted-foreground text-xs">
                候補は一部のみ表示されています（検索条件で絞り込んでください）
              </p>
            )}
          </div>
          <Textarea
            name="content"
            placeholder="今日学んだこと、詰まったエラー、解決策などを自由に書いてください。"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="bg-secondary/50 resize-y"
          />
          {error && (
            <p className="text-sm text-destructive-foreground bg-destructive/10 p-2 rounded">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : "保存"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
