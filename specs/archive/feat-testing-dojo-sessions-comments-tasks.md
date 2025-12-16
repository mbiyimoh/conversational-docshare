# Testing Dojo + Sessions + Comments - Task Breakdown

## Overview

Decomposition of `specs/feat-testing-dojo-sessions-comments.md` into actionable implementation tasks.

**Feature**: Testing Dojo - sandbox environment for creators to test their AI agent with session management and response-tagged comments.

## Dependency Graph

```
[T1.1] Schema Migration
    ↓
[T1.2] TypeScript Types ─────────────────────────┐
    ↓                                            │
[T1.3] Test Session Controller                   │
    ↓                                            │
[T1.4] Routes Registration                       │
    ↓                                            ↓
[T1.5] Backend Tests              [T2.1] Frontend API Methods
                                       ↓
                            ┌──────────┴──────────┐
                            ↓                     ↓
                    [T2.2] TestingDojo    [T2.4] SessionManager
                            ↓
                    [T2.3] DojoChat
                            ↓
                    [T3.1] CommentOverlay
                            ↓
                    [T3.2] CommentSidebar
                            ↓
                    [T3.3] Comment Integration
                            ↓
                    [T4.1] NavigationModal
                            ↓
                    [T4.2] ProjectPage Integration
                            ↓
                    [T4.3] E2E Tests
```

## Phase 1: Backend Infrastructure

### Task 1.1: Add Testing Dojo Schema to Prisma
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: None

Add TestSession, TestMessage, and TestComment models to Prisma schema.

**Files to modify**:
- `backend/prisma/schema.prisma`

**Implementation**:
```prisma
model TestSession {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name        String?  // User-editable name, defaults to "Session #N"
  status      String   @default("active")  // active, ended

  // Relationships
  messages    TestMessage[]

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  endedAt     DateTime?

  @@index([projectId])
  @@index([status])
  @@map("test_sessions")
}

model TestMessage {
  id          String      @id @default(cuid())
  sessionId   String
  session     TestSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  role        String      // user, assistant
  content     String      @db.Text

  // Relationships
  comments    TestComment[]

  // Timestamps
  createdAt   DateTime    @default(now())

  @@index([sessionId])
  @@map("test_messages")
}

model TestComment {
  id          String      @id @default(cuid())
  messageId   String
  message     TestMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  content     String      @db.Text  // Freeform feedback text
  templateId  String?     // If created from template: identity|communication|content|engagement|framing

  // Timestamps
  createdAt   DateTime    @default(now())

  @@index([messageId])
  @@map("test_comments")
}
```

Also add relation to Project model:
```prisma
model Project {
  // ... existing fields ...
  testSessions    TestSession[]
}
```

**Validation**:
- [ ] Schema compiles without errors
- [ ] Migration generates successfully
- [ ] Migration applies to database

---

### Task 1.2: Create TypeScript Types for Testing
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: T1.1

Create shared TypeScript type definitions for frontend use.

**Files to create**:
- `frontend/src/types/testing.ts`

**Implementation**:
```typescript
export interface TestSession {
  id: string
  projectId: string
  name: string | null
  status: 'active' | 'ended'
  createdAt: string
  updatedAt: string
  endedAt: string | null
}

export interface TestSessionSummary {
  id: string
  name: string | null
  status: 'active' | 'ended'
  messageCount: number
  commentCount: number
  createdAt: string
  endedAt: string | null
}

export interface TestSessionWithMessages extends TestSession {
  messages: TestMessage[]
}

export interface TestMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  comments: TestComment[]
}

export interface TestComment {
  id: string
  messageId: string
  content: string
  templateId: string | null
  createdAt: string
}

export interface CommentTemplate {
  id: string
  label: string
  icon: string
  placeholder: string
}
```

**Validation**:
- [ ] Types compile without errors
- [ ] Types exported correctly

---

### Task 1.3: Implement Test Session Controller
**Priority**: P0 (blocking)
**Estimated Complexity**: High
**Dependencies**: T1.1

Create controller with 8 endpoint handlers for session, message, and comment operations.

**Files to create**:
- `backend/src/controllers/testSession.controller.ts`

