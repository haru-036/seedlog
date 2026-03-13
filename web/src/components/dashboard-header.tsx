import { Button } from '@/components/ui/button'
import { FileText, LogOut } from 'lucide-react'
import { NotificationPanel } from './notification-panel'

// 通知データの型定義
interface Notification {
  id: string
  type: string
  title: string
  message: string
  metadata: any
  is_read: boolean
  created_at: string
}

interface DashboardHeaderProps {
  displayName?: string | null
  onCreateLogFromPush?: (notification: Notification) => void
}

export function DashboardHeader({ displayName, onCreateLogFromPush }: DashboardHeaderProps) {
  const handleSignOut = () => {
    // ローカルストレージに保存されている認証情報（ユーザー情報）をクリア
    localStorage.removeItem('githubLogin')
    localStorage.removeItem('discordId')
    localStorage.removeItem('discordUsername')
    
    // トップページ（ログイン画面）へリダイレクト
    window.location.replace('/') 
  }

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* 左側：ロゴとアプリ名 */}
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Seedlog</span>
        </div>

        {/* 右側：ユーザー名、通知、ログアウト */}
        <div className="flex items-center gap-3">
          {displayName && (
            <span className="text-sm text-muted-foreground hidden sm:block">
              {displayName}
            </span>
          )}
          
          {/* GitHub Push などの通知パネル */}
          <NotificationPanel onCreateLogFromPush={onCreateLogFromPush} />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">ログアウト</span>
          </Button>
        </div>

      </div>
    </header>
  )
}