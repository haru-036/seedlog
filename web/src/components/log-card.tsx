'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { apiFetch } from '@/lib/api'
import type { Log } from './dashboard-client'

interface LogCardProps {
  log: Log
  onDeleted?: (id: string) => void
}

export function LogCard({ log, onDeleted }: LogCardProps) {
  const [isPending, setIsPending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    setIsPending(true)
    try {
      // 自作APIでの削除処理（エンドポイントがある想定）
      await apiFetch(`/api/logs/${log.id}`, { method: 'DELETE' })
      setShowConfirm(false)
      onDeleted?.(log.id)
    } catch (err) {
      console.error('削除エラー:', err)
    } finally {
      setIsPending(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  // ソース（記録元）を見やすい名前に変換
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'github_push': return 'GitHub Push'
      case 'discord_command':
      case 'discord_reply': return 'Discord'
      default: return 'Web'
    }
  }

  // 本文の1行目をタイトル代わりにする
  const lines = log.content.split('\n')
  const pseudoTitle = lines[0].slice(0, 50) + (lines[0].length > 50 ? '...' : '')
  const restContent = lines.slice(1).join('\n').trim()

  return (
    <Card className="border-border/50 group">
      <CardHeader className="flex flex-row items-start justify-between py-3 gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {/* 1行目をタイトル風に表示 */}
          <CardTitle className="text-base font-medium truncate">{pseudoTitle || '無題のログ'}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
            {/* Sourceをバッジとして表示 */}
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground">
              {getSourceLabel(log.source)}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowConfirm(true)} className="text-destructive-foreground">
              <Trash2 className="h-4 w-4 mr-2" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      {restContent && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
            {restContent}
          </p>
        </CardContent>
      )}
      
      {showConfirm && (
        <div className="absolute inset-0 bg-background/95 flex items-center justify-center rounded-lg">
          <div className="flex flex-col gap-3 p-4 text-center">
            <p className="text-sm">このログを削除しますか？</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)} disabled={isPending}>
                キャンセル
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
                {isPending ? '削除中...' : '削除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}