"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Lightbulb,
  FileText,
  TrendingUp,
  Sparkles,
  InfoIcon,
  ChevronDown,
  Clock3,
  ScrollText
} from "lucide-react";
import { apiFetch, fetcher } from "@/lib/api";
import { ButtonGroup } from "./ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea
} from "./ui/input-group";
import useSWRMutation from "swr/mutation";
import useSWR from "swr";
import type {
  EpisodeRequest,
  EpisodeResponse,
  EpisodesListResponse
} from "@seedlog/schema";
import { Alert, AlertTitle } from "./ui/alert";
import { cn } from "@/lib/utils";

type AIType = "lt" | "es" | "growth";

// 各タブ用のデフォルトプロンプトの定義
const DEFAULT_PROMPTS = {
  lt: "最近のログをもとに、初心者向けに5分程度で話せるLTの構成を提案してください。\n\n**条件:**\n- 専門用語はなるべく避ける\n- 具体的なコード例も提案に含める",
  es: "チーム開発で直面した課題と、それをどう乗り越えたかに焦点を当ててES用の文章を作成してください。\n\n**条件:**\n- STAR法（状況・課題・行動・結果）に沿って書く\n- 400字程度にまとめる",
  growth:
    "直近のログから技術的な挑戦と、次に学ぶべきおすすめの技術スタックを中心に成長を分析してください。"
};

const EPISODES_PAGE_SIZE = 20;

function extractEpisodeTitle(content: string, createdAt: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim());
  const firstNonEmpty = lines.find((line) => line.length > 0) ?? "";
  const headingLike = firstNonEmpty.replace(/^#+\s*/, "").trim();
  const titleSource = headingLike || firstNonEmpty;

  if (titleSource.length > 0) {
    return titleSource.slice(0, 80);
  }

  return `${new Date(createdAt).toLocaleDateString("ja-JP")} のエピソード`;
}

function extractPreview(content: string): string {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*|__|`/g, "")
    .trim();

  return normalized.slice(0, 140);
}

function formatCreatedAt(createdAt: string): string {
  return new Date(createdAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function AIPanel() {
  const [customPrompt, setCustomPrompt] = useState("");
  const [episodeContent, setEpisodeContent] = useState("");
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(
    null
  );

  const episodesKey = `/api/episodes?limit=${EPISODES_PAGE_SIZE}&offset=0`;
  const {
    data: episodesData,
    mutate: mutateEpisodes,
    isLoading: isEpisodesLoading
  } = useSWR<EpisodesListResponse>(episodesKey, fetcher);

  const { trigger, isMutating, error } = useSWRMutation(
    "/api/episodes",
    async (url: string, { arg }: { arg: EpisodeRequest }) => {
      const res = await apiFetch(url, {
        method: "POST",
        body: JSON.stringify(arg)
      });
      const data: EpisodeResponse = await res.json();
      return data;
    }
  );

  const handleSetPrompt = (type: AIType) => {
    setCustomPrompt(DEFAULT_PROMPTS[type]);
  };

  const handleGenerate = async () => {
    try {
      const response = await trigger({ prompt: customPrompt });
      setEpisodeContent(response.episode);
      await mutateEpisodes();
    } catch (error) {
      console.error("AI生成に失敗:", error);
    }
  };

  const episodes = episodesData?.episodes ?? [];
  const totalEpisodes = episodesData?.total ?? 0;

  useEffect(() => {
    if (episodes.length === 0) {
      setExpandedEpisodeId(null);
      return;
    }

    if (!expandedEpisodeId) {
      setExpandedEpisodeId(episodes[0]?.id ?? null);
      return;
    }

    const exists = episodes.some((episode) => episode.id === expandedEpisodeId);
    if (!exists) {
      setExpandedEpisodeId(episodes[0]?.id ?? null);
    }
  }, [episodes, expandedEpisodeId]);

  const handleToggleEpisode = (episodeId: string) => {
    setExpandedEpisodeId((current) =>
      current === episodeId ? null : episodeId
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex font-semibold items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI アシスタント
          </CardTitle>
          <CardDescription>
            ログを分析してLTネタ・ES・成長レポートを生成
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <ButtonGroup>
              <Button
                variant={"outline"}
                size={"sm"}
                onClick={() => handleSetPrompt("lt")}
              >
                <Lightbulb />
                LT構成案
              </Button>
              <Button
                variant={"outline"}
                size={"sm"}
                onClick={() => handleSetPrompt("es")}
              >
                <FileText />
                ES文章
              </Button>
              <Button
                variant={"outline"}
                size={"sm"}
                onClick={() => handleSetPrompt("growth")}
              >
                <TrendingUp />
                成長分析
              </Button>
            </ButtonGroup>

            <InputGroup>
              <InputGroupTextarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="プロンプトをカスタマイズ..."
                className="resize-none h-36 p-3"
              />
              <InputGroupAddon align="block-end">
                <InputGroupButton
                  className="ml-auto px-4"
                  size="sm"
                  variant="default"
                  onClick={handleGenerate}
                  disabled={isMutating || !customPrompt.trim()}
                >
                  生成
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <InfoIcon />
              <AlertTitle>生成に失敗しました</AlertTitle>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ScrollText className="h-4 w-4 text-primary" />
            エピソード
          </CardTitle>
          <CardDescription>
            生成済みエピソードをその場で展開して確認できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {episodeContent && (
            <Alert>
              <InfoIcon />
              <AlertTitle>
                生成が完了しました。最新の内容は一覧の先頭から確認できます。
              </AlertTitle>
            </Alert>
          )}

          {isEpisodesLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : episodes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                まだエピソードがありません。上のフォームから生成するとここに表示されます。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                全{totalEpisodes}件
              </p>
              {episodes.map((episode) => {
                const title = extractEpisodeTitle(
                  episode.content,
                  episode.createdAt
                );
                const preview = extractPreview(episode.content);
                const isOpen = expandedEpisodeId === episode.id;

                return (
                  <div
                    key={episode.id}
                    className="overflow-hidden rounded-lg border border-border/70 bg-background"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleEpisode(episode.id)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatCreatedAt(episode.createdAt)}
                          </span>
                          <span>{episode.content.length}文字</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {preview || "プレビューを表示できません"}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/70 bg-muted/15 px-4 py-3">
                        <div className="prose prose-sm max-h-112 max-w-none overflow-y-auto wrap-break-word text-foreground leading-7">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {episode.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
