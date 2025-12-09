import { useState } from 'react'
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
        className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
      >
        <span className="text-sm font-medium">
          {activeSession?.name || 'Select Session'}
        </span>
        <span className="text-xs text-gray-500">
          {activeSession?.status === 'active' ? '● Active' : '○ Ended'}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-50">
          {/* New Session Button */}
          <div className="p-2 border-b">
            <button
              onClick={() => {
                onCreateSession()
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg text-left"
            >
              + New Session
            </button>
          </div>

          {/* Session List */}
          <div className="max-h-60 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No sessions yet
              </div>
            ) : (
              sessions.map((session, index) => (
                <div
                  key={session.id}
                  className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                    session.id === activeSessionId ? 'bg-blue-50' : ''
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
                      <div className="font-medium text-sm">
                        {session.name || `Session #${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(session.createdAt)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {session.messageCount} messages · {session.commentCount} comments
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === 'active' && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      )}
                      {confirmDelete === session.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteSession(session.id)
                              setConfirmDelete(null)
                            }}
                            className="text-xs px-2 py-1 bg-red-500 text-white rounded"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDelete(null)
                            }}
                            className="text-xs px-2 py-1 bg-gray-300 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDelete(session.id)
                          }}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          ✕
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
