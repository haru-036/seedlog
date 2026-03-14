"use client";

import { useState } from "react";
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
  InfoIcon
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ButtonGroup } from "./ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea
} from "./ui/input-group";
import useSWRMutation from "swr/mutation";
import type { EpisodeRequest, EpisodeResponse } from "@seedlog/schema";
import { Alert, AlertTitle } from "./ui/alert";

type AIType = "lt" | "es" | "growth";

// 各タブ用のデフォルトプロンプトの定義
const DEFAULT_PROMPTS = {
  lt: "最近のログをもとに、初心者向けに5分程度で話せるLTの構成を提案してください。\n\n**条件:**\n- 専門用語はなるべく避ける\n- 具体的なコード例も提案に含める",
  es: "チーム開発で直面した課題と、それをどう乗り越えたかに焦点を当ててES用の文章を作成してください。\n\n**条件:**\n- STAR法（状況・課題・行動・結果）に沿って書く\n- 400字程度にまとめる",
  growth:
    "直近のログから技術的な挑戦と、次に学ぶべきおすすめの技術スタックを中心に成長を分析してください。"
};

export function AIPanel() {
  const [customPrompt, setCustomPrompt] = useState("");
  const [episodeContent, setEpisodeContent] = useState("");
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
      // 生成された内容を表示するなどの処理をここに追加
      setEpisodeContent(response.episode);
      console.log("AI Response:", response);
    } catch (error) {
      console.error("AI生成に失敗:", error);
    }
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
      {episodeContent && (
        <Card>
          <CardContent className="prose prose-invert max-w-none w-full">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {episodeContent}
            </ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
