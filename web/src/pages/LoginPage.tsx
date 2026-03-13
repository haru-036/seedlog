import { Button } from "@/components/ui/button";
import { FileText, Lightbulb, PenLine, TrendingUp } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col dark">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="size-5" />
          <span className="font-semibold text-lg">DevLog</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            ログイン
          </Button>
          <Button variant="outline" size="sm">
            新規登録
          </Button>
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
          <Button variant="outline" size="lg" className="mt-8">
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
                今日やったことをサッと記録。タグで整理して後から見返しやすく。
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
            無料でアカウント作成。すぐに記録を始められます。
          </p>
          <Button variant="outline" size="lg">
            アカウント作成
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border text-center">
        <p className="text-muted-foreground text-sm">
          DevLog - 開発者のための活動記録アプリ
        </p>
      </footer>
    </div>
  );
}
