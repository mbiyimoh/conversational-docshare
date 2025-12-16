# Task Breakdown: Conversation Continuation Feature

**Generated:** 2025-12-07
**Source:** specs/feat-conversation-continuation.md
**Status:** Ready for Implementation

---

## Overview

Enable users to continue saved conversation threads with the AI agent. This transforms SavedThreadPage from a read-only transcript viewer into a full chat experience with split-view layout mirroring SharePage.

**Total Tasks:** 9
**Phases:** 3
**Parallel Opportunities:** Tasks within each phase can run in parallel

---

## Phase 1: Backend Core (Foundation)

### Task 1.1: Add generateHistorySummary() service function

**Description:** Create function to generate concise summaries of older conversation messages for context preservation
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2

**File:** `backend/src/services/chatService.ts`

**Implementation:**

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
```

**Acceptance Criteria:**
- [ ] Function returns empty string for empty messages array
- [ ] Function generates 2-3 sentence summary
- [ ] Summary captures key topics discussed
- [ ] Uses gpt-4o-mini for cost efficiency
- [ ] Summary length under 500 characters

---

### Task 1.2: Add generateChatCompletionWithSummary() service function

**Description:** Extend chat service to support history summary prepended to context
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None (depends on 1.1)

**File:** `backend/src/services/chatService.ts`

**Implementation:**

```typescript
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

**Acceptance Criteria:**
- [ ] Includes history summary when provided
- [ ] Builds system prompt and document context
- [ ] Gets last 10 messages for history
- [ ] Saves user message before streaming
- [ ] Saves assistant message after streaming
- [ ] Increments messageCount correctly
- [ ] Supports both streaming and non-streaming modes

---

### Task 1.3: Add continueConversation() controller and route

**Description:** Create the main endpoint for conversation continuation with SSE streaming
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** None

**File:** `backend/src/controllers/conversation.controller.ts`

**Implementation:**

```typescript
import { generateHistorySummary, generateChatCompletionWithSummary } from '../services/chatService'

/**
 * Continue a saved conversation with a new message
 * POST /api/conversations/:id/messages
 *
 * Authorization: Only savedByUserId can continue (project owner can VIEW only)
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

**File:** `backend/src/routes/conversation.routes.ts`

**Add route:**
```typescript
import { continueConversation } from '../controllers/conversation.controller'

router.post('/:id/messages', authenticate, asyncHandler(continueConversation))
```

**Acceptance Criteria:**
- [ ] Returns 401 if not authenticated
- [ ] Returns 403 if user is not savedByUserId
- [ ] Returns 400 if message is empty
- [ ] Returns 400 if conversation ID is invalid
- [ ] Returns 404 if conversation not found
- [ ] Clears endedAt/summary/sentiment/topics when continuing ended conversation
- [ ] Generates history summary for conversations > 10 messages
- [ ] Sets correct SSE headers
- [ ] Streams chunks correctly
- [ ] Handles errors gracefully

---

## Phase 2: Frontend Core (UI Transformation)

### Task 2.1: Transform SavedThreadPage to split-view layout

**Description:** Replace simple card layout with Resplit panels matching SharePage
**Size:** Large
**Priority:** High
**Dependencies:** Phase 1 complete
**Can run parallel with:** None

**File:** `frontend/src/pages/SavedThreadPage.tsx`

**Key Changes:**
1. Add imports for Resplit, DocumentCapsule, DocumentContentViewer, ChatInput
2. Add state for panel mode, documents, selectedDocumentId, highlightSectionId
3. Add panel sizing state with localStorage persistence
4. Implement Resplit.Root with horizontal direction
5. Create Chat Panel (left) with header, messages, streaming indicator, ChatInput
6. Create Document Panel (right) with capsule/viewer toggle
7. Add draggable splitter between panels

**New State Variables:**
```typescript
// Document panel state
const [panelMode, setPanelMode] = useState<'capsule' | 'document'>('capsule')
const [documents, setDocuments] = useState<DocumentInfo[]>([])
const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
const [highlightSectionId, setHighlightSectionId] = useState<string | null>(null)
const [highlightKey, setHighlightKey] = useState(0)
const [documentsLoaded, setDocumentsLoaded] = useState(false)

// Panel sizing
const [chatPanelFr, setChatPanelFr] = useState(() => {
  const stored = localStorage.getItem('saved-thread-panel-fr')
  return stored ? parseFloat(stored) : 1.5
})
```

**Layout Structure:**
```tsx
<Resplit.Root direction="horizontal" className="flex-1" onResizeEnd={handlePanelResize}>
  <Resplit.Pane order={0} initialSize={`${chatPanelFr}fr`} minSize="400px">
    {/* Chat Panel */}
  </Resplit.Pane>
  <Resplit.Splitter order={1} size="4px" />
  <Resplit.Pane order={2} initialSize="1fr" minSize="300px">
    {/* Document Panel */}
  </Resplit.Pane>
