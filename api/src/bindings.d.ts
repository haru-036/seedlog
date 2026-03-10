// CloudflareBindings を拡張して wrangler types 未登録のシークレットを追加
declare interface CloudflareBindings {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  FRONTEND_URL: string;
  // GitHub OAuth (#26)
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REDIRECT_URI: string;
  GITHUB_WEBHOOK_URL: string; // Webhook受信URL（例: https://seedlog-api.harurahu.workers.dev/api/webhooks/github）
}
