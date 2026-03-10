const DISCORD_API = "https://discord.com/api/v10";

async function discordFetch(botToken: string, path: string, init: RequestInit) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createDMChannel(
  botToken: string,
  discordUserId: string
): Promise<string> {
  const data = await discordFetch(botToken, "/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId })
  });
  return data.id as string;
}

export async function sendDMMessage(
  botToken: string,
  channelId: string,
  content: string,
  options?: { components?: unknown[] }
): Promise<string> {
  const data = await discordFetch(botToken, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, ...options })
  });
  return data.id as string;
}
