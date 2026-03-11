import { useEffect } from "react";
import type { DiscordTokenResponse } from "@seedlog/schema";
import { API_BASE } from "../lib/api";

export default function DiscordCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      window.location.replace("/auth/error?reason=oauth_error");
      return;
    }

    fetch(`${API_BASE}/api/auth/discord/token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    })
      .then(async (res) => {
        if (!res.ok) {
          window.location.replace("/auth/error?reason=discord_link_failed");
          return;
        }
        const data = (await res.json()) as DiscordTokenResponse;
        localStorage.setItem("discordId", data.discordId);
        localStorage.setItem("discordUsername", data.discordUsername);
        window.location.replace("/repos");
      })
      .catch(() => {
        window.location.replace("/auth/error?reason=discord_link_failed");
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Discord連携中...</p>
    </div>
  );
}
