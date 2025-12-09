import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Resplit } from 'react-resplit'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { ProfileSectionContent } from '../components/ProfileSectionContent'
import { ChatInput } from '../components/ChatInput'
import { DocumentCapsule } from '../components/DocumentCapsule'
import { DocumentContentViewer } from '../components/DocumentContentViewer'
import { EndSessionModal } from '../components/EndSessionModal'
import { cn } from '../lib/utils'
import {
  initDocumentLookup,
  lookupDocumentByFilename,
  clearDocumentCache,
} from '../lib/documentLookup'
import { splitMessageIntoParts } from '../lib/documentReferences'

// Storage key for panel ratio persistence
const PANEL_RATIO_STORAGE_KEY = 'saved-thread-panel-fr'
const DEFAULT_CHAT_PANEL_FR = 1.5

// API URL for SSE streaming
const API_URL = import.meta.env.VITE_API_URL || ''

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface DocumentInfo {
  id: string
  filename: string
  title: string
  mimeType: string
  outline: Array<{ id: string; title: string; level: number; position: number }>
  status: string
}

interface ConversationDetail {
  id: string
  projectId: string
  shareLinkSlug: string | null
  viewerEmail: string | null
  viewerName: string | null
  messageCount: number
  durationSeconds: number | null
  summary: string | null
  sentiment: string | null
  topics: string[]
  startedAt: string
  endedAt: string | null
  messages: Message[]
  project: {
    id: string
    name: string
  }
}

