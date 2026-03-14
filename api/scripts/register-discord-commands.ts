const DISCORD_API = "https://discord.com/api/v10";

type DiscordCommand = {
  name: string;
  description: string;
  options?: Array<{
    type: 3; // STRING
    name: string;
    description: string;
    required?: boolean;
  }>;
};

const commands: DiscordCommand[] = [
  {
    name: "log",
    description: "今日の学びや詰まったことを記録する"
  },
  {
    name: "episode",
    description: "過去ログからエピソードを生成する",
    options: [
      {
        type: 3,
        name: "prompt",
        description: "例: 今週の成長を3つでまとめて",
        required: true
      }
    ]
  }
];

async function main() {
  const applicationId = process.env.APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_COMMAND_GUILD_ID;

  if (!applicationId) {
    throw new Error("APPLICATION_ID が未設定です");
  }
  if (!botToken) {
    throw new Error("DISCORD_BOT_TOKEN が未設定です");
  }

  const path = guildId
    ? `/applications/${applicationId}/guilds/${guildId}/commands`
    : `/applications/${applicationId}/commands`;

  const res = await fetch(`${DISCORD_API}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Discord command registration failed: ${res.status} ${text}`
    );
  }

  const scope = guildId ? `guild(${guildId})` : "global";
  console.log(`Discord commands registered successfully [${scope}]`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
