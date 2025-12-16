# Conversation Continuation Feature

## Status: Draft
## Authors: Claude Code
## Date: 2025-12-07
## Related:
- Ideation: `docs/ideation/conversation-continuation-feature.md`
- Parent Spec: `specs/feat-analytics-viewer-experience-unified-dashboard.md` (Section 6.3.6)

---

## 1. Overview

Enable users to continue saved conversation threads with the AI agent, picking up where they left off with full context preservation. Currently, saved conversations (accessed via `/threads/:id`) are read-only - users can view their history but cannot resume the dialogue.

This feature transforms the SavedThreadPage from a read-only transcript viewer into a full chat experience that mirrors the original SharePage viewer experience.

---

## 2. Background/Problem Statement

### Current State

When viewers save conversations via the EndSessionModal flow:
1. Conversation is linked to their account (`savedByUserId`)
2. Conversation appears in dashboard "Saved Conversations" section
3. Clicking takes them to `/threads/:id` which shows a read-only transcript
4. The "Continue the conversation" input shows "placeholder - not yet implemented"

### Problems This Solves

1. **Dead-End UX**: Users who saved conversations hit a wall - they can read but not continue
2. **Context Loss**: Users cannot pick up where they left off; must start new conversations
3. **Value Gap**: Saved conversations have limited utility if they can't be extended
4. **Inconsistent Experience**: SavedThreadPage looks different from SharePage where conversation originated

### Business Value

- **Increased Engagement**: Users more likely to return if they can continue conversations
- **Higher Retention**: Saved conversations become living documents, not archives
- **Conversion Completion**: Viewers who created accounts to save conversations get full value

---

## 3. Goals

- [ ] Enable authenticated users to send new messages from SavedThreadPage
- [ ] Stream AI responses in real-time via SSE (matching SharePage behavior)
- [ ] Persist new messages to the database
- [ ] Include conversation history context for AI (last 10 messages + summary)
- [ ] Support RAG document retrieval for new messages
- [ ] Allow re-activation of ended conversations
- [ ] Enforce authorization: only `savedByUserId` can continue
- [ ] Transform SavedThreadPage to split-view layout matching SharePage
- [ ] Support document citation clicks opening document panel
- [ ] Enable re-ending conversation with summary regeneration

---

## 4. Non-Goals

- [ ] Real-time collaborative chat (multiple users in same thread)
- [ ] Conversation branching or forking
- [ ] Message editing or deletion
- [ ] Export of continued conversations
- [ ] Mobile-specific UI optimizations
- [ ] Project owner continuation (they can VIEW but not continue recipient chats)

---

## 5. Technical Dependencies

### External Libraries (Already Installed)

| Library | Version | Purpose |
|---------|---------|---------|
| `openai` | ^4.x | Chat completion streaming |
| `react-resplit` | ^3.x | Split-view panel layout |
| `prisma` | ^5.x | Database operations |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `backend/src/services/chatService.ts` | `generateChatCompletion()`, `buildDocumentContext()` |
| `backend/src/services/contextService.ts` | `buildSystemPrompt()` |
| `backend/src/services/conversationAnalysis.ts` | `generateConversationSummary()` |
| `frontend/src/lib/documentLookup.ts` | Citation resolution |
| `frontend/src/lib/documentReferences.ts` | Citation parsing |
| `frontend/src/components/ChatMessage.tsx` | Message rendering with citations |

### Database Schema (No Changes Required)

