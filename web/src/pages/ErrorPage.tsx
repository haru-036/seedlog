const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch:
    "セキュリティ検証に失敗しました。もう一度ログインしてください。",
  token_exchange: "GitHub との認証に失敗しました。もう一度お試しください。",
  user_fetch: "GitHub ユーザー情報の取得に失敗しました。",
  access_denied: "認証がキャンセルされました。",
  oauth_error: "OAuth 認証中にエラーが発生しました。"
};

export default function ErrorPage() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason") ?? "unknown";
  const message =
    ERROR_MESSAGES[reason] ?? `予期しないエラーが発生しました（${reason}）`;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-4xl">⚠️</p>
        <h1 className="text-xl font-semibold text-white">
          エラーが発生しました
        </h1>
        <p className="text-gray-400 max-w-sm">{message}</p>
        <a
          href="/"
          className="inline-block mt-4 text-sm text-blue-400 hover:underline"
        >
          トップに戻る
        </a>
      </div>
    </div>
  );
}
