import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { JumpToBottomIndicator } from './chat/JumpToBottomIndicator'
import { useViewerPreferences } from './viewer-prefs/useViewerPreferences'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  /** Hidden expansion prompts are not displayed in UI */
  isHiddenExpansion?: boolean
}

interface ChatInterfaceProps {
  conversationId: string
  onCitationClick?: (documentId: string, sectionId: string) => void
  onMessagesChange?: (messages: Array<{ role: string; content: string }>) => void
}

const API_URL = import.meta.env.VITE_API_URL || ''

export function ChatInterface({ conversationId, onCitationClick, onMessagesChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [loadError, setLoadError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get viewer preferences for depth setting
  const { preferences } = useViewerPreferences()

  // Smart scroll state
  const [isAtBottom, setIsAtBottom] = useState(false) // Start false - detect actual position
  const [showJumpIndicator, setShowJumpIndicator] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollSentinelRef = useRef<HTMLDivElement>(null)
  const userJustSentMessage = useRef(false)
  const hasInitialScrolled = useRef(false) // Track initial scroll to bottom

  // Progressive disclosure state - track which messages have been expanded
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set())
  const [expandingMessageId, setExpandingMessageId] = useState<string | null>(null)

  // Intersection Observer for bottom detection
  useEffect(() => {
    const sentinel = scrollSentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const atBottom = entry.isIntersecting
        setIsAtBottom(atBottom)

        if (atBottom) {
          setShowJumpIndicator(false)
          setUnreadCount(0)
        }
      },
      {
        root: container,
        threshold: 0.1,
        rootMargin: '100px' // Trigger slightly before reaching absolute bottom
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Show indicator when streaming and user not at bottom
  useEffect(() => {
    if (isStreaming && !isAtBottom && !userJustSentMessage.current) {
      setShowJumpIndicator(true)
    }
  }, [isStreaming, isAtBottom])

  // Track unread messages when not at bottom
  useEffect(() => {
    if (!isAtBottom && streamingContent) {
      // Count "chunks" that would represent new content
      setUnreadCount(prev => Math.min(prev + 1, 99))
    }
  }, [streamingContent, isAtBottom])

  // Initial scroll to bottom on first load (after messages are loaded)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || hasInitialScrolled.current || messages.length === 0) return

    // Scroll to bottom on initial load only
    container.scrollTo({ top: container.scrollHeight, behavior: 'instant' })
    hasInitialScrolled.current = true
  }, [messages.length])

  // Smart auto-scroll: ONLY when user explicitly sent a message
  // Do NOT auto-scroll during streaming - show jump indicator instead
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Only auto-scroll if user just sent a message (explicit intent)
    // Never force scroll during passive streaming
    if (userJustSentMessage.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })

      // Reset the "just sent" flag after scroll
      setTimeout(() => {
        userJustSentMessage.current = false
      }, 500)
    }
  }, [messages])

  // Load conversation history on mount
  useEffect(() => {
    loadConversationHistory()
  }, [conversationId])

  // Notify parent when messages change
  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages.map(m => ({ role: m.role, content: m.content })))
    }
  }, [messages, onMessagesChange])

  const loadConversationHistory = async () => {
    try {
      setLoadError('')
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}`)
      const data = await response.json()

      if (data.conversation?.messages) {
        setMessages(
          data.conversation.messages.map((msg: { id: string; role: string; content: string; createdAt: string }) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.createdAt),
          }))
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load conversation'
      setLoadError(message)
      console.error('Failed to load conversation history:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
    // Set flag for auto-scroll
    userJustSentMessage.current = true
    setShowJumpIndicator(false)
    setUnreadCount(0)

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Start streaming
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content,
            preferences: {
              depth: preferences.depth
            }
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream')
      }

      let fullContent = ''
      let responseSaved = false

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()

            if (data === '[DONE]') {
              // Stream complete - add assistant message
              if (fullContent.length > 0) {
                const assistantMessage: Message = {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, assistantMessage])
                responseSaved = true
              }
              setStreamingContent('')
              break
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.chunk) {
                fullContent += parsed.chunk
                setStreamingContent(fullContent)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // If we got content but no [DONE] signal, still save the response
      if (!responseSaved && fullContent.length > 0) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStreamingContent('')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  // Handle expand request - sends a hidden follow-up for organic content expansion
  const handleExpand = useCallback(async (messageId: string) => {
    // Find the message to expand
    const messageToExpand = messages.find(m => m.id === messageId)
    if (!messageToExpand || messageToExpand.role !== 'assistant') return

    // Mark as expanding
    setExpandingMessageId(messageId)
    userJustSentMessage.current = true
    setShowJumpIndicator(false)
    setUnreadCount(0)

    // Create expansion prompt - hidden from UI
    const expandPrompt = `Please expand on your previous response with more detail and examples. Your previous response was: "${messageToExpand.content.substring(0, 200)}${messageToExpand.content.length > 200 ? '...' : ''}"`

    // Add hidden user message (not displayed but sent to API)
    const hiddenUserMessage: Message = {
      id: `expand-${Date.now()}`,
      role: 'user',
      content: expandPrompt,
      timestamp: new Date(),
      isHiddenExpansion: true, // This prevents it from being displayed
    }
    setMessages((prev) => [...prev, hiddenUserMessage])

    // Start streaming
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: expandPrompt,
            preferences: {
              depth: preferences.depth
            }
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to expand message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream')
      }

      let fullContent = ''
      let responseSaved = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()

            if (data === '[DONE]') {
              // Stream complete - add expansion response
              if (fullContent.length > 0) {
                const expansionResponse: Message = {
                  id: `expansion-${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, expansionResponse])
                responseSaved = true
              }
              setStreamingContent('')
              break
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.chunk) {
                fullContent += parsed.chunk
                setStreamingContent(fullContent)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // If we got content but no [DONE] signal, still save the response
      if (!responseSaved && fullContent.length > 0) {
        const expansionResponse: Message = {
          id: `expansion-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, expansionResponse])
        responseSaved = true
        setStreamingContent('')
      }

      // Mark original message as expanded only if we got a response
      if (responseSaved) {
        setExpandedMessageIds(prev => new Set([...prev, messageId]))
      }
    } catch (error) {
      console.error('Failed to expand message:', error)
      // Show error message to user
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error expanding that response. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      setExpandingMessageId(null)
    }
  }, [messages, conversationId])

  // Jump to bottom handler
  const handleJumpToBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    })
    setShowJumpIndicator(false)
    setUnreadCount(0)
  }, [])

  return (
    <div className="flex h-full flex-col relative">
      {/* Error banner */}
      {loadError && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4">
          <div className="flex items-center">
            <span className="text-destructive">{loadError}</span>
            <button
              onClick={() => setLoadError('')}
              className="ml-auto text-destructive hover:text-destructive/80 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Messages container - add ref for scroll control */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {/* Filter out hidden expansion prompts for organic content expansion UX */}
        {messages
          .filter((message) => !message.isHiddenExpansion)
          .map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              messageId={message.id}
              isExpanded={expandedMessageIds.has(message.id)}
              isExpandLoading={expandingMessageId === message.id}
              onCitationClick={onCitationClick}
              onExpand={handleExpand}
            />
          ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
            isStreaming={true}
            onCitationClick={onCitationClick}
          />
        )}

        {/* Loading indicator */}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-card-bg border border-border px-4 py-2">
              <div className="flex space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Scroll sentinel - invisible element at bottom */}
        <div ref={scrollSentinelRef} className="h-px" />

        {/* Original messagesEndRef for compatibility */}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to bottom indicator */}
      <JumpToBottomIndicator
        visible={showJumpIndicator}
        unreadCount={unreadCount}
        onClick={handleJumpToBottom}
      />

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
    </div>
  )
}
