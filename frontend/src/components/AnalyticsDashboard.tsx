import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { ConversationDetailPanel } from './ConversationDetailPanel'
import { AudienceSynthesisPanel } from './AudienceSynthesisPanel'

interface Conversation {
  id: string
  viewerEmail: string | null
  viewerName: string | null
  messageCount: number
  durationSeconds: number | null
  sentiment: string | null
  topics: string[]
  summary: string | null
  startedAt: string
  endedAt: string | null
}

interface DayData {
  date: string
  count: number
}

interface AnalyticsData {
  overview: {
    totalConversations: number
    totalMessages: number
    totalViews: number
    avgMessagesPerConversation: number
    avgDurationSeconds: number
  }
  recentConversations: Conversation[]
  conversationsByDay: DayData[]
}

interface AnalyticsDashboardProps {
  projectId: string
}

export function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    // Only load if we have a valid projectId
    if (projectId && projectId !== ':projectId') {
      loadAnalytics()
    } else {
      setLoading(false)
    }
  }, [projectId])

  const loadAnalytics = async () => {
    if (!projectId || projectId === ':projectId') {
      setError('Invalid project ID')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await api.getProjectAnalytics(projectId)
      setAnalytics(response.analytics as AnalyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'text-green-600 bg-green-50'
      case 'negative':
        return 'text-red-600 bg-red-50'
      case 'neutral':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const handleExportCSV = async () => {
    if (!projectId || projectId === ':projectId') {
      return
    }

    try {
      setExporting(true)
      const blob = await api.exportConversationsCSV(projectId)

      // Create download link
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `conversations-${projectId}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(anchor)
      anchor.click()

      // Cleanup
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-600">
        {error}
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Audience Synthesis Panel */}
      <AudienceSynthesisPanel projectId={projectId} />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">Total Conversations</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {analytics.overview.totalConversations}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">Total Messages</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {analytics.overview.totalMessages}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">Total Views</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {analytics.overview.totalViews}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">Avg Messages/Conversation</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {analytics.overview.avgMessagesPerConversation.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Conversations by Day Chart */}
      {analytics.conversationsByDay.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Conversations Over Time (Last 30 Days)
          </h3>
          <div className="space-y-2">
            {analytics.conversationsByDay.map((day) => {
              const maxCount = Math.max(...analytics.conversationsByDay.map((d) => d.count), 1)
              return (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="relative h-8 overflow-hidden rounded bg-gray-100">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${(day.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm font-medium text-gray-900">
                    {day.count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Conversations Table */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Conversations</h3>
          <button
            onClick={handleExportCSV}
            disabled={exporting || analytics.recentConversations.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Viewer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Messages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Summary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Sentiment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {analytics.recentConversations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No conversations yet
                  </td>
                </tr>
              ) : (
                analytics.recentConversations.map((conversation) => (
                  <tr
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className="cursor-pointer hover:bg-gray-50 align-top"
                  >
                    <td className="whitespace-nowrap px-6 py-6">
                      <div className="text-sm font-medium text-gray-900">
                        {conversation.viewerEmail || 'Anonymous'}
                      </div>
                      {conversation.viewerName && conversation.viewerEmail && (
                        <div className="text-xs text-gray-500 mt-1">
                          {conversation.viewerName}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      <div className="text-sm text-gray-900">{conversation.messageCount}</div>
                    </td>
                    <td className="px-6 py-6" style={{ maxWidth: '400px' }}>
                      <div
                        className="text-sm text-gray-900 line-clamp-3 leading-relaxed"
                        title={conversation.summary || ''}
                      >
                        {conversation.summary || (
                          <span className="text-gray-400 italic">No summary</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      {conversation.sentiment ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getSentimentColor(
                            conversation.sentiment
                          )}`}
                        >
                          {conversation.sentiment}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      <div className="text-sm text-gray-900">
                        {formatDate(conversation.startedAt)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      {conversation.endedAt ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                          Ended
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-600">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversation Detail Panel */}
      {selectedConversationId && (
        <ConversationDetailPanel
          conversationId={selectedConversationId}
          onClose={() => setSelectedConversationId(null)}
        />
      )}
    </div>
  )
}
