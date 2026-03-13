import { useEffect } from "react";
import useSWR from "swr";
import type { DiscordTokenResponse } from "@seedlog/schema";
import { apiFetch } from "../lib/api";

async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const res = await apiFetch("/api/auth/discord/token", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  if (!res.ok) throw new Error("discord_link_failed");
  return res.json() as Promise<DiscordTokenResponse>;
}

export default function DiscordCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const needsBotInstall = params.get("needsBotInstall") === "1";
  const dmDeliverable = params.get("dmDeliverable") === "1";
  const dmReason = params.get("dmReason") ?? "unknown_error";

  const { data, error } = useSWR(
    code ? ["discord-token", code] : null,
    ([, c]) => exchangeCode(c)
  );

  useEffect(() => {
    if (!code) {
      window.location.replace("/auth/error?reason=oauth_error");
      return;
    }
    if (error) {
      window.location.replace("/auth/error?reason=discord_link_failed");
      return;
    }
    if (data) {
      localStorage.setItem("discordId", data.discordId);
      localStorage.setItem("discordUsername", data.discordUsername);
      localStorage.setItem("discordBotInstalled", needsBotInstall ? "0" : "1");
      localStorage.setItem("discordDmDeliverable", dmDeliverable ? "1" : "0");
      localStorage.setItem("discordDmReason", dmReason);
      window.location.replace("/repos");
    }
  }, [code, error, data, needsBotInstall, dmDeliverable, dmReason]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Discord連携中...</p>
    </div>
  );
}