Existing models support all requirements:
- `Conversation` - has `savedByUserId`, `endedAt`, `summary`, `sentiment`, `topics`
- `Message` - has `conversationId`, `role`, `content`
- Indexes already exist for `savedByUserId` lookups

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTINUATION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SavedThreadPage (split-view)                                           │
│  ├── Chat Panel (left)                                                  │
│  │   ├── Header: Project name, End Conversation button                  │
│  │   ├── MessageList: Historical + new messages                         │
│  │   ├── StreamingIndicator: Shows AI typing                            │
│  │   └── ChatInput: Send new messages                                   │
│  │                                                                       │
│  ├── Splitter (draggable)                                               │
│  │                                                                       │
│  └── Document Panel (right)                                             │
│      ├── DocumentCapsule: Document list overview                        │
│      └── DocumentContentViewer: Full document + highlighting            │
│                                                                          │
│  User sends message:                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Frontend                                                         │    │
│  │ 1. Optimistically add user message to state                     │    │
│  │ 2. POST /api/conversations/:id/messages                         │    │
│  │ 3. Read SSE stream chunks                                       │    │
│  │ 4. Update streamingContent on each chunk                        │    │
│  │ 5. Add assistant message when stream completes                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Backend: continueConversation()                                 │    │
│  │ 1. Verify auth: req.user.userId === conversation.savedByUserId  │    │
│  │ 2. If conversation.endedAt: clear endedAt, summary, sentiment   │    │
│  │ 3. Load last 10 messages                                        │    │
│  │ 4. If messages > 10: generate summary of older messages         │    │
│  │ 5. Build system prompt + document context                       │    │
│  │ 6. Call OpenAI streaming                                        │    │
│  │ 7. Save user message                                            │    │
│  │ 8. Stream chunks via SSE                                        │    │
│  │ 9. Save assistant message when complete                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Backend Implementation

#### 6.2.1 New Endpoint: Continue Conversation

**File: `backend/src/controllers/conversation.controller.ts`**

```typescript
/**
 * Continue a saved conversation with a new message
 * POST /api/conversations/:id/messages
 *
 * Authorization: Only savedByUserId can continue (project owner can VIEW only)
 *
 * Behavior:
 * - Re-activates ended conversations (clears endedAt, summary, sentiment, topics)
 * - Includes last 10 messages + summary of older messages in context
 * - Streams response via SSE
 * - Persists both user and assistant messages
 */
export async function continueConversation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { message } = req.body

  // Validate message
  if (!message?.trim()) {
    throw new ValidationError('Message is required')
  }

  // Validate ID format
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(id)) {
    throw new ValidationError('Invalid conversation ID format')
  }

  // Load conversation with project info
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, ownerId: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Authorization: ONLY savedByUserId can continue
  // (Project owner can view via getConversationDetail but NOT continue)
  if (conversation.savedByUserId !== req.user.userId) {
    throw new AuthorizationError('Only the user who saved this conversation can continue it')
  }

  // Re-activate if ended (clear summary data - will regenerate on re-end)
  if (conversation.endedAt) {
    await prisma.conversation.update({
      where: { id },
      data: {
        endedAt: null,
        summary: null,
        sentiment: null,
        topics: [],
      },
    })
  }

  // Generate summary of older messages if conversation is long
  let historySummary: string | null = null
  if (conversation.messages.length > 10) {
    const olderMessages = conversation.messages.slice(0, -10)
    historySummary = await generateHistorySummary(olderMessages)
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    // Use extended chat completion with history summary
    const stream = await generateChatCompletionWithSummary(
      conversation.project.id,
      id,
      message,
      historySummary,
      { stream: true }
    )

    // Stream chunks to client
    for await (const chunk of stream as AsyncIterable<string>) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (error) {
    console.error('Continuation streaming error:', error)
    res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
  } finally {
    res.end()
  }
}
```

#### 6.2.2 Route Registration

**File: `backend/src/routes/conversation.routes.ts`**

```typescript
import { continueConversation } from '../controllers/conversation.controller'

// Add to existing routes:

/**
 * @route POST /api/conversations/:id/messages
 * @desc Continue a saved conversation with a new message (SSE streaming)
 * @access Private (savedByUserId only)
 */
router.post('/:id/messages', authenticate, asyncHandler(continueConversation))
```

#### 6.2.3 Extended Chat Service for History Summary

**File: `backend/src/services/chatService.ts`**

```typescript
/**
 * Generate a concise summary of older conversation messages
 * Used when conversation exceeds 10 messages to provide context
 * without exceeding token limits
 */
export async function generateHistorySummary(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (messages.length === 0) return ''

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini', // Cost-effective for summaries
    messages: [
      {
        role: 'system',
        content: `Summarize this conversation history in 2-3 sentences.
