import { useNavigate } from 'react-router-dom'
import { formatDate } from '../lib/utils'

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
      <h2 className="text-xl font-bold text-gray-900 mb-4">Saved Conversations</h2>

      {threads.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="text-6xl">💬</div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No saved conversations yet</h2>
          <p className="mt-2 text-gray-600">
            When you chat with shared documents and save the conversation, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => navigate(`/threads/${thread.id}`)}
            className="bg-white rounded-lg p-4 shadow transition-shadow hover:shadow-lg text-left border border-gray-200 hover:border-blue-300"
          >
            {/* Project name */}
            <div className="font-medium text-gray-900 truncate mb-2">
              {thread.project.name}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
              <span>{thread.messageCount} messages</span>
              <span>•</span>
              <span>{formatDate(thread.startedAt)}</span>
            </div>

            {/* Status badge */}
            <div>
              {thread.endedAt ? (
                <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                  Ended
                </span>
              ) : (
                <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                  Active
                </span>
              )}
            </div>
          </button>
        ))}
        </div>
      )}
    </section>
  )
}
