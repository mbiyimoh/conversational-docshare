# Conversation Continuation Feature

**Slug:** conversation-continuation-feature
**Author:** Claude Code
**Date:** 2025-12-06
**Branch:** preflight/conversation-continuation-feature
**Related:**
- `specs/feat-analytics-viewer-experience-unified-dashboard.md` (Section 6.3.6 - deferred continuation)
- `frontend/src/pages/SavedThreadPage.tsx` (current placeholder)
- `backend/src/services/chatService.ts` (existing chat infrastructure)

---

## 1) Intent & Assumptions

**Task brief:** Enable users to continue saved conversation threads with the AI agent, picking up from where they left off with full context preservation. Currently, saved conversations are read-only - users can view their history but cannot resume the dialogue.

**Assumptions:**
- Only authenticated users can continue conversations (must be `savedByUserId`)
- Project owner can also continue conversations on their projects
- Continuation uses the same AI profile/context as original conversation
- All existing messages are loaded as context for the LLM
- Documents are still accessible via RAG for new messages
- Ended conversations (`endedAt` is set) should be re-activatable when continued

**Out of scope:**
- Real-time collaborative chat (multiple users in same thread)
- Conversation branching/forking
- Message editing or deletion
- Export of continued conversations
- Mobile-specific optimizations

---

## 2) Pre-reading Log

- `backend/src/services/chatService.ts`: Core chat infrastructure with `generateChatCompletion()`, `getConversationHistory()`, `buildDocumentContext()` - all reusable
- `backend/src/controllers/conversation.controller.ts`: Existing endpoints for get/save/end - need to add `/messages` endpoint
- `backend/src/controllers/testSession.controller.ts:259-368`: Reference SSE streaming pattern with `sendTestMessage()`
- `frontend/src/components/TestingDojo/DojoChat.tsx`: Reference frontend SSE handling with `fetch()` + `getReader()`
- `frontend/src/pages/SavedThreadPage.tsx`: Current read-only UI with placeholder `handleSendMessage()` function
- `backend/prisma/schema.prisma:311-330`: Conversation model already has all needed fields
- `specs/feat-analytics-viewer-experience-unified-dashboard.md`: Explicitly deferred continuation to future work

---

## 3) Codebase Map

**Primary components/modules:**
| File | Role |
|------|------|
| `backend/src/services/chatService.ts` | Chat completion, RAG, message storage |
| `backend/src/controllers/conversation.controller.ts` | Conversation CRUD endpoints |
| `backend/src/routes/conversation.routes.ts` | Route definitions |
| `frontend/src/pages/SavedThreadPage.tsx` | Saved thread viewing UI |
| `frontend/src/lib/api.ts` | API client |

**Shared dependencies:**
- `buildSystemPrompt()` from `contextService.ts` - agent personality
- `buildDocumentContext()` from `chatService.ts` - RAG retrieval
- `getOpenAI()` from `utils/openai.ts` - LLM client
- `ProfileSectionContent` component - AI response rendering
- `ChatInput` component - message input UI

**Data flow:**
```
User Input → POST /api/conversations/:id/messages
           → Load history + build context
           → Stream from OpenAI
           → Store messages in DB
           → SSE chunks → Frontend render
```

**Feature flags/config:** None required - standard feature enablement

**Potential blast radius:**
- `SavedThreadPage.tsx` - Primary UI changes
- `conversation.routes.ts` - New endpoint
- `conversation.controller.ts` - New function
- `api.ts` - New API method
- No schema changes needed (existing Message model works)

---

## 4) Root Cause Analysis

*N/A - This is a new feature, not a bug fix.*

---

## 5) Research

### Potential Solutions

**Approach 1: Extend chatService.generateChatCompletion()**

Reuse existing `generateChatCompletion()` function which already handles:
- System prompt composition
- RAG document context
- Conversation history loading
- Message persistence
- Both streaming and non-streaming modes

**Pros:**
- Maximum code reuse
- Proven, tested infrastructure
- Consistent behavior with SharePage chat
- Already handles edge cases (token limits, error handling)

**Cons:**
- Function currently expects new conversation context
- May need minor refactoring for resumed context

---

**Approach 2: Clone TestSession pattern**

Create new endpoint copying the SSE streaming pattern from `testSession.controller.ts:sendTestMessage()`.

**Pros:**
- Well-tested SSE streaming implementation
- Clear separation from original chat flow
- More control over continuation-specific logic

**Cons:**
- Code duplication
- Two places to maintain chat logic
- Different authorization model

---

**Approach 3: Shared streaming utility + new endpoint**

Extract SSE streaming into a shared utility used by both TestSession and Conversation continuation.

**Pros:**
- DRY principle
- Single source of truth for streaming
- Easier to maintain

**Cons:**
- Larger refactoring scope
- Risk of breaking existing functionality
- More initial work

---