Focus on: main topics discussed, key questions asked, and any conclusions reached.
Keep it concise - this will be prepended to ongoing conversation context.`,
      },
      {
        role: 'user',
        content: transcript,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  })

  return response.choices[0].message.content || ''
}

/**
 * Generate chat completion with optional history summary prepended
 * Extends the standard generateChatCompletion with summary support
 */
export async function generateChatCompletionWithSummary(
  projectId: string,
  conversationId: string,
  userMessage: string,
  historySummary: string | null,
  options: ChatCompletionOptions = {}
): Promise<AsyncIterable<string> | string> {
  // Get agent config
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  const model = options.model || agentConfig?.preferredModel || 'gpt-4-turbo'
  const temperature = options.temperature ?? agentConfig?.temperature ?? 0.7
  const maxTokens = options.maxTokens || 2000

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(projectId)

  // Build document context from RAG
  const documentContext = await buildDocumentContext(projectId, userMessage)

  // Get recent conversation history (last 10 messages)
  const history = await getConversationHistory(conversationId, 10)

  // Compose messages with optional summary
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(documentContext ? [{ role: 'system' as const, content: documentContext }] : []),
    ...(historySummary
      ? [
          {
            role: 'system' as const,
            content: `## PREVIOUS CONVERSATION SUMMARY\n\nThe following summarizes earlier discussion in this conversation:\n\n${historySummary}`,
          },
        ]
      : []),
    ...history,
    { role: 'user', content: userMessage },
  ]

  // Save user message and increment messageCount
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessage,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 1 } },
    }),
  ])

  // Generate completion (streaming or non-streaming)
  if (options.stream) {
    return streamChatCompletion(messages, conversationId, {
      model,
      temperature,
      maxTokens,
    })
  } else {
    // Non-streaming path (not used for continuation but kept for completeness)
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
    })

    const assistantMessage = response.choices[0].message.content || ''

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: assistantMessage,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { messageCount: { increment: 1 } },
      }),
    ])

    return assistantMessage
  }
}
```

### 6.3 Frontend Implementation

#### 6.3.1 SavedThreadPage Transformation

**File: `frontend/src/pages/SavedThreadPage.tsx`**

The page needs significant transformation from a simple transcript viewer to a full chat experience matching SharePage.

**Key Changes:**
1. Replace simple card layout with Resplit panels
2. Add document panel with capsule and viewer modes
3. Implement SSE streaming for new messages
4. Add citation click handling
5. Add End Conversation button

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Resplit } from 'react-resplit'
import { api } from '../lib/api'
import { ProfileSectionContent } from '../components/ProfileSectionContent'
import { ChatInput } from '../components/ChatInput'
import { DocumentCapsule } from '../components/DocumentCapsule'
import { DocumentContentViewer } from '../components/DocumentContentViewer'
import { EndSessionModal } from '../components/EndSessionModal'
import {
  initDocumentLookup,
  lookupDocumentByFilename,
  clearDocumentCache,
} from '../lib/documentLookup'
import { splitMessageIntoParts } from '../lib/documentReferences'
import { cn } from '../lib/utils'

const API_URL = import.meta.env.VITE_API_URL || ''
const PANEL_RATIO_STORAGE_KEY = 'saved-thread-panel-fr'
const DEFAULT_CHAT_PANEL_FR = 1.5

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface ConversationDetail {
  id: string
  projectId: string
  shareLinkId: string | null
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

interface DocumentInfo {
  id: string
  filename: string
  title: string
  mimeType: string
  outline: Array<{ id: string; title: string; level: number; position: number }>
  status: string
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

  // Panel sizing
  const [chatPanelFr, setChatPanelFr] = useState(() => {
    const stored = localStorage.getItem(PANEL_RATIO_STORAGE_KEY)
    return stored ? parseFloat(stored) : DEFAULT_CHAT_PANEL_FR
  })

  // End session modal
  const [showEndModal, setShowEndModal] = useState(false)

  useEffect(() => {
    if (id) {
      loadConversation(id)
    }
    return () => clearDocumentCache()
  }, [id])

  // Initialize document lookup after conversation loads
  useEffect(() => {
    if (conversation?.shareLinkId && !documentsLoaded) {
      loadDocumentsForProject()
    }
  }, [conversation, documentsLoaded])

  // Auto-scroll on new messages
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
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  const loadDocumentsForProject = async () => {
    if (!conversation?.projectId) return
    try {
      // Load documents for the project
      const data = await api.getProjectDocuments(conversation.projectId)
      setDocuments(data.documents)

      // Initialize lookup cache
      if (conversation.shareLinkId) {
        await initDocumentLookup(conversation.shareLinkId)
      }
      setDocumentsLoaded(true)
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }

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
        throw new Error('Failed to send message')
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
            } catch (e) {
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
          endedAt: null, // Mark as active since we just continued
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

  const handleCitationClick = useCallback(
    async (filenameOrId: string, sectionId?: string) => {
      // Try to resolve document
      const doc = await lookupDocumentByFilename(filenameOrId)

      if (doc) {
        setSelectedDocumentId(doc.id)
        setHighlightSectionId(sectionId || null)
        setHighlightKey((prev) => prev + 1)
        setPanelMode('document')
      } else {
        // Fallback: try direct ID match
        const directMatch = documents.find((d) => d.id === filenameOrId)
        if (directMatch) {
          setSelectedDocumentId(directMatch.id)
          setHighlightSectionId(sectionId || null)
          setHighlightKey((prev) => prev + 1)
          setPanelMode('document')
        }
      }
    },
    [documents]
  )

  const handleDocumentSelect = (docId: string) => {
    setSelectedDocumentId(docId)
    setHighlightSectionId(null)
    setPanelMode('document')
  }

  const handlePanelResize = useCallback((sizes: number[]) => {
    if (sizes[0]) {
      const newFr = sizes[0] / (sizes[2] || 1)
      setChatPanelFr(newFr)
      localStorage.setItem(PANEL_RATIO_STORAGE_KEY, String(newFr))
    }
  }, [])

  const handleEndConversation = () => {
    setShowEndModal(true)
  }

  const handleConversationEnded = () => {
    setShowEndModal(false)
    // Reload to get updated summary
    if (id) loadConversation(id)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading conversation...</div>
      </div>
    )
  }

  // Error state
  if (error || !conversation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error || 'Conversation not found'}</div>
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

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Split-view layout */}
      <Resplit.Root
        direction="horizontal"
        className="flex-1"
        onResizeEnd={handlePanelResize}
      >
        {/* Chat Panel */}
        <Resplit.Pane
          order={0}
          initialSize={`${chatPanelFr}fr`}
          minSize="400px"
          className="flex flex-col bg-white"
        >
          {/* Header */}
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </button>
              <h1 className="text-lg font-semibold">{conversation.project?.name ?? 'Conversation'}</h1>
              <div className="text-xs text-gray-500">
                {conversation.messages.length} messages
                {conversation.endedAt && <span className="ml-2 text-orange-600">Ended</span>}
              </div>
            </div>
            <button
              onClick={handleEndConversation}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
            >
              End Conversation
            </button>
          </div>

          {/* Messages */}
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
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                              title={`Open ${part.reference.filename}`}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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
                  </div>
                </div>
              )
            })}

            {/* Streaming indicator */}
            {isSending && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-3">
                  <ProfileSectionContent content={streamingContent} />
                </div>
              </div>
            )}

            {isSending && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-4 py-2">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
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
        </Resplit.Pane>

        {/* Splitter */}
        <Resplit.Splitter order={1} size="4px" className="bg-gray-200 hover:bg-blue-400 transition-colors" />

        {/* Document Panel */}
        <Resplit.Pane
          order={2}
          initialSize="1fr"
          minSize="300px"
          className="bg-gray-50"
        >
          {panelMode === 'capsule' ? (
            <DocumentCapsule
              documents={documents}
              onDocumentSelect={handleDocumentSelect}
            />
          ) : (
            <DocumentContentViewer
              documentId={selectedDocumentId}
              highlightSectionId={highlightSectionId}
              highlightKey={highlightKey}
              onBack={() => setPanelMode('capsule')}
              projectId={conversation.projectId}
            />
          )}
        </Resplit.Pane>
      </Resplit.Root>

      {/* End Session Modal */}
      {showEndModal && (
        <EndSessionModal
          conversationId={conversation.id}
          messageCount={conversation.messages.length}
          startedAt={conversation.startedAt}
          projectName={conversation.project?.name || 'this project'}
          onClose={() => setShowEndModal(false)}
          onEnded={handleConversationEnded}
          isAlreadySaved={true} // User already has account
        />
      )}
    </div>
  )
}
```

