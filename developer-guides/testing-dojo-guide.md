# Testing Dojo - Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TESTING DOJO                                      │
│         Sandbox for creators to test their AI agent                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TestingDojo.tsx (Container)                       │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │   │
│  │  │ SessionManager  │  │    DojoChat      │  │  CommentSidebar   │   │   │
│  │  │                 │  │                  │  │                   │   │   │
│  │  │ - Create/select │  │ - SSE streaming  │  │ - View comments   │   │   │
│  │  │ - Rename        │  │ - Same RAG as    │  │ - Filter by       │   │   │
│  │  │ - End session   │  │   production     │  │   template        │   │   │
│  │  └─────────────────┘  │ - Add comments   │  └───────────────────┘   │   │
│  │                        │   to responses   │                          │   │
│  │                        └──────────────────┘                          │   │
│  │                               │                                       │   │
│  │                               ▼                                       │   │
│  │                    ┌──────────────────┐                              │   │
│  │                    │  CommentOverlay  │                              │   │
│  │                    │                  │                              │   │
│  │                    │ Templates:       │                              │   │
│  │                    │ - identity       │                              │   │
│  │                    │ - communication  │                              │   │
│  │                    │ - content        │                              │   │
│  │                    │ - engagement     │                              │   │
│  │                    │ - framing        │                              │   │
│  │                    └──────────────────┘                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│  Backend                                ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  testSession.controller.ts                           │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ CRUD        │  │ SSE Chat    │  │ Comments    │                  │   │
│  │  │ Sessions    │  │ Streaming   │  │ CRUD        │                  │   │
│  │  │             │  │             │  │             │                  │   │
│  │  │ Same prompt │  │ Uses SAME   │  │ Maps to     │                  │   │
│  │  │ building as │  │ RAG & context │  │ profile    │                  │   │
│  │  │ production  │  │ as production │  │ sections   │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│                                         ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   recommendationEngine.ts                            │   │
│  │                                                                       │   │
│  │  Comments → LLM Analysis → Profile Recommendations                   │   │
│  │                                                                       │   │
│  │  Template mapping:                                                    │   │
│  │  'identity'      → identityRole                                      │   │
│  │  'communication' → communicationStyle                                │   │
│  │  'content'       → contentPriorities                                 │   │
│  │  'engagement'    → engagementApproach                                │   │
│  │  'framing'       → keyFramings                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dependencies & Key Functions

### External Dependencies
- `openai` - Chat completions with streaming (same as production)
- `prisma` - TestSession, TestMessage, TestComment models

### Internal Dependencies
- `backend/src/services/contextService.ts` - `buildSystemPrompt()` (shared with production)
- `backend/src/services/chatService.ts` - `buildDocumentContext()` (shared RAG)
- `backend/src/services/recommendationEngine.ts` - Comment analysis

### Provided Functions

**testSession.controller.ts:**
- `getProjectTestSessions(projectId)` - List all sessions
- `createTestSession(projectId)` - Start new session
- `getTestSession(sessionId)` - Get session with messages/comments
- `updateTestSession(sessionId, data)` - Update name/status
- `deleteTestSession(sessionId)` - Remove session
- `sendTestMessage(sessionId, message)` - SSE streaming chat
- `addTestComment(messageId, content, templateId)` - Add comment
- `deleteTestComment(commentId)` - Remove comment

### Configuration
- Uses same model/temperature as project's AgentConfig
- Same RAG pipeline as production chat
- Same context layer composition

## User Experience Flow

### Creator Testing Flow

1. **Open Testing Dojo** → TestingDojo.tsx loads
2. **Create/Select Session** → SessionManager.tsx dropdown
3. **Chat with AI** → DojoChat.tsx, same behavior as viewer would see
4. **Observe AI Response** → Streaming, citations, tone
5. **Add Comment** → Click "Add Comment" on assistant message
6. **Select Template** → identity/communication/content/engagement/framing
7. **Write Feedback** → "Agent should be more formal"
8. **Continue Testing** → More messages, more comments
9. **End Session** → NavigationModal.tsx offers 3 options:
   - Keep session live (return later)
   - End session (save but mark complete)
   - End & Apply Feedback (generate recommendations)

### Comment Template System

| Template ID | Profile Section | Placeholder |
|-------------|-----------------|-------------|
| `identity` | identityRole | "The agent should present itself as..." |
| `communication` | communicationStyle | "The tone should be more/less..." |
| `content` | contentPriorities | "Should emphasize/de-emphasize..." |
| `engagement` | engagementApproach | "Should ask about/probe deeper into..." |
| `framing` | keyFramings | "Should frame this as..." |

## File & Code Mapping