</Resplit.Root>
```

**Acceptance Criteria:**
- [ ] Page displays split-view layout
- [ ] Chat panel on left, document panel on right
- [ ] Panels are resizable via splitter
- [ ] Panel ratio persists to localStorage
- [ ] Document panel shows capsule view by default
- [ ] Minimum widths enforced (400px chat, 300px document)

---

### Task 2.2: Implement SSE streaming for new messages

**Description:** Add message sending with real-time streaming response
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3, Task 2.1
**Can run parallel with:** Task 2.3

**File:** `frontend/src/pages/SavedThreadPage.tsx`

**New State Variables:**
```typescript
const [isSending, setIsSending] = useState(false)
const [streamingContent, setStreamingContent] = useState('')
const messagesEndRef = useRef<HTMLDivElement>(null)
```

**Implementation:**
```typescript
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
        endedAt: null,
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
```

**Acceptance Criteria:**
- [ ] User message appears immediately (optimistic update)
- [ ] Uses functional setState to avoid stale closure bugs
- [ ] Typing indicator shows during streaming
- [ ] Chunks accumulate and display in real-time
- [ ] Complete response added to messages list
- [ ] Error handling shows error message
- [ ] Auto-scroll to new messages

---

### Task 2.3: Implement citation click handling

**Description:** Enable clicking document citations to open document panel
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.2

**File:** `frontend/src/pages/SavedThreadPage.tsx`

**Implementation:**
```typescript
import { splitMessageIntoParts } from '../lib/documentReferences'
import {
  initDocumentLookup,
  lookupDocumentByFilename,
  clearDocumentCache,
} from '../lib/documentLookup'

// In useEffect after conversation loads:
useEffect(() => {
  if (conversation?.shareLinkId && !documentsLoaded) {
    loadDocumentsForProject()
  }
}, [conversation, documentsLoaded])

const loadDocumentsForProject = async () => {
  if (!conversation?.projectId) return
  try {
    const data = await api.getProjectDocuments(conversation.projectId)
    setDocuments(data.documents)

    if (conversation.shareLinkId) {
      await initDocumentLookup(conversation.shareLinkId)
    }
    setDocumentsLoaded(true)
  } catch (err) {
    console.error('Failed to load documents:', err)
  }
}