#### 6.3.2 API Client Extension

**File: `frontend/src/lib/api.ts`**

```typescript
// Add to ApiClient class:

/**
 * Get documents for a project (used by SavedThreadPage)
 */
async getProjectDocuments(projectId: string) {
  return this.request<{
    documents: Array<{
      id: string
      filename: string
      title: string
      mimeType: string
      outline: Array<{ id: string; title: string; level: number; position: number }>
      status: string
    }>
  }>(`/api/projects/${projectId}/documents`)
}

// Note: The actual message sending uses fetch() directly for SSE streaming
// This is handled inline in SavedThreadPage.tsx
```

---

## 7. User Experience

### 7.1 Entry Flow

```
Dashboard → Saved Conversations → Click Thread Card
                                         ↓
                              SavedThreadPage (split-view)
                                         ↓
                         Chat Panel      │    Document Panel
                         (60% width)     │    (40% width)
                              │          │          │
                      ┌───────┴───────┐  │  ┌───────┴───────┐
                      │               │  │  │               │
                      │  Message      │  │  │  Document     │
                      │  History      │  │  │  Capsule      │
                      │               │  │  │  (overview)   │
                      │  ┌──────────┐ │  │  │               │
                      │  │ New msg  │ │  │  │  OR           │
                      │  │ input    │ │  │  │               │
                      │  └──────────┘ │  │  │  Document     │
                      │               │  │  │  Viewer       │
                      └───────────────┘  │  │  (detail)     │
                                         │  └───────────────┘
```

