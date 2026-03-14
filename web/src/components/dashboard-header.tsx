import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Github,
  MessageCircle,
  RefreshCw
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE } from "../lib/api";

// 通知データの型定義
export function DashboardHeader() {
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordDmDeliverable, setDiscordDmDeliverable] = useState<
    string | null
  >(null);
  const [discordDmReason, setDiscordDmReason] = useState<string | null>(null);

  useEffect(() => {
    setGithubLogin(localStorage.getItem("githubLogin"));
    const username = localStorage.getItem("discordUsername");
    setDiscordUsername(username);
    setDiscordDmDeliverable(localStorage.getItem("discordDmDeliverable"));
    setDiscordDmReason(localStorage.getItem("discordDmReason"));
  }, []);

  const isDmDeliverable = discordDmDeliverable === "1";
  const isDmUndeliverable = discordDmDeliverable === "0";

  return (
    <>
      <header className="supports-backdrop-filter:bg-background/80 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="Seedlog" className="size-8" />
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
              Seedlog
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {!githubLogin && (
              <Button asChild>
                <a href={`${API_BASE}/api/auth/github`}>
                  <Github className="size-3.5" />
                  GitHub でログイン
                </a>
              </Button>
            )}

            {githubLogin && (
              <Badge
                variant="outline"
                className="h-8 rounded-full px-3 text-muted-foreground"
              >
                GitHub: {githubLogin}
              </Badge>
            )}

            {githubLogin && discordUsername && (
              <Badge
                variant="outline"
                className="h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-muted-foreground"
              >
                <MessageCircle className="size-3.5" />
                <span className="max-w-36 truncate">
                  Discord: {discordUsername}
                </span>
              </Badge>
            )}

            {githubLogin && isDmDeliverable && (
              <Badge className="h-8 rounded-full bg-emerald-500/15 px-3 text-emerald-600 dark:text-emerald-400">
                DM受信可能
              </Badge>
            )}

            {githubLogin && isDmUndeliverable && (
              <Badge
                variant="destructive"
                className="h-8 rounded-full bg-destructive/15 px-3"
              >
                DM受信不可
              </Badge>
            )}

            {githubLogin && (
              <Button asChild variant={discordUsername ? "outline" : "default"}>
                <a href={`${API_BASE}/api/auth/discord`}>
                  <RefreshCw className="size-3.5" />
                  {discordUsername ? "Discord 再連携" : "Discord 連携"}
                </a>
              </Button>
            )}

            {githubLogin && discordUsername && (
              <Button
                asChild
                className="bg-repo-action text-white hover:bg-repo-action-hover"
              >
                <a href={`${API_BASE}/api/auth/discord/install`}>
                  <Bot className="size-3.5" />
                  Bot をサーバーに追加
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {githubLogin && discordUsername && isDmUndeliverable && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/5"
          >
            <AlertCircle className="size-4" />
            <AlertTitle className="text-sm">
              Discord DM を送信できませんでした
            </AlertTitle>
            <AlertDescription className="text-xs md:text-sm">
              {discordDmReason === "blocked_or_closed"
                ? "DM受信設定またはBotブロックが原因の可能性があります"
                : "原因を特定できませんでした"}
              。Discord 再連携で再チェックできます。
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}
