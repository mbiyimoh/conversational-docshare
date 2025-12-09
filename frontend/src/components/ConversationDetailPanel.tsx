import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { ProfileSectionContent } from './ProfileSectionContent'
import { RecipientMessageDisplay } from './RecipientMessageDisplay'
import { ConversationRecommendations } from './ConversationRecommendations'

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface RecipientMessage {
  id: string
  content: string
  viewerName: string | null
  viewerEmail: string | null
  createdAt: string
}

interface ConversationDetail {
  id: string
  projectId: string
  viewerEmail: string | null
  viewerName: string | null
  messageCount: number
  durationSeconds: number | null
  sentiment: string | null
  startedAt: string
  endedAt: string | null
  messages: ConversationMessage[]
  summary?: string | null
  topics?: string[] | null
  recipientMessage?: RecipientMessage | null
}

interface ConversationDetailPanelProps {
  conversationId: string
  onClose: () => void
}

export function ConversationDetailPanel({
  conversationId,
  onClose,
}: ConversationDetailPanelProps) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadConversationDetail()
  }, [conversationId])

  const loadConversationDetail = async () => {
    try {
      setLoading(true)
      setError('')
      // Note: This API method will be added to api.ts
      // Using unknown and type assertion until the API method is properly added
      const response = await (api as unknown as {
        getConversationDetail: (id: string) => Promise<{ conversation: ConversationDetail }>
      }).getConversationDetail(conversationId)
      setConversation(response.conversation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'bg-green-100 text-green-800'
      case 'negative':
        return 'bg-red-100 text-red-800'
      case 'neutral':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Nearly Fullscreen Modal */}
      <div className="fixed inset-4 bg-white shadow-2xl z-50 flex flex-col rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 mr-3"
              aria-label="Close panel"
            >
              ←
            </button>
            <span className="text-lg font-semibold text-gray-900">
              Conversation Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
              <div className="text-gray-600">Loading conversation...</div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-red-50 text-red-600 rounded-lg p-4 w-full">
              {error}
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && conversation && (
          <>
            {/* AI Summary - Prominent at Top */}
            {conversation.summary && (
              <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                      AI Summary
                    </div>
                    <div className="text-gray-800 leading-relaxed">
                      {conversation.summary}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata Section */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Viewer Info */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Viewer
                  </div>
                  <div className="text-sm text-gray-900 mt-1">
                    {conversation.viewerName || conversation.viewerEmail || 'Anonymous'}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Duration
                  </div>
                  <div className="text-sm text-gray-900 mt-1">
                    {formatDuration(conversation.durationSeconds)}
                  </div>
                </div>

                {/* Messages */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Messages
                  </div>
                  <div className="text-sm text-gray-900 mt-1">
                    {conversation.messageCount}
                  </div>
                </div>

                {/* Sentiment Badge */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Sentiment
                  </div>
                  {conversation.sentiment ? (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getSentimentColor(
                        conversation.sentiment
                      )}`}
                    >
                      {conversation.sentiment}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* Topics */}
              {conversation.topics && conversation.topics.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Topics
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {conversation.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-4 pt-3 border-t text-xs text-gray-500 flex gap-4">
                <div>Started: {formatDate(conversation.startedAt)}</div>
                {conversation.endedAt && (
                  <div>Ended: {formatDate(conversation.endedAt)}</div>
                )}
              </div>
            </div>

            {/* Recipient Message (if exists) */}
            {conversation.recipientMessage && (
              <div className="px-6 py-4 border-b">
                <RecipientMessageDisplay message={conversation.recipientMessage} />
              </div>
            )}

            {/* AI Recommendations */}
            {conversation.endedAt && (
              <div className="px-6 py-4 border-b">
                <ConversationRecommendations
                  conversationId={conversation.id}
                  projectId={conversation.projectId}
                />
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {conversation.messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No messages in this conversation
                </div>
              ) : (
                conversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'ml-8 bg-blue-50 border border-blue-100'
                        : 'mr-8 bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          message.role === 'user' ? 'text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {message.role === 'user' ? 'Viewer' : 'AI Agent'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>

                    {/* Message Content */}
                    {message.role === 'assistant' ? (
                      <ProfileSectionContent
                        content={message.content}
                        className="text-sm"
                      />
                    ) : (
                      <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