### 7.2 Continuation Flow

1. User types message in ChatInput
2. User message appears immediately (optimistic update)
3. Typing indicator shows
4. AI response streams in real-time
5. Complete response appears in message list
6. If ended conversation: `endedAt` cleared, status changes to "Active"

### 7.3 Citation Interaction

1. AI response contains `[DOC:filename:section-id]` reference
2. Reference renders as clickable link with document icon
3. User clicks reference
4. Document panel switches to DocumentContentViewer
5. Panel scrolls to section and highlights it
6. User can click "Back" to return to document list

### 7.4 End Conversation Flow

1. User clicks "End Conversation" button
2. EndSessionModal appears (simplified - user already has account)
3. User confirms ending
4. Conversation marked as ended
5. AI summary generated (if 5+ messages)
6. User remains on page with updated status

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Backend: `backend/src/controllers/__tests__/conversation.continuation.test.ts`**

```typescript
/**
 * Purpose: Verify conversation continuation endpoint handles
 * authorization, re-activation, and streaming correctly
 */
describe('continueConversation', () => {
  /**
   * Validates that only savedByUserId can continue a conversation
   * Project owners should be rejected (they can view but not continue)
   */
  it('rejects project owner from continuing saved conversation', async () => {
    // Create conversation saved by user A
    const conv = await createConversation({ savedByUserId: userA.id })

    // Project owner (user B) attempts to continue
    const response = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${projectOwnerToken}`)
      .send({ message: 'Test message' })

    expect(response.status).toBe(403)
    expect(response.body.error).toContain('Only the user who saved')
  })

  /**
   * Validates that the savedByUser can successfully continue
   * and that the response streams correctly
   */
  it('allows savedByUser to continue and streams response', async () => {
    const conv = await createConversation({ savedByUserId: userA.id })

    const response = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'Continue our discussion' })

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
  })

  /**
   * Validates that ended conversations are re-activated
   * Summary, sentiment, and topics should be cleared
   */
  it('clears endedAt and summary when continuing ended conversation', async () => {
    const conv = await createConversation({
      savedByUserId: userA.id,
      endedAt: new Date(),
      summary: 'Previous summary',
      sentiment: 'positive',
      topics: ['topic1', 'topic2'],
    })

    await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'Continuing...' })

    const updated = await prisma.conversation.findUnique({ where: { id: conv.id } })
    expect(updated.endedAt).toBeNull()
    expect(updated.summary).toBeNull()
    expect(updated.sentiment).toBeNull()
    expect(updated.topics).toEqual([])
  })

  /**
   * Validates that messages are persisted correctly
   * Both user and assistant messages should be saved
   */
  it('persists both user and assistant messages', async () => {
    const conv = await createConversation({ savedByUserId: userA.id })
    const initialCount = await prisma.message.count({ where: { conversationId: conv.id } })

    await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'New message' })

    const newCount = await prisma.message.count({ where: { conversationId: conv.id } })
    expect(newCount).toBe(initialCount + 2) // user + assistant
  })
})
```

**Backend: `backend/src/services/__tests__/chatService.summary.test.ts`**

```typescript
/**
 * Purpose: Verify history summary generation for long conversations
 */
