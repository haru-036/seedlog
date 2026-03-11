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
  const code = new URLSearchParams(window.location.search).get("code");

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
      window.location.replace("/repos");
    }
  }, [code, error, data]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Discord連携中...</p>
    </div>
  );
}