const handleCitationClick = useCallback(
  async (filenameOrId: string, sectionId?: string) => {
    const doc = await lookupDocumentByFilename(filenameOrId)

    if (doc) {
      setSelectedDocumentId(doc.id)
      setHighlightSectionId(sectionId || null)
      setHighlightKey((prev) => prev + 1)
      setPanelMode('document')
    } else {
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
```

**Message Rendering with Citations:**
```tsx
{conversation.messages.map((message) => {
  const isUser = message.role === 'user'
  const messageParts = !isUser
    ? splitMessageIntoParts(message.content)
    : [{ type: 'text' as const, content: message.content }]

  return (
    <div key={message.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] rounded-lg px-4 py-3', isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900')}>
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div>
            {messageParts.map((part, idx) =>
              part.type === 'reference' && part.reference ? (
                <button
                  key={idx}
                  onClick={() => handleCitationClick(part.reference!.filename, part.reference!.sectionId)}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                  title={`Open ${part.reference.filename}`}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                  {part.content}
                </button>
              ) : (
                <ProfileSectionContent key={idx} content={part.content} className="inline" />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
})}
```

**Acceptance Criteria:**
- [ ] Documents load after conversation loads
- [ ] Document lookup cache initialized
- [ ] Citations render as clickable buttons
- [ ] Clicking citation opens document panel
- [ ] Panel scrolls to and highlights section
- [ ] Fallback to direct ID match if filename lookup fails

---

## Phase 3: Polish & Integration

### Task 3.1: Add End Conversation button and modal

**Description:** Enable users to re-end conversations with summary regeneration
**Size:** Small
**Priority:** Medium
**Dependencies:** Phase 2 complete
**Can run parallel with:** Task 3.2

**File:** `frontend/src/pages/SavedThreadPage.tsx`

**Add State:**
```typescript
const [showEndModal, setShowEndModal] = useState(false)
```

**Header Button:**
```tsx
<button
  onClick={() => setShowEndModal(true)}
  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
>
  End Conversation
</button>
```

**Modal Integration:**
```tsx
{showEndModal && (
  <EndSessionModal
    conversationId={conversation.id}
    messageCount={conversation.messages.length}
    startedAt={conversation.startedAt}
    projectName={conversation.project?.name || 'this project'}
    onClose={() => setShowEndModal(false)}
    onEnded={() => {
      setShowEndModal(false)
      if (id) loadConversation(id) // Reload to get updated summary
    }}
    isAlreadySaved={true}
  />
)}
```

**Acceptance Criteria:**
- [ ] End Conversation button visible in header
- [ ] Clicking opens EndSessionModal
- [ ] Modal shows simplified view (user already has account)
- [ ] Ending triggers summary regeneration
- [ ] Page reloads to show updated status

---

### Task 3.2: Add getProjectDocuments API method

**Description:** Add API client method to fetch documents for a project
**Size:** Small
**Priority:** Medium
**Dependencies:** None
**Can run parallel with:** Task 3.1

**File:** `frontend/src/lib/api.ts`

**Implementation:**
```typescript
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
```

**Acceptance Criteria:**
- [ ] Method returns documents array
- [ ] Includes filename, title, mimeType, outline
- [ ] Handles auth via existing request wrapper

---

### Task 3.3: Add unit and integration tests

**Description:** Create comprehensive tests for continuation functionality
**Size:** Medium
**Priority:** High
**Dependencies:** Phase 2 complete
**Can run parallel with:** Task 3.1, 3.2

**Backend Tests:** `backend/src/controllers/__tests__/conversation.continuation.test.ts`

```typescript
describe('continueConversation', () => {
  it('rejects project owner from continuing saved conversation', async () => {
    const conv = await createConversation({ savedByUserId: userA.id })
    const response = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${projectOwnerToken}`)
      .send({ message: 'Test message' })

    expect(response.status).toBe(403)
    expect(response.body.error).toContain('Only the user who saved')
  })

  it('allows savedByUser to continue and streams response', async () => {
    const conv = await createConversation({ savedByUserId: userA.id })
    const response = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'Continue our discussion' })

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
  })

  it('clears endedAt and summary when continuing ended conversation', async () => {
    const conv = await createConversation({
      savedByUserId: userA.id,
      endedAt: new Date(),
      summary: 'Previous summary',
    })

    await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'Continuing...' })

    const updated = await prisma.conversation.findUnique({ where: { id: conv.id } })
    expect(updated.endedAt).toBeNull()
    expect(updated.summary).toBeNull()
  })

  it('persists both user and assistant messages', async () => {
    const conv = await createConversation({ savedByUserId: userA.id })
    const initialCount = await prisma.message.count({ where: { conversationId: conv.id } })

    await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'New message' })

    const newCount = await prisma.message.count({ where: { conversationId: conv.id } })
    expect(newCount).toBe(initialCount + 2)
  })
})
```

**Acceptance Criteria:**
- [ ] Authorization tests pass (savedByUser only)
- [ ] Re-activation tests pass (clears ended state)
- [ ] Message persistence tests pass
- [ ] SSE streaming tests pass

---

## Execution Strategy

### Dependency Graph

```
Phase 1 (Backend):
  Task 1.1 ──┐
             ├──> Task 1.2 ──> Task 1.3
             │
Phase 2 (Frontend):
  Task 1.3 ──> Task 2.1 ──┬──> Task 2.2
                          └──> Task 2.3

Phase 3 (Polish):
  Task 2.1+ ──> Task 3.1
               Task 3.2 (parallel)
               Task 3.3 (parallel)
```

### Recommended Execution Order

1. **Task 1.1** - generateHistorySummary (no dependencies)
2. **Task 1.2** - generateChatCompletionWithSummary (needs 1.1)
3. **Task 1.3** - continueConversation endpoint (needs 1.2)
4. **Task 3.2** - getProjectDocuments API (no dependencies, can run early)
5. **Task 2.1** - Split-view layout (needs backend)
6. **Task 2.2 + 2.3** - SSE streaming + Citations (parallel, need 2.1)
7. **Task 3.1** - End Conversation button (needs 2.1)
8. **Task 3.3** - Tests (needs all features)

### Critical Path

Task 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 3.3

---

## Summary Report

| Phase | Tasks | Can Parallelize |
|-------|-------|-----------------|
| Phase 1: Backend | 3 | 1.1 alone, then 1.2→1.3 |
| Phase 2: Frontend | 3 | 2.2 + 2.3 in parallel |
| Phase 3: Polish | 3 | 3.1 + 3.2 + 3.3 in parallel |

**Total Tasks:** 9
**Critical Path Length:** 6 tasks
**Maximum Parallelism:** 3 tasks (Phase 3)