describe('generateHistorySummary', () => {
  /**
   * Validates that summary captures key discussion points
   * Summary should be concise (under 200 tokens) but informative
   */
  it('generates concise summary of conversation history', async () => {
    const messages = [
      { role: 'user', content: 'What is your ROI projection?' },
      { role: 'assistant', content: 'Our ROI projection is 35% over 18 months...' },
      { role: 'user', content: 'What are the main risks?' },
      { role: 'assistant', content: 'The primary risks include market volatility...' },
    ]

    const summary = await generateHistorySummary(messages)

    expect(summary).toBeTruthy()
    expect(summary.length).toBeLessThan(500) // Concise
    expect(summary.toLowerCase()).toMatch(/roi|projection|risk/) // Captures key topics
  })

  /**
   * Validates empty array handling
   */
  it('returns empty string for empty messages array', async () => {
    const summary = await generateHistorySummary([])
    expect(summary).toBe('')
  })
})
```

### 8.2 Integration Tests

**File: `backend/src/controllers/__tests__/conversation.integration.test.ts`**

```typescript
/**
 * Purpose: Verify end-to-end flow from continuation to re-ending
 */
describe('Conversation Continuation Integration', () => {
  /**
   * Full flow: Continue → Multiple messages → Re-end → Verify summary
   */
  it('supports full continuation lifecycle', async () => {
    // 1. Create and end a conversation
    const conv = await createConversationWithMessages(6)
    await endConversation(conv.id)

    // 2. Save to user
    await saveConversation(conv.id, userAToken)

    // 3. Continue with new messages
    await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'Continuing discussion' })

    // 4. Verify conversation is active
    let updated = await getConversation(conv.id)
    expect(updated.endedAt).toBeNull()

    // 5. Re-end conversation
    await request(app)
      .post(`/api/conversations/${conv.id}/end`)

    // 6. Verify new summary generated
    updated = await getConversation(conv.id)
    expect(updated.endedAt).toBeTruthy()
    expect(updated.summary).toBeTruthy()
    expect(updated.messageCount).toBeGreaterThan(6)
  })
})
```

### 8.3 E2E Tests

**File: `e2e/conversation-continuation.spec.ts`**

```typescript
/**
 * Purpose: Verify complete user journey from dashboard to conversation continuation
 */
import { test, expect } from '@playwright/test'

test.describe('Conversation Continuation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as user with saved conversations
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'mbiyimoh@gmail.com')
    await page.fill('[data-testid="password"]', 'MGinfinity09!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  /**
   * Validates split-view layout and basic continuation
   */
  test('displays split-view and allows message sending', async ({ page }) => {
    // Navigate to saved thread
    await page.click('[data-testid="saved-threads-section"] button:first-child')

    // Verify split-view layout
    await expect(page.locator('.Resplit-Pane').first()).toBeVisible()
    await expect(page.locator('.Resplit-Pane').nth(1)).toBeVisible()

    // Send continuation message
    await page.fill('[data-testid="chat-input"]', 'Continuing our conversation')
    await page.click('[data-testid="send-button"]')

    // Verify user message appears
    await expect(page.locator('text=Continuing our conversation')).toBeVisible()

    // Wait for AI response (streaming)
    await expect(page.locator('.bg-gray-100').last()).toBeVisible({ timeout: 30000 })
  })

  /**
   * Validates citation clicking opens document panel
   */
  test('citation click opens document panel', async ({ page }) => {
    await page.goto('/threads/[known-thread-with-citations]')

    // Find and click a citation
    const citation = page.locator('button:has-text("[DOC:")').first()
    if (await citation.isVisible()) {
      await citation.click()

      // Verify document viewer opens
      await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible()
    }
  })

  /**
   * Validates end conversation flow regenerates summary
   */
  test('ending conversation regenerates summary', async ({ page }) => {
    await page.goto('/threads/[known-active-thread]')

    // Click end conversation
    await page.click('button:has-text("End Conversation")')

    // Confirm in modal
    await page.click('button:has-text("Just End")')

    // Verify ended status
    await expect(page.locator('text=Ended')).toBeVisible()
  })
})
```

---

## 9. Performance Considerations

### 9.1 History Summary Generation

**Issue:** Generating summaries for long conversations adds latency

**Mitigation:**
- Use `gpt-4o-mini` for summaries (faster, cheaper)
- Only generate summary when messages > 10
- Summary generation runs once per continuation session
- Summary cached implicitly in conversation context

**Expected Performance:**
- Summary generation: 1-2 seconds for 20+ messages
- Overall continuation latency: ~2-3 seconds first message, <1 second subsequent

### 9.2 Document Panel Loading

**Issue:** Loading documents for projects with many files

**Mitigation:**
- Documents loaded lazily after conversation loads
- Document lookup uses O(1) Map-based cache
- 5-minute cache TTL prevents redundant fetches

### 9.3 Panel Resizing

**Issue:** Frequent localStorage writes during drag

**Mitigation:**
- Use `onResizeEnd` instead of continuous updates
- Single localStorage write when drag completes

---

## 10. Security Considerations

### 10.1 Authorization

**Strict enforcement:**
- Only `savedByUserId` can POST messages (not project owner)
- Project owner retains VIEW access via `getConversationDetail`
- Auth check happens before any database mutations

**Why owner can't continue:**
- Prevents project owner from impersonating recipients
- Maintains conversation authenticity for audit purposes
- Recipient maintains ownership of their dialogue

### 10.2 Input Validation

- Message content validated for presence
- Conversation ID validated as CUID format
- JWT authentication required

### 10.3 Rate Limiting

Apply existing chat rate limits:
- Per-user message limit
- Per-conversation limit
- Token budget per conversation (from existing chatService)

---

## 11. Documentation

### 11.1 Updates Required

- [ ] Update `CLAUDE.md` with new endpoint documentation
- [ ] Add SavedThreadPage section to developer guide
- [ ] Document history summary feature in LLM integration guide

### 11.2 API Documentation

**New Endpoint:**

```
POST /api/conversations/:id/messages

Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "message": "string (required)"
}

