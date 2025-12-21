import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import { RecipientMessageDisplay } from './RecipientMessageDisplay'
import { ConversationRecommendations } from './ConversationRecommendations'
import { Card, Badge } from './ui'
import { X, ArrowLeft, Lightbulb, Clock, MessageSquare, User } from 'lucide-react'
import { convertCitationsToNumbered, citationUrlTransform, parseCitationUrl } from '../lib/documentReferences'
import { getSectionInfo, getDocumentDisplayName } from '../lib/documentLookup'
import { createMarkdownComponents } from '../lib/markdownConfig'
import { CitationPill } from './chat/CitationPill'
import { CitationBlock, type Citation } from './chat/CitationBlock'

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

/**
 * Markdown content renderer with citation support for conversation messages
 * Uses numbered citation pills with collapsible citation block (display-only, non-clickable)
 */
function ConversationMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  // Convert citations to numbered format and collect citation data
  const { processedContent, citations } = useMemo(() => {
    const { content: processed, citations: collected } = convertCitationsToNumbered(content)

    // Enrich citations with document/section titles
    const enrichedCitations: Citation[] = collected.map((c) => {
      const sectionInfo = getSectionInfo(c.filename, c.sectionId)
      // If section lookup fails, still try to get document display name
      const documentTitle = sectionInfo?.documentTitle || getDocumentDisplayName(c.filename)
      return {
        number: c.number,
        filename: c.filename,
        sectionId: c.sectionId,
        documentTitle: documentTitle || undefined,
        sectionTitle: sectionInfo?.sectionTitle,
      }
    })

    return { processedContent: processed, citations: enrichedCitations }
  }, [content])

  const markdownComponents = useMemo(
    () =>
      createMarkdownComponents({
        isUser,
        renderLink: ({ href }) => {
          // Citations display-only (not clickable in conversation detail view)
          const citation = parseCitationUrl(href || '')
          if (citation && citation.number !== undefined) {
            return (
              <CitationPill
                number={citation.number}
                isUserMessage={isUser}
              />
            )
          }
          // Regular links use default rendering from shared config
          return undefined
        },
      }),
    [isUser]
  )

  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={citationUrlTransform}>
        {processedContent}
      </ReactMarkdown>
      {/* Citation block for messages with citations */}
      {citations.length > 0 && (
        <CitationBlock citations={citations} />
      )}
    </div>
  )
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Nearly Fullscreen Modal */}
      <div className="fixed inset-4 bg-card-bg border border-border shadow-2xl z-50 flex flex-col rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background-elevated">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="text-dim hover:text-foreground mr-3 transition-colors"
              aria-label="Close panel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg text-foreground">
              Conversation Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-dim hover:text-foreground p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mb-4" />
              <div className="text-muted">Loading conversation...</div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 w-full">
              {error}
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && conversation && (
          <>
            {/* AI Summary - Prominent at Top */}
            {conversation.summary && (
              <div className="px-6 py-5 bg-accent/10 border-b border-accent/30">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-1 font-mono">
                      AI Summary
                    </div>
                    <div className="text-foreground leading-relaxed">
                      {conversation.summary}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata Section */}
            <div className="px-6 py-4 bg-background-elevated border-b border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Viewer Info */}
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-dim uppercase tracking-wide font-mono">
                    <User className="w-3 h-3" />
                    Viewer
                  </div>
                  <div className="text-sm text-foreground mt-1">
                    {conversation.viewerName || conversation.viewerEmail || 'Anonymous'}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-dim uppercase tracking-wide font-mono">
                    <Clock className="w-3 h-3" />
                    Duration
                  </div>
                  <div className="text-sm text-foreground mt-1">
                    {formatDuration(conversation.durationSeconds)}
                  </div>
                </div>

                {/* Messages */}
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-dim uppercase tracking-wide font-mono">
                    <MessageSquare className="w-3 h-3" />
                    Messages
                  </div>
                  <div className="text-sm text-foreground mt-1">
                    {conversation.messageCount}
                  </div>
                </div>

                {/* Sentiment Badge */}
                <div>
                  <div className="text-xs font-medium text-dim uppercase tracking-wide mb-1 font-mono">
                    Sentiment
                  </div>
                  {conversation.sentiment ? (
                    getSentimentBadge(conversation.sentiment)
                  ) : (
                    <span className="text-sm text-dim">-</span>
                  )}
                </div>
              </div>

              {/* Topics */}
              {conversation.topics && conversation.topics.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-dim uppercase tracking-wide mb-2 font-mono">
                    Topics
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {conversation.topics.map((topic, idx) => (
                      <Badge key={idx} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-4 pt-3 border-t border-border text-xs text-dim flex gap-4">
                <div>Started: {formatDate(conversation.startedAt)}</div>
                {conversation.endedAt && (
                  <div>Ended: {formatDate(conversation.endedAt)}</div>
                )}
              </div>
            </div>

            {/* Recipient Message (if exists) */}
            {conversation.recipientMessage && (
              <div className="px-6 py-4 border-b border-border">
                <RecipientMessageDisplay message={conversation.recipientMessage} />
              </div>
            )}

            {/* AI Recommendations */}
            {conversation.endedAt && (
              <div className="px-6 py-4 border-b border-border">
                <ConversationRecommendations
                  conversationId={conversation.id}
                  projectId={conversation.projectId}
                />
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {conversation.messages.length === 0 ? (
                <div className="text-center text-muted py-8">
                  No messages in this conversation
                </div>
              ) : (
                conversation.messages.map((message) => (
                  <Card
                    key={message.id}
                    className={`p-4 ${
                      message.role === 'user'
                        ? 'ml-8 bg-accent/10 border-accent/30'
                        : 'mr-8'
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide font-mono ${
                          message.role === 'user' ? 'text-accent' : 'text-muted'
                        }`}
                      >
                        {message.role === 'user' ? 'Viewer' : 'AI Agent'}
                      </span>
                      <span className="text-xs text-dim">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>

                    {/* Message Content */}
                    {message.role === 'assistant' ? (
                      <ConversationMessageContent
                        content={message.content}
                        isUser={false}
                      />
                    ) : (
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
