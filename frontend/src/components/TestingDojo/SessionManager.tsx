import { useState } from 'react'
import { Badge, Button } from '../ui'
import { ChevronDown, Plus, X } from 'lucide-react'
import type { TestSessionSummary } from '../../types/testing'

interface SessionManagerProps {
  sessions: TestSessionSummary[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
}

export function SessionManager({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: SessionManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-white/5 transition-colors text-foreground"
      >
        <span className="text-sm font-medium">
          {activeSession?.name || 'Select Session'}
        </span>
        <span className="text-xs text-muted">
          {activeSession?.status === 'active' ? '● Active' : '○ Ended'}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-card-bg border border-border rounded-lg shadow-lg z-50">
          {/* New Session Button */}
          <div className="p-2 border-b border-border">
            <button
              onClick={() => {
                onCreateSession()
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-sm text-accent hover:bg-accent/10 rounded-lg text-left flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          </div>

          {/* Session List */}
          <div className="max-h-60 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-4 text-sm text-muted text-center">
                No sessions yet
              </div>
            ) : (
              sessions.map((session, index) => (
                <div
                  key={session.id}
                  className={`p-3 border-b border-border last:border-b-0 hover:bg-white/5 cursor-pointer transition-colors ${
                    session.id === activeSessionId ? 'bg-accent/10' : ''
                  }`}
                >
                  <div
                    onClick={() => {
                      onSelectSession(session.id)
                      setIsOpen(false)
                    }}
                    className="flex items-start justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm text-foreground">
                        {session.name || `Session #${index + 1}`}
                      </div>
                      <div className="text-xs text-muted">
                        {formatDate(session.createdAt)}
                      </div>
                      <div className="text-xs text-dim mt-1">
                        {session.messageCount} messages · {session.commentCount} comments
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === 'active' && (
                        <Badge variant="success">Active</Badge>
                      )}
                      {confirmDelete === session.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteSession(session.id)
                              setConfirmDelete(null)
                            }}
                            className="text-xs bg-destructive text-background hover:bg-destructive/90"
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDelete(null)
                            }}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDelete(session.id)
                          }}
                          className="text-dim hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