Response: text/event-stream
- data: {"chunk": "..."}  (repeated for each token)
- data: {"done": true}    (completion signal)
- data: {"error": "..."}  (on failure)

Authorization: Only savedByUserId (403 for project owner or others)
```

---

## 12. Implementation Phases

### Phase 1: Core Continuation (MVP)

**Backend:**
1. Add `continueConversation()` controller function
2. Add `POST /:id/messages` route
3. Add `generateHistorySummary()` service function
4. Add `generateChatCompletionWithSummary()` variant

**Frontend:**
1. Transform SavedThreadPage to split-view layout
2. Implement SSE streaming for new messages
3. Add ChatInput component integration
4. Add streaming content display

### Phase 2: Document Integration

**Frontend:**
1. Integrate DocumentCapsule component
2. Integrate DocumentContentViewer component
3. Implement citation click handling
4. Add document lookup initialization

### Phase 3: Polish

**Frontend:**
1. Add End Conversation button and modal integration
2. Panel ratio persistence
3. Loading states and error handling
4. Responsive behavior for panel resizing

---

## 13. Open Questions

1. **Message limit per session?** Currently no limit - monitor usage and add if needed
2. **Notification when project owner views?** Deferred - not in scope
3. **Conversation archival?** Old conversations may grow large - consider archival strategy later

---

## 14. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Continuation adoption | >30% of saved conversations get continued | continued_count / saved_count |
| Messages per continuation | >3 new messages avg | new_messages_avg after continuation |
| Summary quality | No user complaints | Support ticket monitoring |
| Page load time | <2 seconds | P95 time to interactive |
| Streaming latency | First token <3 seconds | Time from send to first chunk |

---

## 15. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Token limit exceeded | High | Medium | History summary reduces context size |
| Summary quality inconsistent | Medium | Low | Use structured prompt, test with diverse conversations |
| Document panel complexity | Medium | Medium | Reuse SharePage components directly |
| SSE connection drops | Low | Low | Frontend retries, clear error states |
| Performance on long conversations | Medium | Low | Summary generation offloads context |

---

## 16. References

- [Ideation Document](../docs/ideation/conversation-continuation-feature.md)
- [Parent Spec: Analytics + Viewer Experience](./feat-analytics-viewer-experience-unified-dashboard.md)
- [TestSession Controller (SSE reference)](../backend/src/controllers/testSession.controller.ts)
- [SharePage (Layout reference)](../frontend/src/pages/SharePage.tsx)
- [DojoChat (Streaming reference)](../frontend/src/components/TestingDojo/DojoChat.tsx)
- [ChatService](../backend/src/services/chatService.ts)
