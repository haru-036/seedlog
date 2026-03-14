import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

// 通知データの型定義
export function DashboardHeader() {
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [_discordBotInstallFlag, setDiscordBotInstallFlag] = useState<
    string | null
  >(null);
  const [discordDmDeliverable, setDiscordDmDeliverable] = useState<
    string | null
  >(null);
  const [discordDmReason, setDiscordDmReason] = useState<string | null>(null);

  useEffect(() => {
    setGithubLogin(localStorage.getItem("githubLogin"));
    const username = localStorage.getItem("discordUsername");
    setDiscordUsername(username);
    setDiscordBotInstallFlag(localStorage.getItem("discordBotInstalled"));
    setDiscordDmDeliverable(localStorage.getItem("discordDmDeliverable"));
    setDiscordDmReason(localStorage.getItem("discordDmReason"));
  }, []);

  return (
      <>
          <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">🌱 Seedlog</h1>
            <div className="flex items-center gap-4">
              {githubLogin && (
                <span className="text-sm text-muted-foreground">
                  @{githubLogin}
                </span>
              )}
              {discordUsername ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Discord: {discordUsername}
                  </span>
                  {discordDmDeliverable === "1" && (
                    <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded">
                      DM受信可能
                    </span>
                  )}
                  {discordDmDeliverable === "0" && (
                    <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">
                      DM受信不可
                    </span>
                  )}
                </div>
              ) : null}
              <a
                href={`${API_BASE}/api/auth/discord`}
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors"
              >
                {discordUsername ? "Discord 再連携" : "Discord 連携"}
              </a>
              {discordUsername && (
                <a
                  href={`${API_BASE}/api/auth/discord/install`}
                  className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-500 transition-colors"
                >
                  Bot をサーバーに追加
                </a>
              )}
            </div>
          </header>
        {discordUsername && discordDmDeliverable === "0" && (
          <div className="max-w-2xl mx-auto px-6 pt-4">
            <p className="text-sm text-red-300">
              DMを送信できませんでした（
              {discordDmReason === "blocked_or_closed"
                ? "DM受信設定またはBotブロック"
                : "不明なエラー"}
              ）。Discord 再連携で再チェックできます。
            </p>
          </div>
        )}
      </>
  )
}