### Key Files

| File | Responsibility | Lines |
|------|----------------|-------|
| `frontend/src/components/TestingDojo/TestingDojo.tsx` | Container, state management | 305 |
| `frontend/src/components/TestingDojo/DojoChat.tsx` | SSE streaming chat | 222 |
| `frontend/src/components/TestingDojo/SessionManager.tsx` | Session switcher | 163 |
| `frontend/src/components/TestingDojo/CommentOverlay.tsx` | Comment UI with templates | 127 |
| `frontend/src/components/TestingDojo/CommentSidebar.tsx` | Comment aggregation | 141 |
| `frontend/src/components/TestingDojo/NavigationModal.tsx` | End session flow | 74 |
| `backend/src/controllers/testSession.controller.ts` | CRUD + SSE | 460 |
| `backend/src/routes/testSession.routes.ts` | API routes | 32 |

### Entry Points

- **List Sessions:** `GET /api/projects/:projectId/test-sessions`
- **Create Session:** `POST /api/projects/:projectId/test-sessions`
- **Get Session:** `GET /api/test-sessions/:sessionId`
- **Send Message (SSE):** `POST /api/test-sessions/:sessionId/messages`
- **Add Comment:** `POST /api/test-messages/:messageId/comments`

### Database Models

```prisma
TestSession {
  id, projectId, name, status ('active' | 'ended')
  messages: TestMessage[]
  createdAt, updatedAt, endedAt
}

TestMessage {
  id, sessionId, role ('user' | 'assistant'), content
  comments: TestComment[]
  createdAt
}

TestComment {
  id, messageId, content
  templateId: 'identity' | 'communication' | 'content' | 'engagement' | 'framing' | null
  createdAt
}
```

## Connections to Other Parts

### Integration Points

| System | Connection | Notes |
|--------|------------|-------|
| Context Layers | Uses `buildSystemPrompt()` | Same as production |
| RAG | Uses `buildDocumentContext()` | Same vector search |
| Agent Config | Reads model/temperature | Same settings |
| Recommendations | Comments → `recommendationEngine.ts` | On "Apply Feedback" |
| Profile Versioning | Applied recs create versions | Non-destructive |

### Data Flow: Testing → Recommendations

```
TestSession created
    ↓
User chats (TestMessage role='user')
    ↓
AI responds (TestMessage role='assistant')
    ↓
User adds comment (TestComment)
    ↓
Session ended with "Apply Feedback"
    ↓
Comments → recommendationEngine.generateRecommendations()
    ↓
ProfileRecommendation records created
    ↓
RecommendationPanel opens for review
    ↓
User applies → ProfileVersion created
```

## Critical Notes & Pitfalls

### CRITICAL: Stale Closure Bug Pattern

**The Problem:**
When SSE streams rapidly send user + assistant messages, direct state references cause stale closures - new messages overwrite instead of append.

**BAD Pattern (Causes Data Loss):**
```typescript
// ❌ WRONG - Direct state reference
const handleNewMessage = (message: TestMessage) => {
  setActiveSession({
    ...activeSession,  // STALE - doesn't reflect latest updates
    messages: [...activeSession.messages, message]
  })
}
```

**Why it fails:**
1. User sends message → `handleNewMessage` called → `activeSession = { messages: [msg1] }`
2. Before React re-renders, assistant message streams in → `handleNewMessage` called again
3. `activeSession` STILL `{ messages: [msg1] }` (stale closure)
4. Sets messages to `[msg1, assistantMsg]` → **user message lost**

**GOOD Pattern (Functional Update):**
```typescript
// ✅ CORRECT - Functional setState
const handleNewMessage = (message: TestMessage) => {
  setActiveSession((prev) => {
    if (!prev) return prev
    return {
      ...prev,  // Uses LATEST state React has
      messages: [...prev.messages, message]
    }
  })
}
```

**Location:** `TestingDojo.tsx:135-145`

**Rule:** Use functional `setState(prev => ...)` for ANY state updated by:
- SSE streaming
- Rapid async events
- Websocket messages
- Multiple updates in quick succession

### Performance

**Authentic Testing:**
- Uses EXACT same AI pipeline as production
- Same prompts, same RAG, same model settings
- Only difference: session storage (TestSession vs Conversation)

### Data Integrity

**Session Auto-Selection:**
```typescript
// TestingDojo.tsx:67-73
const active = sessions.find((s) => s.status === 'active')
if (active) {
  setActiveSessionId(active.id)  // Prefer active session
} else if (sessions.length > 0) {
  setActiveSessionId(sessions[0].id)  // Otherwise most recent
}
```