**Implementation**: Full controller with:
- `getTestSessions` - GET /api/projects/:projectId/test-sessions
- `createTestSession` - POST /api/projects/:projectId/test-sessions
- `getTestSession` - GET /api/test-sessions/:sessionId
- `updateTestSession` - PATCH /api/test-sessions/:sessionId
- `deleteTestSession` - DELETE /api/test-sessions/:sessionId
- `sendTestMessage` - POST /api/test-sessions/:sessionId/messages (SSE streaming)
- `addTestComment` - POST /api/test-messages/:messageId/comments
- `deleteTestComment` - DELETE /api/test-comments/:commentId

Key patterns:
- All endpoints verify project ownership
- sendTestMessage uses SSE for streaming responses
- Uses same `buildSystemPrompt` as production chat
- Auto-names sessions as "Session #N"

**Validation**:
- [ ] All 8 functions exported
- [ ] 401 returned if not authenticated
- [ ] 403 returned if user doesn't own project
- [ ] 404 returned if resource not found
- [ ] SSE streaming works for sendTestMessage
- [ ] Messages stored after streaming completes

---

### Task 1.4: Register Test Session Routes
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: T1.3

Create route definitions and register in Express app.

**Files to create**:
- `backend/src/routes/testSession.routes.ts`

**Files to modify**:
- `backend/src/index.ts`

**Implementation**:
```typescript
// testSession.routes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getTestSessions,
  createTestSession,
  getTestSession,
  updateTestSession,
  deleteTestSession,
  sendTestMessage,
  addTestComment,
  deleteTestComment,
} from '../controllers/testSession.controller'

const router = Router()

// Session routes
router.get('/projects/:projectId/test-sessions', authenticate, getTestSessions)
router.post('/projects/:projectId/test-sessions', authenticate, createTestSession)
router.get('/test-sessions/:sessionId', authenticate, getTestSession)
router.patch('/test-sessions/:sessionId', authenticate, updateTestSession)
router.delete('/test-sessions/:sessionId', authenticate, deleteTestSession)

// Message routes
router.post('/test-sessions/:sessionId/messages', authenticate, sendTestMessage)

// Comment routes
router.post('/test-messages/:messageId/comments', authenticate, addTestComment)
router.delete('/test-comments/:commentId', authenticate, deleteTestComment)

export default router
```

Register in index.ts:
```typescript
import testSessionRoutes from './routes/testSession.routes'
app.use('/api', testSessionRoutes)
```

**Validation**:
- [ ] Routes file created
- [ ] Routes registered in Express app
- [ ] All 8 endpoints accessible

---

### Task 1.5: Backend Unit and Integration Tests
**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: T1.4

Write comprehensive tests for the test session controller.

**Files to create**:
- `backend/src/__tests__/testSession.controller.test.ts`

**Test coverage**:
- Session CRUD operations
- Message streaming
- Comment operations
- Authorization checks
- Validation errors

**Validation**:
- [ ] All tests pass
- [ ] Coverage for happy paths
- [ ] Coverage for error cases

---

## Phase 2: Frontend - Core Dojo

### Task 2.1: Add Test Session API Methods
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: T1.4

Add API client methods for test session endpoints.

**Files to modify**:
- `frontend/src/lib/api.ts`

**Implementation**:
```typescript
// Test Session endpoints
async getTestSessions(projectId: string) {
  return this.request<{ sessions: TestSessionSummary[] }>(
    `/api/projects/${projectId}/test-sessions`
  )
}

async createTestSession(projectId: string, name?: string) {
  return this.request<{ session: TestSession }>(
    `/api/projects/${projectId}/test-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    }
  )
}

async getTestSession(sessionId: string) {
  return this.request<{ session: TestSessionWithMessages }>(
    `/api/test-sessions/${sessionId}`
  )
}

async updateTestSession(sessionId: string, data: { name?: string; status?: string }) {
  return this.request<{ session: TestSession }>(
    `/api/test-sessions/${sessionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  )
}

async deleteTestSession(sessionId: string) {
  return this.request<{ success: boolean }>(
    `/api/test-sessions/${sessionId}`,
    { method: 'DELETE' }
  )
}

// Comment endpoints
async addTestComment(messageId: string, content: string, templateId?: string) {
  return this.request<{ comment: TestComment }>(
    `/api/test-messages/${messageId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ content, templateId }),
    }
  )
}

