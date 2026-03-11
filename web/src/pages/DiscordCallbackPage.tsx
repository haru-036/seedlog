import useSWR from "swr";
import type { DiscordTokenResponse } from "@seedlog/schema";
import { API_BASE } from "../lib/api";

function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  return fetch(`${API_BASE}/api/auth/discord/token`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  }).then(async (res) => {
    if (!res.ok) throw new Error("discord_link_failed");
    return res.json() as Promise<DiscordTokenResponse>;
  });
}

export default function DiscordCallbackPage() {
  const code = new URLSearchParams(window.location.search).get("code");

  const { data, error } = useSWR(
    code ? ["discord-token", code] : null,
    ([, c]) => exchangeCode(c)
  );

  if (!code) {
    window.location.replace("/auth/error?reason=oauth_error");
    return null;
  }

  if (error) {
    window.location.replace("/auth/error?reason=discord_link_failed");
    return null;
  }

  if (data) {
    localStorage.setItem("discordId", data.discordId);
    localStorage.setItem("discordUsername", data.discordUsername);
    window.location.replace("/repos");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Discord連携中...</p>
    </div>
  );
}
