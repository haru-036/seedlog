import { Button } from "@/components/ui/button";
import { Lightbulb, PenLine, TrendingUp } from "lucide-react";
import { API_BASE } from "../lib/api";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col dark">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Seedlog" className="size-8" />
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
              Seedlog
            </h1>
        </div>
        <div className="flex items-center gap-4">
          <a
          href={`${API_BASE}/api/auth/github`}
          className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub でログイン
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance">
            日々の開発を、未来の武器に
          </h1>
          <p className="mt-6 text-muted-foreground max-w-2xl text-balance">
            開発活動を気軽に記録。LTネタ探し、ES作成、成長の振り返りに活用できます。
          </p>
          <Button variant="outline" size="lg" className="mt-8" onClick={() => {
            window.location.href = `${API_BASE}/api/auth/github`;}}>
            無料で始める
          </Button>
        </section>

        {/* Features Section */}
        <section className="px-6 py-24">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-16">
            できること
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="size-16 rounded-full bg-secondary flex items-center justify-center mb-6">
                <PenLine className="size-6 text-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-3">気軽に記録</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                今日やったことをサッと記録。整理して後から見返しやすく。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="size-16 rounded-full bg-secondary flex items-center justify-center mb-6">
                <Lightbulb className="size-6 text-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-3">LTネタ発掘</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                蓄積されたログからAIがLTネタ候補を提案。発表のきっかけに。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="size-16 rounded-full bg-secondary flex items-center justify-center mb-6">
                <TrendingUp className="size-6 text-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-3">成長を可視化</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                開発の軌跡を振り返り、自分の成長を実感。就活ESにも活用可能。
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-24 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            今すぐ始めよう
          </h2>
          <p className="text-muted-foreground mb-8">
            無料ですぐに記録を始められます。
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border text-center">
        <p className="text-muted-foreground text-sm">
          SeedLog - 開発者のための活動記録アプリ
        </p>
      </footer>
    </div>
  );
}