export function SavedThreadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Conversation state
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Chat state
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Document panel state
  const [panelMode, setPanelMode] = useState<'capsule' | 'document'>('capsule')
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [highlightSectionId, setHighlightSectionId] = useState<string | null>(null)
  const [highlightKey, setHighlightKey] = useState(0)
  const [documentsLoaded, setDocumentsLoaded] = useState(false)

  // Modal state
  const [showEndModal, setShowEndModal] = useState(false)

  // Panel size state (persisted to localStorage)
  const [chatPanelFr, setChatPanelFr] = useState(() => {
    const stored = localStorage.getItem(PANEL_RATIO_STORAGE_KEY)
    return stored ? parseFloat(stored) : DEFAULT_CHAT_PANEL_FR
  })

  // Load conversation on mount
  useEffect(() => {
    if (id) {
      loadConversation(id)
    }

    return () => {
      clearDocumentCache()
    }
  }, [id])

  // Initialize document lookup after conversation loads
  useEffect(() => {
    if (conversation?.shareLinkSlug && !documentsLoaded) {
      const slug = conversation.shareLinkSlug
      // Initialize lookup cache first, THEN load documents
      initDocumentLookup(slug)
        .then(async () => {
          // Now load documents for display
          try {
            const data = await api.getShareLinkDocuments(slug)
            setDocuments(data.documents)
          } catch (err) {
            console.error('Failed to load documents:', err)
          }
          setDocumentsLoaded(true)
        })
        .catch((err) => console.error('Failed to load documents for lookup:', err))
    }
  }, [conversation, documentsLoaded])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages, streamingContent])

  const loadConversation = async (conversationId: string) => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getConversationDetail(conversationId)
      setConversation(data.conversation)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversation'
      setError(message)
      console.error('Failed to load conversation:', err)
    } finally {
      setLoading(false)
    }
  }

  // Send message with SSE streaming
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversation || isSending) return

    const userMessage = content.trim()
    setIsSending(true)
    setStreamingContent('')

    // Optimistically add user message (use functional update to avoid stale closure)
    setConversation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `temp-user-${Date.now()}`,
            role: 'user',
            content: userMessage,
            createdAt: new Date().toISOString(),
          },
        ],
      }
    })

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(
        `${API_URL}/api/conversations/${conversation.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: userMessage }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (!reader) throw new Error('No response stream')

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
              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Add assistant message (use functional update)
      setConversation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          endedAt: null, // Clear ended state when continuing
          messages: [
            ...prev.messages,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: fullContent,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
      setStreamingContent('')
    }
  }

  // Handle citation click from chat messages
  const handleCitationClick = useCallback(
    (filenameOrId: string, sectionId?: string) => {
      const docInfo = lookupDocumentByFilename(filenameOrId)

      if (docInfo) {
        if (selectedDocumentId === docInfo.id && highlightSectionId === sectionId) {
          setHighlightKey((prev) => prev + 1)
        } else {
          setSelectedDocumentId(docInfo.id)
          setHighlightSectionId(sectionId || null)
        }
        setPanelMode('document')
      } else {
        // Fallback to direct ID match
        const directMatch = documents.find((d) => d.id === filenameOrId)
        if (directMatch) {
          setSelectedDocumentId(directMatch.id)
          setHighlightSectionId(sectionId || null)
          setHighlightKey((prev) => prev + 1)
          setPanelMode('document')
        }
      }
    },
    [selectedDocumentId, highlightSectionId, documents]
  )

  // Handle document click from capsule
  const handleDocumentClick = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId)
    setHighlightSectionId(null)
    setPanelMode('document')
  }, [])

  // Handle section click from capsule
  const handleSectionClick = useCallback((documentId: string, sectionId: string) => {
    setSelectedDocumentId(documentId)
    setHighlightSectionId(sectionId)
    setPanelMode('document')
  }, [])

  // Handle back to capsule
  const handleBackToCapsule = useCallback(() => {
    setPanelMode('capsule')
    setSelectedDocumentId(null)
    setHighlightSectionId(null)
  }, [])

  // Handle chat panel resize
  const handleChatPanelResize = useCallback((size: `${number}fr`) => {
    const frValue = parseFloat(size.replace('fr', ''))
    setChatPanelFr(frValue)
    localStorage.setItem(PANEL_RATIO_STORAGE_KEY, frValue.toString())
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading conversation...</div>
      </div>
    )
  }

  // Error state
  if (error && !conversation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Conversation not found</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Main split-view experience
  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      <Resplit.Root direction="horizontal" className="h-full">
        {/* Chat Panel */}
        <Resplit.Pane
          order={0}
          initialSize={`${chatPanelFr}fr`}
          minSize="400px"
          className="flex flex-col bg-white border-r min-h-0 overflow-hidden"
          onResize={handleChatPanelResize}
        >
          {/* Header */}
          <div className="border-b p-4 bg-white shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </button>
                <h1 className="text-xl font-bold">{conversation.project?.name}</h1>
                <div className="text-sm text-gray-600 mt-1">
                  {conversation.messages.length} messages
                  {conversation.endedAt && (
                    <span className="ml-2 text-gray-500">
                      (Ended - send a message to continue)
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowEndModal(true)}
                className="ml-4 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                End Conversation
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.messages.map((message) => {
              const isUser = message.role === 'user'
              const messageParts = !isUser
                ? splitMessageIntoParts(message.content)
                : [{ type: 'text' as const, content: message.content }]

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    isUser ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-3',
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <div>
                        {messageParts.map((part, idx) =>
                          part.type === 'reference' && part.reference ? (
                            <button
                              key={idx}
                              onClick={() =>
                                handleCitationClick(
                                  part.reference!.filename,
                                  part.reference!.sectionId
                                )
                              }
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline mx-1"
                              title={`Open ${part.reference.filename}`}
                            >
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                              </svg>
                              {part.content}
                            </button>
                          ) : (
                            <ProfileSectionContent
                              key={idx}
                              content={part.content}
                              className="inline"
                            />
                          )
                        )}
                      </div>
                    )}
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Streaming indicator */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                  <ProfileSectionContent content={streamingContent} />
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    AI is typing...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={isSending}
            placeholder="Continue the conversation..."
          />

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 border-t border-red-200 text-red-600 text-sm">
              {error}
              <button
                onClick={() => setError('')}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </Resplit.Pane>

        {/* Splitter */}
        <Resplit.Splitter
          order={1}
          size="4px"
          className="bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
        />

        {/* Document Panel */}
        <Resplit.Pane
          order={2}
          initialSize="1fr"
          minSize="300px"
          className="bg-white relative flex flex-col min-h-0 overflow-hidden"
        >
          {/* Back button header (only in document mode) */}
          {panelMode === 'document' && (
            <div className="border-b p-3 bg-white shrink-0">
              <button
                onClick={handleBackToCapsule}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to All Documents
              </button>
            </div>
          )}

          {/* Panel content based on mode */}
          <div className="flex-1 overflow-hidden min-h-0">
            {panelMode === 'capsule' ? (
              <DocumentCapsule
                documents={documents}
                projectName={conversation.project?.name || 'Documents'}
                onDocumentClick={handleDocumentClick}
                onSectionClick={handleSectionClick}
              />
            ) : selectedDocumentId && conversation.shareLinkSlug ? (
              <DocumentContentViewer
                documentId={selectedDocumentId}
                shareSlug={conversation.shareLinkSlug}
                highlightSectionId={highlightSectionId}
                highlightKey={highlightKey}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a document to view
              </div>
            )}
          </div>
        </Resplit.Pane>
      </Resplit.Root>

      {/* End Session Modal */}
      {showEndModal && (
        <EndSessionModal
          conversationId={conversation.id}
          messageCount={conversation.messages.length}
          startedAt={new Date(conversation.startedAt)}
          projectName={conversation.project?.name || 'this project'}
          onClose={() => setShowEndModal(false)}
          onEnded={() => {
            setShowEndModal(false)
            if (id) loadConversation(id) // Reload to get updated summary
          }}
        />
      )}

      {/* Conversation summary (if available and ended) */}
      {conversation.summary && conversation.endedAt && (
        <div className="fixed bottom-4 right-4 max-w-md bg-blue-50 rounded-lg p-4 border border-blue-200 shadow-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Conversation Summary
          </h3>
          <p className="text-sm text-blue-800">{conversation.summary}</p>
          {conversation.topics?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {conversation.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
