import { useState, useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

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
          body: JSON.stringify({ message: content }),
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
              const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
                timestamp: new Date(),
              }
              setMessages((prev) => [...prev, assistantMessage])
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

  return (
    <div className="flex h-full flex-col">
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

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            onCitationClick={onCitationClick}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
    </div>
  )
}