### Recommendation

**Approach 1: Extend chatService.generateChatCompletion()**

This is the cleanest path because:
1. The function already does exactly what we need
2. It's already integrated with RAG, system prompts, and message storage
3. The only missing piece is a new route handler that uses it

Implementation:
1. Add `POST /api/conversations/:id/messages` endpoint
2. Verify authorization (savedByUserId OR project owner)
3. Clear `endedAt` if conversation was ended
4. Call `generateChatCompletion(projectId, conversationId, message, { stream: true })`
5. Frontend mirrors DojoChat pattern for SSE handling

**Estimated effort:** 4-6 hours

---

## 6) Clarification

1. **Who can continue conversations?**
   - Option A: Only the user who saved it (`savedByUserId`)
   - Option B: savedByUserId OR project owner
   - **Recommendation:** Option B - gives project owners visibility/control
   >> option A (project owner should be able to view but not continue one of their audience / recipient's chats)

2. **Should ended conversations be continuable?**
   - Option A: Yes, clear `endedAt` when new message sent
   - Option B: No, ended means permanently closed
   - **Recommendation:** Option A - better UX, users often want to resume
   >> option A, yes

3. **Context window limit handling?**
   - Option A: Include all historical messages (may exceed token limit)
   - Option B: Include last N messages (currently 10)
   - Option C: Summarize older messages
   - **Recommendation:** Option B (matches existing behavior) - can enhance later
   >> option B + C — last N messages + a summary of what has been discussed so far / previously

4. **Should continuation regenerate AI summary?**
   - Option A: No, keep original summary
   - Option B: Yes, regenerate on conversation re-end
   - **Recommendation:** Option B - summary should reflect full conversation
   >> option B

5. **Document panel in SavedThreadPage?**
   - Option A: Chat only (simpler, current state)
   - Option B: Full split view with document panel like SharePage
   - **Recommendation:** Start with Option A, add document panel as enhancement
   >> option B. if I'm continuing my previous conversation, it should look and feel exactly the same as when I first started that conversation (once I'm back in it)

---

## Implementation Preview

### Backend Changes

```typescript
// backend/src/controllers/conversation.controller.ts

/**
 * Continue a saved conversation with a new message
 * POST /api/conversations/:id/messages
 *
 * Authorization: savedByUser OR project owner
 */
export async function continueConversation(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { id } = req.params
  const { message } = req.body

  if (!message?.trim()) {
    throw new ValidationError('Message is required')
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true, id: true } } },
  })

  if (!conversation) throw new NotFoundError('Conversation')

  // Authorization check
  const isOwner = conversation.project.ownerId === req.user.userId
  const isSaver = conversation.savedByUserId === req.user.userId
  if (!isOwner && !isSaver) {
    throw new AuthorizationError('Not authorized to continue this conversation')
  }

  // Re-activate if ended
  if (conversation.endedAt) {
    await prisma.conversation.update({
      where: { id },
      data: { endedAt: null, summary: null, sentiment: null, topics: [] },
    })
  }

  // Stream response using existing infrastructure
  const result = await generateChatCompletion(
    conversation.project.id,
    id,
    message,
    { stream: true }
  )

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Stream chunks
  for await (const chunk of result as AsyncIterable<string>) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  res.end()
}
```

### Frontend Changes

```typescript
// frontend/src/pages/SavedThreadPage.tsx

const handleSendMessage = async () => {
  if (!continueInput.trim() || !conversation) return

  const userMessage = continueInput.trim()
  setContinueInput('')
  setSending(true)
  setStreamingContent('')

  // Add user message optimistically
  setConversation(prev => ({
    ...prev!,
    messages: [...prev!.messages, {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString()
    }],
  }))

  try {
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

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader!.read()
      if (done) break

      const chunk = decoder.decode(value)
      // Parse SSE format
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6))
          if (data.chunk) {
            fullContent += data.chunk
            setStreamingContent(fullContent)
          }
        }
      }
    }

    // Add assistant message
    setConversation(prev => ({
      ...prev!,
      messages: [...prev!.messages, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        createdAt: new Date().toISOString(),
      }],
    }))
  } finally {
    setSending(false)
    setStreamingContent('')
  }
}
```

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/controllers/conversation.controller.ts` | Add function | `continueConversation()` |
| `backend/src/routes/conversation.routes.ts` | Add route | `POST /:id/messages` |
| `frontend/src/pages/SavedThreadPage.tsx` | Modify | Implement SSE chat, add streaming UI |
| `frontend/src/lib/api.ts` | Add method | `continueConversation()` |

---

## Success Criteria

1. User can send new messages from SavedThreadPage
2. AI responses stream in real-time
3. New messages persist to database
4. Context from all previous messages is included
5. RAG retrieval works for new messages
6. Ended conversations can be resumed
7. Authorization enforced (savedByUserId OR owner only)
