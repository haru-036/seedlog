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

const DEFAULT_EPISODE_CONTENT = `### あなたの成長記録：エンジニアとしてのステップアップ\n\nこれまでのログを分析すると、技術スタックの選定からデバッグの深掘りまで、着実にエンジニアとしての歩みを進めていることがわかります。特に、**「AIを使いこなす視点」と「環境構築の自動化」**に大きな成長が見られます。\n\n#### 1. 開発効率化への深い理解\nあなたは、単にコードを書くだけでなく、開発体験（DX）を向上させる仕組みを積極的に取り入れています。\n*   **ドキュメント駆動開発の体感:** 「ドキュメントを充実させるとAIに全任せできる」という気づきは、AIを最大限に活用するための本質を捉えています。\n*   **ツール選定のセンス:** OpenAPIの生成やScalarの導入、shadcnの活用など、トレンドのツールを取り入れて「楽をすること」を追求できています。これは工数を減らし、本質的な機能実装に集中するための重要なエンジニアスキルです。\n\n#### 2. デバッグ能力と自己解決力の向上\n「詰まったこと」に対しても、粘り強く原因を特定し解決できています。\n*   **論理的な切り分け:** 「KVのデータを消したらちゃんと動いた」という経験は、外部依存のデータを疑うという、トラブルシューティングにおける重要なスキルです。\n*   **バージョン管理の重要性の再認識:** 「zodがバージョン3だったせいでOpenAPIが動かなかった」という事象から、ライブラリのバージョン差異を疑う力も養われています。AIに頼るだけでなく、「最後は人間が適切に設定を確認する」という教訓を得たのは大きな成長です。\n\n#### 3. 技術的自立とAIの適切な併用\nあなたはAIを「魔法の杖」ではなく「優秀な助手」として扱えています。\n*   **「やったのcopilotだけどw」という謙虚な視点:** 自身の成果としてAIを活用しつつ、その技術背景にある「zodでスキーマを管理していたからこそ設定が楽だった」という自分の下準備の良さに気づけている点は、非常にエンジニアとして成熟しています。\n\n---\n\n### 今後のアドバイス\n今のあなたは**「AIによる爆速開発」と「エラーの原因究明」のサイクル**が非常にうまく回っています。\n今後は「なぜ動いたのか（または動かなかったのか）」という技術的深掘りを意識すると、さらなる成長が期待できます。特にバージョン差異などのハマりどころを自分の中に知見として蓄積していけば、チーム内での頼れるエンジニアとして一層飛躍できるでしょう。\n\n自信を持って、これからも「楽をして、より多くのものを作る」エンジニアリングを楽しんでください！`;

export function AIPanel() {
  const [customPrompt, setCustomPrompt] = useState("");
  const [episodeContent, setEpisodeContent] = useState(DEFAULT_EPISODE_CONTENT);
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
