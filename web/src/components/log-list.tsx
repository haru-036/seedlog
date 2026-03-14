'use client'

import { useState } from 'react'
import { LogCard } from './log-card'
import { FileText } from 'lucide-react'
import type { Log } from './dashboard-client'

interface LogListProps {
  logs: Log[]
  onLogDeleted?: (id: string) => void
}

const SOURCES = [
  { value: 'web', label: 'Webから', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'github_push', label: 'GitHub', color: 'bg-gray-500/20 text-gray-400' },
  { value: 'discord_command', label: 'Discord', color: 'bg-indigo-500/20 text-indigo-400' },
  { value: 'discord_reply', label: 'Discord (返信)', color: 'bg-indigo-500/20 text-indigo-400' },
]

export function LogList({ logs, onLogDeleted }: LogListProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const filteredLogs = selectedSource
    ? logs.filter((log) => log.source === selectedSource)
    : logs

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedSource(null)}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            selectedSource === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
          }`}
        >
          すべて
        </button>
        {SOURCES.map((source) => (
          <button
            key={source.value}
            onClick={() => setSelectedSource(source.value)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedSource === source.value
                ? source.color
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {source.label}
          </button>
        ))}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-50" />
          <p>ログがありません</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLogs.map((log) => (
            <LogCard key={log.id} log={log} onDeleted={onLogDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}