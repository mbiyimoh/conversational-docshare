# Chat & Conversation System - Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CHAT & CONVERSATION SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER MESSAGE                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                       │
│  │  ChatInterface   │ Frontend: Textarea + messages display                │
│  │  ChatInput       │ Enter to send, Shift+Enter newline                   │
│  │  ChatMessage     │ Parses [DOC:filename:section-id] citations           │
│  └─────────────────┘                                                       │
│       │                                                                     │
│       │ HTTP POST /api/conversations/:id/messages/stream                   │
│       ▼                                                                     │
│  ┌─────────────────┐                                                       │
│  │ chat.controller │ Sets SSE headers, streams response                    │
│  └─────────────────┘                                                       │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         chatService.ts                               │   │
│  │                                                                       │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │   │
│  │  │ System Prompt  │  │ Document RAG   │  │ Conversation History   │ │   │
│  │  │                │  │                │  │                        │ │   │
│  │  │ Context layers │  │ Vector search  │  │ Last 10 messages       │ │   │
│  │  │ Doc outlines   │  │ Top 5 chunks   │  │ (user + assistant)     │ │   │
│  │  │ Citation rules │  │ With section   │  │                        │ │   │
│  │  │                │  │ IDs for citing │  │                        │ │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘ │   │
│  │           │                  │                      │                │   │
│  │           └──────────────────┴──────────────────────┘                │   │
│  │                              │                                        │   │
│  │                              ▼                                        │   │
│  │                    ┌──────────────────┐                              │   │
│  │                    │   OpenAI API     │                              │   │
│  │                    │  stream: true    │                              │   │
│  │                    │  gpt-4-turbo     │                              │   │
│  │                    └──────────────────┘                              │   │
│  │                              │                                        │   │
│  │                              ▼                                        │   │
│  │                    ┌──────────────────┐                              │   │
│  │                    │  Async Generator │                              │   │
│  │                    │  yield chunks    │                              │   │
│  │                    └──────────────────┘                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       │ SSE: data: {"chunk":"text"}\n\n                                    │
│       ▼                                                                     │
│  ┌─────────────────┐                                                       │
│  │  ReadableStream │ Frontend processes chunks in real-time                │
│  │  decoder.decode │ Updates streamingContent state                        │
│  └─────────────────┘                                                       │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                       │
│  │ Citation Parse  │ [DOC:filename:section-id] → clickable links          │
│  │ Document Lookup │ Filename → document ID resolution                     │
│  │ Section Scroll  │ Opens doc, scrolls to section, highlights            │
│  └─────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dependencies & Key Functions

### External Dependencies
- `openai` - Chat completions with streaming
- `prisma` - Conversation, Message, Citation models

### Internal Dependencies
- `backend/src/services/contextService.ts` - `buildSystemPrompt()`
- `backend/src/services/embeddingService.ts` - `searchSimilarChunks()`
- `backend/src/services/welcomeService.ts` - Welcome message generation
- `frontend/src/lib/documentReferences.ts` - Citation parsing
- `frontend/src/lib/documentLookup.ts` - Filename → ID resolution

### Provided Functions

**chatService.ts:**
- `generateChatCompletion(projectId, conversationId, message, options)` - Main orchestration
- `streamChatCompletion(...)` - Async generator for SSE
- `buildDocumentContext(projectId, userMessage)` - RAG retrieval
- `createConversation(projectId, shareLinkId, viewerEmail)` - Start conversation
- `getConversation(conversationId)` - Fetch with messages

**documentReferences.ts:**
- `parseDocumentReferences(content)` - Extract `[DOC:...]` references
- `splitMessageIntoParts(content)` - Split into text/reference parts
- `getUniqueReferencedDocuments(content)` - List referenced docs

**documentLookup.ts:**
- `initDocumentLookup(slug)` - Load document metadata cache
- `lookupDocumentByFilename(filename)` - O(1) filename → ID lookup

## User Experience Flow

### End-User Perspective (Viewer)

1. Access share link → Verify credentials → Create conversation
2. See AI welcome message (auto-generated)
3. Type question → Press Enter
4. Watch streaming response appear character by character
5. See citations like `[DOC:Business Plan.pdf:section-1]`
6. Click citation → Document opens, scrolls to section, highlights

### Data Flow: Message → Response

