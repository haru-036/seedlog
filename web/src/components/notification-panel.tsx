import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { fetcher, apiFetch } from '@/lib/api'

// DashboardClient等で使っている型定義
export interface Notification {
  id: string
  type: string
  title: string
  message: string
  metadata: any
  is_read: boolean
  created_at: string
}

interface NotificationPanelProps {
  onCreateLogFromPush?: (notification: Notification) => void
}

export function NotificationPanel({ onCreateLogFromPush }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  // ▼ バックエンドの通知（または AIからの問いかけ）取得用エンドポイント
  // ※バックエンドの schema.ts にある `questions` テーブルから未回答のものを取得する
  // API（例: /api/notifications や /api/questions）を指定してください。
  const { data: notifications = [] } = useSWR<Notification[]>('/api/notifications', fetcher, {
    fallbackData: [],
    // ポーリングして新しい通知がないか定期チェックする場合は以下のオプションを有効にします
    // refreshInterval: 60000, // 1分ごとにチェック
    onError: (err) => console.warn('Notifications fetch failed:', err.message)
  })

  // 未読数のカウント
  const unreadCount = notifications.filter((n) => !n.is_read).length

  // 通知をクリックして既読にする処理
  const handleMarkAsRead = async (id: string) => {
    try {
      // 楽観的UI更新：APIの返事を待たずに、画面上だけ先に既読（is_read: true）にする
      mutate(
        '/api/notifications',
        notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        false
      )
      
      // バックエンドへ既読フラグを送信（ご自身のAPIエンドポイントに合わせてください）
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
      
      // 念のため最新のデータを再取得
      mutate('/api/notifications')
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  // 通知アイテムをクリックしたときの挙動
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
    setIsOpen(false)
    // ダッシュボード側のフォームに値を流し込む
    onCreateLogFromPush?.(notification)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          {/* 未読がある場合のみ赤いドットを表示 */}
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border border-background" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-border/50 bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h3 className="font-semibold text-sm">通知</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
              {unreadCount} 件の未読
            </span>
          )}
        </div>
        
        <div className="max-h-100px overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">新しい通知はありません</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex flex-col gap-1 p-4 text-left transition-colors border-b border-border/50 last:border-0 ${
                    !notification.is_read 
                      ? 'bg-primary/5 hover:bg-primary/10' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className={`text-sm leading-tight ${!notification.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                      {notification.title}
                    </span>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                  <span className={`text-xs line-clamp-2 mt-1 ${!notification.is_read ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                    {notification.message}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 mt-2 font-mono">
                    {new Date(notification.created_at).toLocaleString('ja-JP')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}