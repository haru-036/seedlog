'use client'

import { useState, useCallback, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { DashboardHeader } from '@/components/dashboard-header'
import { LogForm } from '@/components/log-form'
import { LogList } from '@/components/log-list'
import { AIPanel } from '@/components/ai-panel'
import { fetcher } from '@/lib/api'

// バックエンドのスキーマに合わせた型定義
export interface Log {
  id: string
  userId: string
  questionId: string | null
  content: string
  source: 'github_push' | 'discord_command' | 'discord_reply' | 'web'
  createdAt: string
}

interface LogsResponse {
  logs: Log[]
  total: number
  hasMore: boolean
}

interface Notification {
  id: string; type: string; title: string; message: string; metadata: any; is_read: boolean; created_at: string
}

export function DashboardClient() {
  const [githubLogin, setGithubLogin] = useState<string | null>(null)

  useEffect(() => {
    setGithubLogin(localStorage.getItem("githubLogin"))
  }, [])

  // バックエンドの /api/logs からデータを取得
  const { data } = useSWR<LogsResponse>('/api/logs', fetcher, {
    onError: (err) => console.warn('API fetch failed:', err.message)
  })
  
  const logs = data?.logs ?? []

  const [prefillContent, setPrefillContent] = useState<string>('')

  const handleCreateLogFromPush = useCallback((notification: Notification) => {
    const content = `# ${notification.metadata?.repo || 'GitHub'} へのpush\n\n## ブランチ\n${notification.metadata?.branch || 'unknown'}\n\n## コミット内容\n${notification.metadata?.commit_messages || '(コミットメッセージなし)'}\n\n## 学び・気づき\n\n`
    setPrefillContent(content)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleLogCreated = useCallback(() => {
    mutate('/api/logs')
    setPrefillContent('')
  }, [])

  const handleLogDeleted = useCallback((deletedId: string) => {
    if (data) {
      mutate('/api/logs', {
        ...data,
        logs: data.logs.filter((log) => log.id !== deletedId),
        total: data.total - 1
      }, false)
    }
  }, [data])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader 
        displayName={githubLogin ? `@${githubLogin}` : 'ゲスト'} 
        onCreateLogFromPush={handleCreateLogFromPush}
      />
      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">開発ログ</h1>
              <p className="text-muted-foreground text-sm">日々の開発活動を記録しましょう</p>
            </div>
            <LogForm 
              onLogCreated={handleLogCreated}
              prefillContent={prefillContent}
            />
            <LogList logs={logs} onLogDeleted={handleLogDeleted} />
          </div>
          <div className="lg:col-span-1">
            <AIPanel logs={logs as any} /> 
          </div>
        </div>
      </main>
    </div>
  )
}