```
1. User types "What are the revenue projections?"
       ↓
2. Frontend: ChatInterface.handleSendMessage()
       ↓
3. HTTP POST /api/conversations/:id/messages/stream
       ↓
4. Backend: chat.controller.sendMessageStream()
   - Set SSE headers
   - Call generateChatCompletion()
       ↓
5. chatService: Build context
   - System prompt (context layers + doc outlines)
   - Document context (RAG: top 5 similar chunks)
   - Conversation history (last 10 messages)
       ↓
6. OpenAI API: stream=true, gpt-4-turbo
       ↓
7. Async generator yields chunks
       ↓
8. SSE to frontend: data: {"chunk":"Revenue..."}\n\n
       ↓
9. Frontend: Parse chunks, update streamingContent
       ↓
10. Stream complete: data: [DONE]\n\n
       ↓
11. Backend: Save assistant message to database
       ↓
12. Frontend: Parse citations, render as clickable links
```

## File & Code Mapping

### Key Files

| File | Responsibility | Lines |
|------|----------------|-------|
| `backend/src/services/chatService.ts` | Core chat orchestration, streaming | 438 |
| `backend/src/controllers/chat.controller.ts` | HTTP handlers, SSE setup | 216 |
| `backend/src/services/welcomeService.ts` | Welcome message generation | 118 |
| `frontend/src/components/ChatInterface.tsx` | Chat container, stream handling | 221 |
| `frontend/src/components/ChatMessage.tsx` | Message bubble, citation rendering | 63 |
| `frontend/src/lib/documentReferences.ts` | Citation regex parsing | 139 |
| `frontend/src/lib/documentLookup.ts` | Document metadata cache | 189 |
| `frontend/src/pages/SharePage.tsx` | Chat integration, citation clicks | 596 |

### Entry Points

- **Start Conversation:** `POST /api/projects/:projectId/conversations`
- **Send Message (SSE):** `POST /api/conversations/:conversationId/messages/stream`
- **Get History:** `GET /api/conversations/:conversationId`

### UX-to-Code Mapping

| User Action | Frontend File | Backend File |
|-------------|---------------|--------------|
| Access share link | `SharePage.tsx:155-171` | `shareLink.controller.ts` |
| See welcome message | `ChatInterface.tsx:45-50` | `welcomeService.ts:16-77` |
| Send message | `ChatInterface.tsx:55-120` | `chat.controller.ts:101-127` |
| Watch streaming | `ChatInterface.tsx:97-142` | `chatService.ts:249-267` |
| Click citation | `SharePage.tsx:244-260` | N/A (frontend only) |

## Connections to Other Parts

### Data Sources
- **Reads:** `ContextLayer`, `Document`, `DocumentChunk`, `AgentConfig`, `Message`
- **Writes:** `Conversation`, `Message` (user + assistant)

### Integration Points

| System | Connection |
|--------|------------|
| Context Layers | `buildSystemPrompt()` includes layers in system message |
| Document Processing | RAG uses `DocumentChunk.embedding` for similarity |
| Share Links | Conversation created per share link access |
| Analytics | Message count, conversation metadata logged |
| Testing Dojo | Uses same `buildSystemPrompt()` and RAG |

### Document Reference Format

**Format:** `[DOC:filename:section-id]`

**Examples:**
```
[DOC:Business Plan.pdf:executive-summary-1]
[DOC:Financial Model.xlsx:revenue-projections]
```

**How it works:**

1. System prompt includes citation instructions (contextService.ts:89-102)
2. RAG context provides citation templates per chunk (chatService.ts:102-105)
3. Frontend regex parses references (documentReferences.ts:31)
4. Lookup resolves filename → document ID (documentLookup.ts:97)
5. SharePage opens document, scrolls to section (SharePage.tsx:244)

## Critical Notes & Pitfalls

### Security
- Conversations contain viewer questions (potentially sensitive)
- System prompt includes full context layers (business sensitive)
- Rate limiting should be applied to prevent abuse

### Performance
- **RAG search:** ~100-500ms depending on chunk count
- **LLM streaming:** 2-10 seconds depending on response length
- **Document lookup initialization:** ~50-100ms (cached after first load)

**Bottleneck:** `buildSystemPrompt()` called every message. Consider caching.

### Data Integrity

**Stale Closure Prevention (SSE Streaming):**
```typescript
// ❌ BAD - Direct state reference
setMessages([...messages, newMessage])

// ✅ GOOD - Functional update
setMessages(prev => [...prev, newMessage])
```