**Browser Navigation Protection:**
```typescript
// TestingDojo.tsx:48-59
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges && activeSession?.status === 'active') {
      e.preventDefault()
      e.returnValue = ''  // Shows browser confirmation
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
}, [hasUnsavedChanges, activeSession])
```

### Known Edge Cases

**ProfileSectionContent for Markdown:**
```typescript
// DojoChat.tsx:154-158
{message.role === 'assistant' ? (
  <ProfileSectionContent content={message.content} />  // Handles mixed JSON/markdown
) : (
  <div className="whitespace-pre-wrap">{message.content}</div>
)}
```

**Comment Count Badge:**
```typescript
// DojoChat.tsx:161-165
{message.comments.length > 0 && (
  <div className="absolute -right-2 -top-2 bg-accent rounded-full">
    {message.comments.length}
  </div>
)}
```

## Common Development Scenarios

### 1. Adding a New Comment Template

**Files to modify:**
1. `frontend/src/components/TestingDojo/CommentOverlay.tsx`:
   - Add to `COMMENT_TEMPLATES` array
2. `backend/src/services/recommendationEngine.ts`:
   - Add mapping to profile section

**Pattern:**
```typescript
// CommentOverlay.tsx
const COMMENT_TEMPLATES = [
  // ... existing templates
  { id: 'newTemplate', label: 'New Template', placeholder: 'The agent should...' }
]

// recommendationEngine.ts
const TEMPLATE_TO_SECTION = {
  // ... existing mappings
  'newTemplate': 'targetSection'
}
```

### 2. Modifying SSE Streaming Behavior

**File:** `backend/src/controllers/testSession.controller.ts:259-368`

**Key Code:**
```typescript
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')

for await (const chunk of stream) {
  res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`)
}
res.write('data: [DONE]\n\n')
```

### 3. Debugging Comment Not Appearing

**Steps:**
1. Check browser Network tab for POST `/api/test-messages/:id/comments`
2. Verify 201 response received
3. Check `handleNewComment` in TestingDojo.tsx uses functional setState
4. Inspect React DevTools for state update

**Common causes:**
- Stale closure (fix: functional setState)
- Network error (check response)
- Missing refresh after comment add

### 4. Adding Session Metadata

**Files to modify:**
1. `backend/prisma/schema.prisma` - Add field to TestSession
2. `backend/src/controllers/testSession.controller.ts` - Include in create/update
3. Run `npm run db:push`

## Testing Strategy

### Manual Testing Checklist
- [ ] Create new test session
- [ ] Send message, watch streaming response
- [ ] Add comment to assistant message
- [ ] Select template (identity, communication, etc.)
- [ ] Comment appears in sidebar
- [ ] End session with "Apply Feedback"
- [ ] Verify recommendations generated
- [ ] Multiple comments on same message work

### Smoke Tests
```bash
# Create session
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/projects/$PROJECT_ID/test-sessions

# List sessions
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/projects/$PROJECT_ID/test-sessions
```

### Debugging Tips
- Check browser DevTools Network tab for SSE stream
- Console log in `handleNewMessage` to trace state updates
- Use React DevTools to inspect `activeSession` state
- Check backend logs for `[TestSession]` messages

## Quick Reference

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/:projectId/test-sessions` | List sessions |
| POST | `/api/projects/:projectId/test-sessions` | Create session |
| GET | `/api/test-sessions/:sessionId` | Get with messages |
| PATCH | `/api/test-sessions/:sessionId` | Update name/status |
| DELETE | `/api/test-sessions/:sessionId` | Delete session |
| POST | `/api/test-sessions/:sessionId/messages` | Send message (SSE) |
| POST | `/api/test-messages/:messageId/comments` | Add comment |
| DELETE | `/api/test-comments/:commentId` | Remove comment |

### Comment Templates

| ID | Label | Maps To |
|----|-------|---------|
| `identity` | Identity/Role | `identityRole` |
| `communication` | Communication | `communicationStyle` |
| `content` | Content | `contentPriorities` |
| `engagement` | Engagement | `engagementApproach` |
| `framing` | Framing | `keyFramings` |

### Session Status Values
- `active` - Session in progress, can add messages/comments
- `ended` - Session complete, read-only

### Critical Files Checklist
1. `frontend/src/components/TestingDojo/TestingDojo.tsx` - Container, state
2. `frontend/src/components/TestingDojo/DojoChat.tsx` - SSE streaming
3. `frontend/src/components/TestingDojo/CommentOverlay.tsx` - Comment templates
4. `backend/src/controllers/testSession.controller.ts` - All CRUD + SSE
5. `backend/src/services/recommendationEngine.ts` - Comment → recommendation
