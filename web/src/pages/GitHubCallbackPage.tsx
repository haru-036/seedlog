import { useEffect } from "react";

export default function GitHubCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubLogin = params.get("githubLogin");
    if (githubLogin) {
      localStorage.setItem("githubLogin", githubLogin);
    }
    window.location.replace("/repos");
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">ログイン中...</p>
    </div>
  );
}
