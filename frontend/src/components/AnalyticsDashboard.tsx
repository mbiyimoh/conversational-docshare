import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { ConversationDetailPanel } from './ConversationDetailPanel'
import { AudienceSynthesisPanel } from './AudienceSynthesisPanel'
import { Card, Button, Badge } from './ui'
import { Download, MessageSquare, Users, Eye, BarChart3 } from 'lucide-react'

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

  const getSentimentBadge = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return <Badge variant="success">{sentiment}</Badge>
      case 'negative':
        return <Badge variant="destructive">{sentiment}</Badge>
      case 'neutral':
        return <Badge variant="secondary">{sentiment}</Badge>
      default:
        return <Badge variant="secondary">{sentiment || 'Unknown'}</Badge>
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
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading analytics...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
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
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <MessageSquare className="w-4 h-4 text-accent" />
            Total Conversations
          </div>
          <div className="mt-2 font-display text-3xl text-foreground">
            {analytics.overview.totalConversations}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <BarChart3 className="w-4 h-4 text-accent" />
            Total Messages
          </div>
          <div className="mt-2 font-display text-3xl text-foreground">
            {analytics.overview.totalMessages}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Eye className="w-4 h-4 text-accent" />
            Total Views
          </div>
          <div className="mt-2 font-display text-3xl text-foreground">
            {analytics.overview.totalViews}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Users className="w-4 h-4 text-accent" />
            Avg Messages/Conv
          </div>
          <div className="mt-2 font-display text-3xl text-foreground">
            {analytics.overview.avgMessagesPerConversation.toFixed(1)}
          </div>
        </Card>
      </div>

      {/* Conversations by Day Chart */}
      {analytics.conversationsByDay.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 font-display text-lg text-foreground">
            Conversations Over Time (Last 30 Days)
          </h3>
          <div className="space-y-2">
            {analytics.conversationsByDay.map((day) => {
              const maxCount = Math.max(...analytics.conversationsByDay.map((d) => d.count), 1)
              return (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="relative h-8 overflow-hidden rounded bg-background-elevated">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{
                          width: `${(day.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm font-medium text-foreground">
                    {day.count}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Recent Conversations Table */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-foreground">Recent Conversations</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting || analytics.recentConversations.length === 0}
            isLoading={exporting}
          >
            <Download className="w-4 h-4 mr-1" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background-elevated">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dim font-mono">
                  Viewer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dim font-mono">
                  Messages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dim font-mono">
                  Summary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dim font-mono">
                  Sentiment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dim font-mono">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dim font-mono">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics.recentConversations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted">
                    No conversations yet
                  </td>
                </tr>
              ) : (
                analytics.recentConversations.map((conversation) => (
                  <tr
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className="cursor-pointer hover:bg-white/5 align-top transition-colors"
                  >
                    <td className="whitespace-nowrap px-6 py-6">
                      <div className="text-sm font-medium text-foreground">
                        {conversation.viewerEmail || 'Anonymous'}
                      </div>
                      {conversation.viewerName && conversation.viewerEmail && (
                        <div className="text-xs text-muted mt-1">
                          {conversation.viewerName}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      <div className="text-sm text-foreground">{conversation.messageCount}</div>
                    </td>
                    <td className="px-6 py-6" style={{ maxWidth: '400px' }}>
                      <div
                        className="text-sm text-muted line-clamp-3 leading-relaxed"
                        title={conversation.summary || ''}
                      >
                        {conversation.summary || (
                          <span className="text-dim italic">No summary</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      {conversation.sentiment ? (
                        getSentimentBadge(conversation.sentiment)
                      ) : (
                        <span className="text-sm text-dim">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      <div className="text-sm text-foreground">
                        {formatDate(conversation.startedAt)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-6">
                      {conversation.endedAt ? (
                        <Badge variant="secondary">Ended</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