**Message Save Timing:**
```typescript
// Assistant message saved AFTER streaming completes
// If connection drops mid-stream, message is lost
for await (const chunk of stream) {
  yield chunk
}
await prisma.message.create({ data: { content: fullResponse } })
```

### Known Edge Cases

**Citation Regex Limitations:**
```typescript
// Regex: /\[DOC:([a-zA-Z0-9\s._-]+):([a-zA-Z0-9_-]+)\]/g
// Filename CANNOT contain: () [] : & +
// Section ID CANNOT contain: . or spaces
```

**Document Lookup Must Initialize:**
```typescript
// SharePage.tsx:123-133
useEffect(() => {
  if (accessGranted && slug && !documentsLoaded) {
    initDocumentLookup(slug) // MUST call before citations work
  }
}, [accessGranted, slug])
```

**Auto-Scroll Dependencies:**
```typescript
// ChatInterface.tsx:28-30
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages, streamingContent]) // Must include streamingContent!
```

## Common Development Scenarios

### 1. Adding New Context to Chat Prompt

**Files to modify:**
1. `backend/src/services/contextService.ts` - Add section to `buildSystemPrompt()`
2. Test with chat to verify inclusion

**Pattern:**
```typescript
// contextService.ts
sections.push('## YOUR NEW SECTION')
sections.push('Content goes here')
sections.push('---')
```

### 2. Changing RAG Parameters

**File:** `backend/src/services/chatService.ts`

**Parameters:**
- `limit` in `searchSimilarChunks()` - Number of chunks (default 5)
- Similarity threshold (not currently implemented)

```typescript
// chatService.ts:79-116
const similarChunks = await searchSimilarChunks(projectId, userMessage, 5)
```

### 3. Debugging Citation Parsing

**Steps:**
1. Check raw LLM response for citation format
2. Test regex in browser console:
   ```javascript
   /\[DOC:([a-zA-Z0-9\s._-]+):([a-zA-Z0-9_-]+)\]/g.exec(text)
   ```
3. Verify document lookup is initialized
4. Check browser Network tab for document fetch

### 4. Adding New Message Metadata

**Files to modify:**
1. `backend/prisma/schema.prisma` - Add field to Message model
2. `backend/src/services/chatService.ts` - Include in create
3. Run `npm run db:push` to update schema

## Testing Strategy

### Manual Testing Checklist
- [ ] Start new conversation, see welcome message
- [ ] Send message, watch streaming response
- [ ] Verify citations render as links
- [ ] Click citation, document opens and scrolls
- [ ] Long conversation (10+ messages) still works
- [ ] Test with different document types (PDF, DOCX)

### Smoke Tests
```bash
# Start conversation
curl -X POST -H "Content-Type: application/json" \
  -d '{"viewerEmail":"test@example.com"}' \
  http://localhost:4000/api/projects/$PROJECT_ID/conversations

# Get conversation
curl http://localhost:4000/api/conversations/$CONV_ID
```

### Debugging Tips
- Check browser DevTools Network tab for SSE stream
- Look for `data: {"chunk":...}` lines in response
- Console log in `ChatInterface.tsx:97-142` for stream parsing
- Check backend logs for OpenAI API errors

## Quick Reference

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/projects/:projectId/conversations` | Start conversation |
| POST | `/api/conversations/:id/messages/stream` | Send message (SSE) |
| GET | `/api/conversations/:id` | Get history |
| GET | `/api/projects/:projectId/conversations` | List all (owner) |

### SSE Response Format
```
data: {"chunk":"Hello"}\n\n
data: {"chunk":" there"}\n\n
data: {"chunk":"!"}\n\n
data: [DONE]\n\n
```

### Configuration Summary

| Setting | Value | Location |
|---------|-------|----------|
| Model | gpt-4-turbo | chatService.ts |
| RAG Chunks | 5 | chatService.ts:79 |
| History Limit | 10 messages | chatService.ts |
| Welcome Model | gpt-4o | welcomeService.ts |
| Citation Regex | `[DOC:filename:section-id]` | documentReferences.ts:31 |

### Critical Files Checklist
1. `backend/src/services/chatService.ts` - Core orchestration
2. `backend/src/controllers/chat.controller.ts` - SSE setup
3. `frontend/src/components/ChatInterface.tsx` - Stream handling
4. `frontend/src/lib/documentReferences.ts` - Citation parsing
5. `frontend/src/lib/documentLookup.ts` - Document resolution
6. `frontend/src/pages/SharePage.tsx` - Integration
