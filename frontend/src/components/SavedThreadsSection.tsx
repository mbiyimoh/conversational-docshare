import { useNavigate } from 'react-router-dom'
import { MessageSquareText } from 'lucide-react'
import { formatDate } from '../lib/utils'
import { Card, Badge, SectionLabel } from './ui'

// Empty state icon using Lucide
function EmptyChatIcon() {
  return (
    <MessageSquareText
      className="mx-auto text-accent w-20 h-20"
      strokeWidth={1.5}
    />
  )
}

export interface SavedThread {
  id: string
  messageCount: number
  startedAt: string
  endedAt: string | null
  project: {
    id: string
    name: string
  }
}

interface SavedThreadsSectionProps {
  threads: SavedThread[]
}

export function SavedThreadsSection({ threads }: SavedThreadsSectionProps) {
  const navigate = useNavigate()

  return (
    <section className="mb-8" data-testid="saved-threads-section">
      <SectionLabel number={3} title="SAVED CONVERSATIONS" />

      {threads.length === 0 ? (
        <Card className="p-12 text-center">
          <EmptyChatIcon />
          <h2 className="mt-6 font-display text-xl text-foreground">No saved conversations yet</h2>
          <p className="mt-2 text-muted">
            When you chat with shared documents and save the conversation, it will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {threads.map((thread) => (
          <Card
            key={thread.id}
            className="cursor-pointer transition-all hover:border-accent/50 hover:shadow-[0_0_20px_hsl(var(--color-accent-glow))]"
            onClick={() => navigate(`/threads/${thread.id}`)}
          >
            {/* Project name */}
            <div className="font-display text-foreground truncate mb-2">
              {thread.project.name}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-sm text-muted mb-3">
              <span><span className="text-accent font-medium">{thread.messageCount}</span> messages</span>
              <span className="text-dim">·</span>
              <span>{formatDate(thread.startedAt)}</span>
            </div>

            {/* Status badge */}
            <div>
              {thread.endedAt ? (
                <Badge variant="secondary">Ended</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
            </div>
          </Card>
        ))}
        </div>
      )}
    </section>
  )
}