async deleteTestComment(commentId: string) {
  return this.request<{ success: boolean }>(
    `/api/test-comments/${commentId}`,
    { method: 'DELETE' }
  )
}
```

**Validation**:
- [ ] All 7 methods added
- [ ] Types imported correctly
- [ ] Methods compile without errors

---

### Task 2.2: Create TestingDojo Container Component
**Priority**: P0 (blocking)
**Estimated Complexity**: High
**Dependencies**: T2.1

Create the main container component that orchestrates sessions, chat, and comments.

**Files to create**:
- `frontend/src/components/TestingDojo/TestingDojo.tsx`
- `frontend/src/components/TestingDojo/index.ts`

**Implementation**: ~150 lines including:
- Session loading and state management
- Active session selection
- Browser navigation handling (beforeunload)
- Navigation modal integration
- Error handling

**Validation**:
- [ ] Component renders without errors
- [ ] Sessions load on mount
- [ ] Active session auto-selected
- [ ] Browser refresh warning works

---

### Task 2.3: Create DojoChat Component
**Priority**: P0 (blocking)
**Estimated Complexity**: High
**Dependencies**: T2.2

Create the chat interface with SSE streaming support.

**Files to create**:
- `frontend/src/components/TestingDojo/DojoChat.tsx`

**IMPORTANT**: AI responses may contain mixed JSON/markdown formatting from OpenAI. Use `ProfileSectionContent` component for rendering assistant messages to ensure proper formatting.

**Implementation**: ~150 lines including:
- Message list with user/assistant styling
- **Use ProfileSectionContent for assistant messages** (handles markdown/JSON)
- SSE streaming handling
- Comment indicators on messages
- Add comment button (hover)
- Auto-scroll to bottom

**Key features**:
- Uses native fetch with ReadableStream for SSE
- Parses streaming data format
- Shows typing indicator during streaming
- Uses `group` class for hover effects
- **Uses ProfileSectionContent for AI response rendering**

**Required import**:
```typescript
import { ProfileSectionContent } from '../ProfileSectionContent'
```

**Validation**:
- [ ] Messages display correctly
- [ ] **Assistant messages use ProfileSectionContent** (no raw markdown/JSON visible)
- [ ] Streaming works end-to-end
- [ ] Auto-scroll functions
- [ ] Comment button appears on hover

---

### Task 2.4: Create SessionManager Component
**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: T2.1

Create dropdown for session selection and management.

**Files to create**:
- `frontend/src/components/TestingDojo/SessionManager.tsx`

**Implementation**: ~150 lines including:
- Dropdown with session list
- New session button
- Session metadata (message count, comment count, date)
- Active/ended status badges
- Delete with confirmation

**Validation**:
- [ ] Dropdown opens/closes correctly
- [ ] Sessions display with metadata
- [ ] Create new session works
- [ ] Delete with confirmation works

---

## Phase 3: Frontend - Comments

### Task 3.1: Create CommentOverlay Component
**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: T2.3

Create the comment input overlay with quick templates.

**Files to create**:
- `frontend/src/components/TestingDojo/CommentOverlay.tsx`

**Implementation**: ~70 lines including:
- 5 quick templates (identity, communication, content, engagement, framing)
- Template selection populates placeholder
- Textarea for freeform input
- Submit and cancel buttons

**Templates**:
```typescript
const COMMENT_TEMPLATES = [
  { id: 'identity', label: 'Identity/Role', icon: '👤', placeholder: 'The agent should present itself as...' },
  { id: 'communication', label: 'Communication', icon: '💬', placeholder: 'The tone should be more/less...' },
  { id: 'content', label: 'Content', icon: '📋', placeholder: 'Should emphasize/de-emphasize...' },
  { id: 'engagement', label: 'Engagement', icon: '🎯', placeholder: 'Should ask about/probe deeper into...' },
  { id: 'framing', label: 'Framing', icon: '🖼️', placeholder: 'Should frame this as...' },
]
```

**Validation**:
- [ ] Templates render correctly
- [ ] Template selection works
- [ ] Submit saves comment
- [ ] Cancel closes overlay

---

### Task 3.2: Create CommentSidebar Component
**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: T3.1

Create the right sidebar showing all comments grouped by message.

**Files to create**:
- `frontend/src/components/TestingDojo/CommentSidebar.tsx`

**IMPORTANT**: Message previews should strip markdown/JSON formatting for clean display. Use the `getPreviewText` utility function.

**Implementation**: ~120 lines including:
- Header with total comment count
- Comments grouped by message
- Message preview (clickable to scroll) - **uses getPreviewText for clean text**
- Template badges on comments
- Delete button per comment
- Empty state

**Preview text utility**:
```typescript
function getPreviewText(content: string, maxLength = 100): string {
  return content
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')       // Remove italic
    .replace(/^#{1,6}\s+/gm, '')         // Remove headers
    .replace(/[{}\[\]"]/g, '')           // Remove JSON chars
    .replace(/\s+/g, ' ')                // Collapse whitespace
    .trim()
    .substring(0, maxLength)
}
```

**Validation**:
- [ ] Comments display grouped by message
- [ ] **Message previews use getPreviewText** (no raw markdown/JSON in previews)
- [ ] Click scrolls to message
- [ ] Delete removes comment
- [ ] Empty state shows instructions

---

### Task 3.3: Integrate Comments into DojoChat
**Priority**: P1
**Estimated Complexity**: Low
**Dependencies**: T3.1, T3.2

Integrate comment indicators and overlay into DojoChat.

**Files to modify**:
- `frontend/src/components/TestingDojo/DojoChat.tsx`

**Implementation**:
- Comment count badge on messages
- CommentOverlay positioned correctly
- API calls to create comments
- State updates on comment creation

**Validation**:
- [ ] Comment badge shows count
- [ ] Overlay appears on click
- [ ] Comment persists to database
- [ ] UI updates immediately

---

## Phase 4: Navigation & Polish

### Task 4.1: Create NavigationModal Component
**Priority**: P1
**Estimated Complexity**: Low
**Dependencies**: T2.2

Create modal for handling navigation away from active session.

**Files to create**:
- `frontend/src/components/TestingDojo/NavigationModal.tsx`

**Implementation**: ~80 lines including:
- 3 options: Keep Live, End Session, End & Apply Feedback
- Apply Feedback only shows if hasComments
- Cancel button

**Validation**:
- [ ] Modal renders correctly
- [ ] All 3 options work
- [ ] Apply Feedback conditional display
- [ ] Cancel closes modal

---

### Task 4.2: Integrate TestingDojo into ProjectPage
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: T4.1

Add Test tab to ProjectPage and integrate TestingDojo component.

**Files to modify**:
- `frontend/src/pages/ProjectPage.tsx`

**Implementation**:
- Add "Test" to activeTab type
- Add Test tab button between "AI Agent" and "Share"
- Add TestingDojo tabpanel
- Wire up onNavigateAway handler

**Validation**:
- [ ] Test tab appears in navigation
- [ ] Tab positioned correctly (after AI Agent, before Share)
- [ ] TestingDojo renders in tab content
- [ ] Tab switching works

---

### Task 4.3: E2E Tests for Testing Dojo
**Priority**: P2
**Estimated Complexity**: Medium
**Dependencies**: T4.2

Write comprehensive E2E tests for the complete Testing Dojo flow.

**Files to create**:
- `frontend/e2e/testing-dojo.spec.ts`

**Test scenarios**:
1. Create new session and send message
2. Add comment to AI response
3. Switch between sessions
4. Delete session
5. Navigation modal behavior
6. End session and apply feedback

**Validation**:
- [ ] All tests pass
- [ ] Tests run in CI
- [ ] Coverage for main user flows

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Backend | T1.1-T1.5 | P0-P1 |
| Phase 2: Core Dojo | T2.1-T2.4 | P0-P1 |
| Phase 3: Comments | T3.1-T3.3 | P1 |
| Phase 4: Navigation | T4.1-T4.3 | P0-P2 |

**Total Tasks**: 13
**Critical Path**: T1.1 → T1.3 → T1.4 → T2.1 → T2.2 → T2.3 → T4.2

## References

- Spec: `specs/feat-testing-dojo-sessions-comments.md`
- Profile Spec: `specs/feat-ai-agent-profile-synthesis.md`
- Recommendation Spec: `specs/feat-recommendation-engine.md`
