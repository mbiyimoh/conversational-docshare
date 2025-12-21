import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatInput } from '../ChatInput'
import { CommentOverlay } from './CommentOverlay'
import { api } from '../../lib/api'
import { convertCitationsToNumbered, citationUrlTransform, parseCitationUrl } from '../../lib/documentReferences'
import { getSectionInfo, getDocumentDisplayName } from '../../lib/documentLookup'
import { createMarkdownComponents } from '../../lib/markdownConfig'
import { CitationPill } from '../chat/CitationPill'
import { CitationBlock, type Citation } from '../chat/CitationBlock'
import type { TestMessage, TestComment } from '../../types/testing'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Markdown content renderer for Dojo messages using shared config
 * Uses numbered citation pills with collapsible citation block (display-only, non-clickable)
 */
function DojoMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  // Convert citations to numbered format and collect citation data
  const { processedContent, citations } = useMemo(() => {
    const { content: processed, citations: collected } = convertCitationsToNumbered(content)

    // Enrich citations with document/section titles
    const enrichedCitations: Citation[] = collected.map((c) => {
      const sectionInfo = getSectionInfo(c.filename, c.sectionId)
      // If section lookup fails, still try to get document display name
      // This handles cases where section ID doesn't match but document exists
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
          // Citations in Testing Dojo are display-only (not clickable)
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

interface DojoChatProps {
  projectId: string
  sessionId: string
  messages: TestMessage[]
  onNewMessage: (message: TestMessage) => void
  onAddComment: (messageId: string, comment: TestComment) => void
}

export function DojoChat({
  sessionId,
  messages,
  onNewMessage,
  onAddComment,
}: DojoChatProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [commentingMessageId, setCommentingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: TestMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      comments: [],
    }
    onNewMessage(userMessage)

    // Start streaming
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(
        `${API_URL}/api/test-sessions/${sessionId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: content }),
        }
      )

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response stream')

      let fullContent = ''
      let assistantMessageId = ''
      let userMessageId = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              if (parsed.chunk) {
                fullContent += parsed.chunk
                setStreamingContent(fullContent)
              }
              if (parsed.messageId) {
                assistantMessageId = parsed.messageId
              }
              if (parsed.userMessageId) {
                userMessageId = parsed.userMessageId
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Update user message with real ID if provided
      if (userMessageId) {
        // The user message was already added, we just note the real ID
      }

      // Add assistant message
      const assistantMessage: TestMessage = {
        id: assistantMessageId || `temp-assistant-${Date.now()}`,
        sessionId,
        role: 'assistant',
        content: fullContent,
        createdAt: new Date().toISOString(),
        comments: [],
      }
      onNewMessage(assistantMessage)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleAddComment = async (messageId: string, content: string, templateId?: string) => {
    try {
      const response = await api.addTestComment(messageId, content, templateId)
      onAddComment(messageId, response.comment)
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
    setCommentingMessageId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`group relative max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-background-elevated text-foreground'
              }`}
            >
              {/* Render message content with markdown support */}
              <DojoMessageContent content={message.content} isUser={message.role === 'user'} />

              {/* Comment indicator */}
              {message.comments.length > 0 && (
                <div className="absolute -right-2 -top-2 bg-accent text-background text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {message.comments.length}
                </div>
              )}

              {/* Add comment button (assistant messages only) */}
              {message.role === 'assistant' && !message.id.startsWith('temp-') && (
                <button
                  onClick={() => setCommentingMessageId(message.id)}
                  className="absolute -bottom-2 right-2 text-xs text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity bg-card-bg px-2 py-0.5 rounded shadow-sm"
                >
                  + Add Comment
                </button>
              )}

              {/* Comment overlay */}
              {commentingMessageId === message.id && (
                <CommentOverlay
                  onSubmit={(content, templateId) => handleAddComment(message.id, content, templateId)}
                  onCancel={() => setCommentingMessageId(null)}
                />
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-background-elevated px-4 py-3">
              {/* Render streaming content with markdown support */}
              <DojoMessageContent content={streamingContent} isUser={false} />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-background-elevated px-4 py-2">
              <div className="flex space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isStreaming}
        placeholder="Test your AI agent... Ask a question a recipient might ask"
      />
    </div>
  )
}
