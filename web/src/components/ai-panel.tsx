"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lightbulb, FileText, TrendingUp, Sparkles } from "lucide-react";
import type { LogResponse } from "@seedlog/schema";
import { apiFetch } from "@/lib/api";

type AIType = "lt" | "es" | "growth";

interface LTTopic {
  title: string;
  summary: string;
  targetAudience: string;
  keyPoints: string[];
  relatedLogs: string[];
}

interface ESExperience {
  projectName: string;
  period: string;
  role: string;
  technologies: string[];
  challenges: string;
  achievements: string;
  esText: string;
}

interface GrowthAnalysis {
  summary: string;
  skillsAcquired: { skill: string; level: string; evidence: string }[];
  timeline: { period: string; milestone: string; description: string }[];
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
}

// Propsの型を定義
interface AIPanelProps {
  logs: LogResponse[];
}

// 各タブ用のデフォルトプロンプトの定義
const DEFAULT_PROMPTS = {
  lt: "最近のログをもとに、初心者向けに5分程度で話せるLTの構成を提案してください。\n\n**条件:**\n- 専門用語はなるべく避ける\n- 具体的なコード例も提案に含める",
  es: "チーム開発で直面した課題と、それをどう乗り越えたかに焦点を当ててES用の文章を作成してください。\n\n**条件:**\n- STAR法（状況・課題・行動・結果）に沿って書く\n- 400字程度にまとめる",
  growth: "直近のログから技術的な挑戦と、次に学ぶべきおすすめの技術スタックを中心に成長を分析してください。"
};

export function AIPanel({ logs }: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<AIType>("lt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ltResult, setLtResult] = useState<{ topics: LTTopic[] } | null>(null);
  const [esResult, setEsResult] = useState<{
    experiences: ESExperience[];
  } | null>(null);
  const [growthResult, setGrowthResult] = useState<GrowthAnalysis | null>(null);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPTS["lt"]); // プロンプトのState

  // タブが切り替わったタイミングで、対応するプロンプト例を入力欄にセットする
  useEffect(() => {
    setCustomPrompt(DEFAULT_PROMPTS[activeTab]);
  }, [activeTab]);

  const generateContent = async (type: AIType) => {
    // ログが0件の場合はAPIを叩かずにエラーを出す
    if (!logs || logs.length === 0) {
      setError("ログがありません。まずはログを記録してください。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 標準の fetch ではなく、lib/api.ts の apiFetch を使用する
      const response = await apiFetch("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ type })
      });

      if (!response.ok) {
        let errorMessage = "生成に失敗しました";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Response body is not valid JSON
        }
        throw new Error(errorMessage);
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream not available");

      const decoder = new TextDecoder();
      let buffer = "";
      //let fullContent = ''  ← 注: 現在使用されていませんが、ストリーミング中のUI表示用などに活用できます

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              // 最終的な構造化データが送られてきた場合
              if (parsed.type === "output" && parsed.output) {
                if (type === "lt") setLtResult(parsed.output);
                else if (type === "es") setEsResult(parsed.output);
                else if (type === "growth") setGrowthResult(parsed.output);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 以下の return (JSX) 部分は変更なしのため省略せずにそのまま記載
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI アシスタント
        </CardTitle>
        <CardDescription>
          ログを分析してLTネタ・ES・成長レポートを生成
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v: string) => setActiveTab(v as AIType)}
        >
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="lt" className="flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">LTネタ</span>
            </TabsTrigger>
            <TabsTrigger value="es" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">ES作成</span>
            </TabsTrigger>
            <TabsTrigger value="growth" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">成長分析</span>
            </TabsTrigger>
          </TabsList>

          {/* プロンプト入力エリア */}
          <div className="mb-6 space-y-2">
            <label className="text-sm font-medium text-foreground">
              AIへの指示
            </label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="AIへの指示を入力してください..."
              className="min-h-100px resize-y font-mono text-sm leading-relaxed"
            />
          </div>

          <TabsContent value="lt" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              ログからLTのネタになりそうなトピックを提案します。
            </div>
            <Button
              onClick={() => generateContent("lt")}
              disabled={loading || logs.length === 0}
              className="w-full"
            >
              {loading ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <Lightbulb className="mr-2 h-4 w-4" />
              )}
              LTネタを生成
            </Button>
            {ltResult && (
              <div className="space-y-4 mt-4">
                {ltResult.topics.map((topic, i) => (
                  <Card key={i} className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{topic.title}</CardTitle>
                      <CardDescription className="text-xs">
                        想定聴衆: {topic.targetAudience}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{topic.summary}</ReactMarkdown>
                      </div>
                      <div className="pt-2 border-t border-border mt-2">
                        <span className="font-medium">ポイント:</span>
                        <ul className="list-disc list-inside mt-1 text-muted-foreground">
                          {topic.keyPoints.map((point, j) => (
                            <li key={j}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="es" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              開発経験をES向けにまとめます。
            </div>
            <Button
              onClick={() => generateContent("es")}
              disabled={loading || logs.length === 0}
              className="w-full"
            >
              {loading ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              ES用文章を生成
            </Button>
            {esResult && (
              <div className="space-y-4 mt-4">
                {esResult.experiences.map((exp, i) => (
                  <Card key={i} className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {exp.projectName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {exp.period} | {exp.role}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {exp.technologies.map((tech, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      <div>
                        <span className="font-medium">課題と解決:</span>
                        <p className="text-muted-foreground mt-1">
                          {exp.challenges}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">成果・学び:</span>
                        <p className="text-muted-foreground mt-1">
                          {exp.achievements}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <span className="font-medium">ES用文章:</span>
                        <div className="mt-2 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{exp.esText}</ReactMarkdown>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="growth" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              ログを分析して成長を可視化します。
            </div>
            <Button
              onClick={() => generateContent("growth")}
              disabled={loading || logs.length === 0}
              className="w-full"
            >
              {loading ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <TrendingUp className="mr-2 h-4 w-4" />
              )}
              成長を分析
            </Button>
            {growthResult && (
              <div className="space-y-4 mt-4">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">成長サマリー</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {growthResult.summary}
                      </ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>

                {growthResult.skillsAcquired.length > 0 && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">習得スキル</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      {growthResult.skillsAcquired.map((skill, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              skill.level === "advanced"
                                ? "bg-green-500/20 text-green-400"
                                : skill.level === "intermediate"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {skill.skill}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {skill.evidence}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {growthResult.timeline.length > 0 && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">タイムライン</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="space-y-3">
                        {growthResult.timeline.map((item, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="w-20 shrink-0 text-xs text-muted-foreground">
                              {item.period}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">
                                {item.milestone}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {item.description}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">強み</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs">
                      <ul className="list-disc list-inside text-muted-foreground">
                        {growthResult.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">今後の課題</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs">
                      <ul className="list-disc list-inside text-muted-foreground">
                        {growthResult.areasToImprove.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {growthResult.recommendations.length > 0 && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        おすすめの次のステップ
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <ul className="list-decimal list-inside text-muted-foreground">
                        {growthResult.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
