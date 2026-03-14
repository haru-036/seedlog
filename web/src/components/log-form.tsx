'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface LogFormProps {
  onLogCreated?: () => void
  prefillContent?: string
}

export function LogForm({ onLogCreated, prefillContent }: LogFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (prefillContent) {
      setContent(prefillContent)
      setIsOpen(true)
    }
  }, [prefillContent])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    
    try {
      // APIに送信（titleやtagsは不要、sourceはweb）
      const res = await apiFetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify({ 
          content,
          source: 'web'
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '保存に失敗しました')
      }

      setIsOpen(false)
      setContent('')
      onLogCreated?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsPending(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" />
        今日やったことを記録する
      </Button>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">新しいログ</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => { setIsOpen(false); setError(null); }}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Textarea
            name="content"
            placeholder="今日学んだこと、詰まったエラー、解決策などを自由に書いてください。"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="bg-secondary/50 resize-y"
          />
          {error && (
            <p className="text-sm text-destructive-foreground bg-destructive/10 p-2 rounded">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? '保存中...' : '保存'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}