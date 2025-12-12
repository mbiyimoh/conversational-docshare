import { useNavigate } from 'react-router-dom'
import { formatDate } from '../lib/utils'
import { Card, Badge, SectionLabel } from './ui'

// Geometric SVG for empty state (chat bubble icon)
function EmptyChatIcon() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto text-accent"
    >
      <rect x="10" y="12" width="50" height="36" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M20 56L10 68V48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="25" cy="30" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="40" cy="30" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="55" cy="30" r="3" fill="currentColor" opacity="0.5" />
    </svg>
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
      <SectionLabel number={1} title="SAVED CONVERSATIONS" />

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
