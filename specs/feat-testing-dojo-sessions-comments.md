# Testing Dojo with Sessions and Comments

## Status
Draft

## Authors
Claude Code - November 26, 2025

## Overview

Add a "Testing Dojo" sandbox environment where creators can test their AI agent by pretending to be recipients. The Dojo mirrors the exact recipient experience (including document access and citations) and allows creators to leave comments on specific AI responses. Testing is organized into sessions, with comments persisted per session. Includes quick comment templates aligned with profile sections and navigation-away handling with modal confirmation.

## Background/Problem Statement

### Current State
After configuring an AI agent through the interview and reviewing the profile, creators have no way to test how the agent will actually behave in conversations. They must share with real recipients to discover issues.

### Problem
1. **Blind Deployment**: Creators share agents without testing, leading to poor recipient experiences
2. **No Feedback Loop**: No mechanism to capture observations during testing
3. **No Organization**: Without sessions, testing feedback gets lost or disorganized
4. **Context Loss**: When navigating away, unsaved testing state is lost

### Solution
A dedicated Testing Dojo tab that provides a complete sandbox environment with session management, response-tagged comments, and intelligent navigation handling.

## Goals

- Provide sandbox chat that mirrors exact recipient experience (documents, citations, context)
- Organize testing into named sessions with full message history
- Allow creators to attach freeform comments to any AI response
- Provide quick comment templates aligned with profile sections (Identity, Communication, Content, Engagement, Framings)
- Handle navigation-away with modal: keep session live or end + apply feedback
- Support multiple comments per AI response
- Persist sessions and comments indefinitely until manually deleted
- Add "Test" tab to ProjectPage between "AI Agent" and "Share"

## Non-Goals

- Session comparison/diff view (explicitly excluded per user decision)
- Automated test scenarios or conversation starters
- Collaborative testing (multiple creators)
- Analytics/metrics on testing sessions
- Export testing sessions
- Version history for sessions
- Voice or multimodal testing

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session creation time | < 500ms | Backend response time |
| Message streaming latency | First token < 1s | Time to first SSE event |
| Comment persistence | 100% | Comments survive page refresh |
| Session resumption | Accurate | Active session restored on return |
| Navigation modal trigger | 100% | Modal shown when navigating away from active session |

## Technical Dependencies

### External Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| React | ^18.x | Frontend components |
| Tailwind CSS | ^3.x | Styling |
| Prisma | ^5.x | Database ORM |

### Internal Dependencies
| Component | Path | Purpose |
|-----------|------|---------|
| ChatInterface | `frontend/src/components/ChatInterface.tsx` | Base chat component to extend |
| ChatMessage | `frontend/src/components/ChatMessage.tsx` | Message rendering |
| ChatInput | `frontend/src/components/ChatInput.tsx` | Input component |
| Chat Controller | `backend/src/controllers/chat.controller.ts` | Streaming chat logic |
| Context Service | `backend/src/services/contextService.ts` | System prompt composition |

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TESTING DOJO ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│   ProjectPage      │────▶│   TestingDojo      │────▶│   DojoChat         │
│   (Test tab)       │     │   (container)      │     │   (chat panel)     │
└────────────────────┘     └────────────────────┘     └────────────────────┘
                                    │                          │
                                    ▼                          ▼
                           ┌────────────────────┐     ┌────────────────────┐
                           │   SessionManager   │     │   CommentSidebar   │
                           │   (dropdown)       │     │   (right panel)    │
                           └────────────────────┘     └────────────────────┘

Backend Flow:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ TestSession │────▶│ TestMessage │────▶│ TestComment │────▶│ Recommend   │
│ (container) │     │ (chat msg)  │     │ (feedback)  │     │ (Spec 3)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Database Schema

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

### TypeScript Type Definitions

#### New File: `frontend/src/types/testing.ts`

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

### Comment Templates

Aligned with the 5 profile sections:

```typescript
const COMMENT_TEMPLATES = [
  {
    id: 'identity',
    label: 'Identity/Role',
    icon: '👤',
    placeholder: 'The agent should present itself as...',
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: '💬',
    placeholder: 'The tone should be more/less...',
  },
  {
    id: 'content',
    label: 'Content',
    icon: '📋',
    placeholder: 'Should emphasize/de-emphasize...',
  },
  {
    id: 'engagement',
    label: 'Engagement',
    icon: '🎯',
    placeholder: 'Should ask about/probe deeper into...',
  },
  {
    id: 'framing',
    label: 'Framing',
    icon: '🖼️',
    placeholder: 'Should frame this as...',
  },
]
```

### Backend Implementation

#### New File: `backend/src/controllers/testSession.controller.ts`

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'
import { buildSystemPrompt } from '../services/contextService'
import { getOpenAI } from '../utils/openai'

/**
 * Get all test sessions for a project
 * GET /api/projects/:projectId/test-sessions
 */
export async function getTestSessions(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const sessions = await prisma.testSession.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
    },
  })

  // Get comment counts
  const sessionsWithCounts = await Promise.all(
    sessions.map(async (session) => {
      const commentCount = await prisma.testComment.count({
        where: {
          message: {
            sessionId: session.id,
          },
        },
      })

      return {
        id: session.id,
        name: session.name,
        status: session.status,
        messageCount: session._count.messages,
        commentCount,
        createdAt: session.createdAt,
        endedAt: session.endedAt,
      }
    })
  )

  res.json({ sessions: sessionsWithCounts })
}

/**
 * Create new test session
 * POST /api/projects/:projectId/test-sessions
 */
export async function createTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { name } = req.body

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Count existing sessions for default naming
  const sessionCount = await prisma.testSession.count({
    where: { projectId },
  })

  const session = await prisma.testSession.create({
    data: {
      projectId,
      name: name || `Session #${sessionCount + 1}`,
      status: 'active',
    },
  })

  res.json({ session })
}

/**
 * Get test session with messages and comments
 * GET /api/test-sessions/:sessionId
 */
export async function getTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { ownerId: true },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  res.json({
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        comments: m.comments,
      })),
    },
  })
}

/**
 * Update test session (name, status)
 * PATCH /api/test-sessions/:sessionId
 */
export async function updateTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params
  const { name, status } = req.body

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { ownerId: true },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (status !== undefined) {
    updateData.status = status
    if (status === 'ended') {
      updateData.endedAt = new Date()
    }
  }

  const updated = await prisma.testSession.update({
    where: { id: sessionId },
    data: updateData,
  })

  res.json({ session: updated })
}

/**
 * Delete test session
 * DELETE /api/test-sessions/:sessionId
 */
export async function deleteTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { ownerId: true },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  await prisma.testSession.delete({
    where: { id: sessionId },
  })

  res.json({ success: true })
}

/**
 * Send message in test session (with streaming)
 * POST /api/test-sessions/:sessionId/messages
 */
export async function sendTestMessage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params
  const { message } = req.body

  if (!message) {
    throw new ValidationError('Message is required')
  }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { id: true, ownerId: true },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  // Store user message
  const userMessage = await prisma.testMessage.create({
    data: {
      sessionId,
      role: 'user',
      content: message,
    },
  })

  // Get existing messages for context
  const existingMessages = await prisma.testMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  })

  // Build system prompt using same logic as real chat
  const systemPrompt = await buildSystemPrompt(session.project.id)

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Stream response from OpenAI
  const openai = getOpenAI()

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...existingMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  let fullResponse = ''

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: chatMessages,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        fullResponse += content
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`)
      }
    }

    // Store assistant message
    const assistantMessage = await prisma.testMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullResponse,
      },
    })

    res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id })}\n\n`)
    res.write('data: [DONE]\n\n')
  } catch (error) {
    console.error('Test chat error:', error)
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`)
  } finally {
    res.end()
  }
}

/**
 * Add comment to test message
 * POST /api/test-messages/:messageId/comments
 */
export async function addTestComment(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { messageId } = req.params
  const { content, templateId } = req.body

  if (!content) {
    throw new ValidationError('Content is required')
  }

  const message = await prisma.testMessage.findUnique({
    where: { id: messageId },
    include: {
      session: {
        include: {
          project: {
            select: { ownerId: true },
          },
        },
      },
    },
  })

  if (!message) {
    throw new NotFoundError('Test message')
  }

  if (message.session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test message')
  }

  const comment = await prisma.testComment.create({
    data: {
      messageId,
      content,
      templateId,
    },
  })

  res.json({ comment })
}

/**
 * Delete comment
 * DELETE /api/test-comments/:commentId
 */
export async function deleteTestComment(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { commentId } = req.params

  const comment = await prisma.testComment.findUnique({
    where: { id: commentId },
    include: {
      message: {
        include: {
          session: {
            include: {
              project: {
                select: { ownerId: true },
              },
            },
          },
        },
      },
    },
  })

  if (!comment) {
    throw new NotFoundError('Test comment')
  }

  if (comment.message.session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this comment')
  }

  await prisma.testComment.delete({
    where: { id: commentId },
  })

  res.json({ success: true })
}
```

#### New File: `backend/src/routes/testSession.routes.ts`

```typescript
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

#### Register Routes in Express App: `backend/src/index.ts`

```typescript
import testSessionRoutes from './routes/testSession.routes'

// ... existing route registrations ...

// Register test session routes
app.use('/api', testSessionRoutes)
```

### Frontend Implementation

#### Extended: `frontend/src/lib/api.ts`

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

#### New File: `frontend/src/components/TestingDojo/TestingDojo.tsx`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { SessionManager } from './SessionManager'
import { DojoChat } from './DojoChat'
import { CommentSidebar } from './CommentSidebar'
import { NavigationModal } from './NavigationModal'

interface TestingDojoProps {
  projectId: string
  onNavigateAway?: (destination: string) => void
}

export function TestingDojo({ projectId, onNavigateAway }: TestingDojoProps) {
  const [sessions, setSessions] = useState<TestSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<TestSessionWithMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [projectId])

  useEffect(() => {
    if (activeSessionId) {
      loadSession(activeSessionId)
    }
  }, [activeSessionId])

  // Handle browser navigation/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && activeSession?.status === 'active') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, activeSession])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const response = await api.getTestSessions(projectId)
      setSessions(response.sessions)

      // Auto-select active session or most recent
      const active = response.sessions.find((s) => s.status === 'active')
      if (active) {
        setActiveSessionId(active.id)
      } else if (response.sessions.length > 0) {
        setActiveSessionId(response.sessions[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    try {
      const response = await api.getTestSession(sessionId)
      setActiveSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    }
  }

  const handleCreateSession = async () => {
    try {
      const response = await api.createTestSession(projectId)
      setSessions([response.session, ...sessions])
      setActiveSessionId(response.session.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  const handleEndSession = async (applyFeedback: boolean) => {
    if (!activeSessionId) return

    try {
      await api.updateTestSession(activeSessionId, { status: 'ended' })

      // Refresh sessions list
      await loadSessions()

      if (applyFeedback) {
        // Navigate to recommendations (Spec 3)
        onNavigateAway?.('recommendations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session')
    }
  }

  const handleNavigationAttempt = (destination: string) => {
    if (activeSession?.status === 'active' && activeSession.messages.length > 0) {
      setPendingNavigation(destination)
      setShowNavigationModal(true)
    } else {
      onNavigateAway?.(destination)
    }
  }

  const handleNavigationConfirm = async (keepLive: boolean, applyFeedback: boolean) => {
    setShowNavigationModal(false)

    if (!keepLive) {
      await handleEndSession(applyFeedback)
    }

    if (pendingNavigation) {
      onNavigateAway?.(pendingNavigation)
    }
  }

  const handleNewMessage = (message: TestMessage) => {
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        messages: [...activeSession.messages, message],
      })
      setHasUnsavedChanges(true)
    }
  }

  const handleNewComment = (messageId: string, comment: TestComment) => {
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        messages: activeSession.messages.map((m) =>
          m.id === messageId
            ? { ...m, comments: [...m.comments, comment] }
            : m
        ),
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading Testing Dojo...</div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header with Session Manager */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Testing Dojo</h2>
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
            TEST MODE
          </span>
        </div>

        <SessionManager
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onCreateSession={handleCreateSession}
          onDeleteSession={async (id) => {
            await api.deleteTestSession(id)
            await loadSessions()
          }}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto">✕</button>
        </div>
      )}

      {/* Main Content */}
      {activeSession ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel (left) */}
          <div className="flex-1 flex flex-col">
            <DojoChat
              projectId={projectId}
              sessionId={activeSession.id}
              messages={activeSession.messages}
              onNewMessage={handleNewMessage}
              onAddComment={handleNewComment}
            />
          </div>

          {/* Comments Sidebar (right) */}
          <div className="w-80 border-l bg-gray-50 overflow-y-auto">
            <CommentSidebar
              messages={activeSession.messages}
              onScrollToMessage={(messageId) => {
                document.getElementById(`message-${messageId}`)?.scrollIntoView({
                  behavior: 'smooth',
                })
              }}
              onDeleteComment={async (commentId) => {
                await api.deleteTestComment(commentId)
                await loadSession(activeSession.id)
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No active test session</p>
            <button
              onClick={handleCreateSession}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}

      {/* End Session Button */}
      {activeSession?.status === 'active' && (
        <div className="px-4 py-3 border-t bg-white flex justify-end">
          <button
            onClick={() => setShowNavigationModal(true)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            End Session
          </button>
        </div>
      )}

      {/* Navigation Modal */}
      <NavigationModal
        isOpen={showNavigationModal}
        onClose={() => setShowNavigationModal(false)}
        onConfirm={handleNavigationConfirm}
        hasComments={activeSession?.messages.some((m) => m.comments.length > 0) || false}
      />
    </div>
  )
}
```

#### New File: `frontend/src/components/TestingDojo/DojoChat.tsx`

```typescript
import { useState, useRef, useEffect } from 'react'
import { ChatInput } from '../ChatInput'
import { CommentOverlay } from './CommentOverlay'

const API_URL = import.meta.env.VITE_API_URL || ''

interface DojoChatProps {
  projectId: string
  sessionId: string
  messages: TestMessage[]
  onNewMessage: (message: TestMessage) => void
  onAddComment: (messageId: string, comment: TestComment) => void
}

export function DojoChat({
  projectId,
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
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Add assistant message
      const assistantMessage: TestMessage = {
        id: assistantMessageId,
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Comment indicator */}
              {message.comments.length > 0 && (
                <div className="absolute -right-2 -top-2 bg-yellow-400 text-yellow-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {message.comments.length}
                </div>
              )}

              {/* Add comment button (assistant messages only) */}
              {message.role === 'assistant' && (
                <button
                  onClick={() => setCommentingMessageId(message.id)}
                  className="absolute -bottom-2 right-2 text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  + Add Comment
                </button>
              )}

              {/* Comment overlay */}
              {commentingMessageId === message.id && (
                <CommentOverlay
                  onSubmit={(content, templateId) => {
                    onAddComment(message.id, {
                      id: `temp-${Date.now()}`,
                      content,
                      templateId,
                      createdAt: new Date().toISOString(),
                    })
                    setCommentingMessageId(null)
                  }}
                  onCancel={() => setCommentingMessageId(null)}
                />
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-3">
              <div className="whitespace-pre-wrap">{streamingContent}</div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
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

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
    </div>
  )
}
```

#### New File: `frontend/src/components/TestingDojo/CommentOverlay.tsx`

```typescript
import { useState } from 'react'

const COMMENT_TEMPLATES = [
  { id: 'identity', label: 'Identity/Role', icon: '👤', placeholder: 'The agent should present itself as...' },
  { id: 'communication', label: 'Communication', icon: '💬', placeholder: 'The tone should be more/less...' },
  { id: 'content', label: 'Content', icon: '📋', placeholder: 'Should emphasize/de-emphasize...' },
  { id: 'engagement', label: 'Engagement', icon: '🎯', placeholder: 'Should ask about/probe deeper into...' },
  { id: 'framing', label: 'Framing', icon: '🖼️', placeholder: 'Should frame this as...' },
]

interface CommentOverlayProps {
  onSubmit: (content: string, templateId?: string) => void
  onCancel: () => void
}

export function CommentOverlay({ onSubmit, onCancel }: CommentOverlayProps) {
  const [content, setContent] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const handleTemplateClick = (template: typeof COMMENT_TEMPLATES[0]) => {
    setSelectedTemplate(template.id)
    if (!content) {
      setContent(template.placeholder)
    }
  }

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim(), selectedTemplate || undefined)
    }
  }

  return (
    <div className="absolute left-0 right-0 -bottom-48 z-10 bg-white border rounded-lg shadow-lg p-4">
      {/* Quick Templates */}
      <div className="flex flex-wrap gap-2 mb-3">
        {COMMENT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
              selectedTemplate === template.id
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {template.icon} {template.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add your feedback..."
        rows={3}
        className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Add Comment
        </button>
      </div>
    </div>
  )
}
```

#### New File: `frontend/src/components/TestingDojo/NavigationModal.tsx`

```typescript
interface NavigationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (keepLive: boolean, applyFeedback: boolean) => void
  hasComments: boolean
}

export function NavigationModal({
  isOpen,
  onClose,
  onConfirm,
  hasComments,
}: NavigationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-4">End Testing Session?</h3>

        <p className="text-gray-600 mb-6">
          {hasComments
            ? "You have comments in this session. Would you like to keep the session active or end it and apply your feedback to the AI profile?"
            : "Would you like to keep this session active for later, or end it now?"}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onConfirm(true, false)}
            className="w-full px-4 py-3 text-left border rounded-lg hover:bg-gray-50"
          >
            <div className="font-medium">Keep Session Live</div>
            <div className="text-sm text-gray-500">
              Return to the same spot next time you open Testing Dojo
            </div>
          </button>

          <button
            onClick={() => onConfirm(false, false)}
            className="w-full px-4 py-3 text-left border rounded-lg hover:bg-gray-50"
          >
            <div className="font-medium">End Session</div>
            <div className="text-sm text-gray-500">
              Save conversation history but mark session as complete
            </div>
          </button>

          {hasComments && (
            <button
              onClick={() => onConfirm(false, true)}
              className="w-full px-4 py-3 text-left border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <div className="font-medium text-blue-700">End & Apply Feedback</div>
              <div className="text-sm text-blue-600">
                Generate recommendations from your comments
              </div>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

#### New File: `frontend/src/components/TestingDojo/SessionManager.tsx`

```typescript
import { useState } from 'react'
import type { TestSessionSummary } from '../../types/testing'

interface SessionManagerProps {
  sessions: TestSessionSummary[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
}

export function SessionManager({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: SessionManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
      >
        <span className="text-sm font-medium">
          {activeSession?.name || 'Select Session'}
        </span>
        <span className="text-xs text-gray-500">
          {activeSession?.status === 'active' ? '● Active' : '○ Ended'}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-50">
          {/* New Session Button */}
          <div className="p-2 border-b">
            <button
              onClick={() => {
                onCreateSession()
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg text-left"
            >
              + New Session
            </button>
          </div>

          {/* Session List */}
          <div className="max-h-60 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No sessions yet
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                    session.id === activeSessionId ? 'bg-blue-50' : ''
                  }`}
                >
                  <div
                    onClick={() => {
                      onSelectSession(session.id)
                      setIsOpen(false)
                    }}
                    className="flex items-start justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {session.name || `Session #${sessions.indexOf(session) + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(session.createdAt)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {session.messageCount} messages · {session.commentCount} comments
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === 'active' && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      )}
                      {confirmDelete === session.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteSession(session.id)
                              setConfirmDelete(null)
                            }}
                            className="text-xs px-2 py-1 bg-red-500 text-white rounded"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDelete(null)
                            }}
                            className="text-xs px-2 py-1 bg-gray-300 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDelete(session.id)
                          }}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
```

#### New File: `frontend/src/components/TestingDojo/CommentSidebar.tsx`

```typescript
import type { TestMessage, TestComment } from '../../types/testing'

const TEMPLATE_LABELS: Record<string, { icon: string; label: string }> = {
  identity: { icon: '👤', label: 'Identity/Role' },
  communication: { icon: '💬', label: 'Communication' },
  content: { icon: '📋', label: 'Content' },
  engagement: { icon: '🎯', label: 'Engagement' },
  framing: { icon: '🖼️', label: 'Framing' },
}

interface CommentSidebarProps {
  messages: TestMessage[]
  onScrollToMessage: (messageId: string) => void
  onDeleteComment: (commentId: string) => void
}

export function CommentSidebar({
  messages,
  onScrollToMessage,
  onDeleteComment,
}: CommentSidebarProps) {
  // Get all comments grouped by message
  const messagesWithComments = messages.filter((m) => m.comments.length > 0)
  const totalComments = messagesWithComments.reduce(
    (sum, m) => sum + m.comments.length,
    0
  )

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white sticky top-0">
        <h3 className="font-semibold text-gray-900">Comments</h3>
        <p className="text-sm text-gray-500">
          {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
        </p>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4">
        {messagesWithComments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">💭</div>
            <p className="text-sm text-gray-500">
              No comments yet. Click on an AI response to add feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messagesWithComments.map((message) => (
              <div key={message.id} className="space-y-2">
                {/* Message Preview */}
                <button
                  onClick={() => onScrollToMessage(message.id)}
                  className="w-full text-left p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <div className="text-xs text-gray-500 mb-1">AI Response</div>
                  <div className="text-sm text-gray-700 line-clamp-2">
                    {message.content.substring(0, 100)}...
                  </div>
                </button>

                {/* Comments for this message */}
                <div className="ml-3 space-y-2">
                  {message.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-white border border-yellow-200 rounded-lg"
                    >
                      {/* Template Badge */}
                      {comment.templateId && TEMPLATE_LABELS[comment.templateId] && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <span>{TEMPLATE_LABELS[comment.templateId].icon}</span>
                          <span>{TEMPLATE_LABELS[comment.templateId].label}</span>
                        </div>
                      )}

                      {/* Comment Content */}
                      <p className="text-sm text-gray-800">{comment.content}</p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(comment.createdAt)}
                        </span>
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with summary */}
      {totalComments > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="text-xs text-gray-500">
            Feedback on {messagesWithComments.length} AI{' '}
            {messagesWithComments.length === 1 ? 'response' : 'responses'}
          </div>
        </div>
      )}
    </div>
  )
}
```

### Modified: `frontend/src/pages/ProjectPage.tsx`

Add Test tab:

```typescript
// Add to tab navigation
<button
  onClick={() => setActiveTab('test')}
  role="tab"
  aria-selected={activeTab === 'test'}
  className={`px-3 py-4 border-b-2 font-medium transition-colors ${
    activeTab === 'test'
      ? 'border-blue-600 text-blue-600'
      : 'border-transparent text-gray-500 hover:text-gray-700'
  }`}
>
  Test
</button>

// Add to tab content
<div role="tabpanel" hidden={activeTab !== 'test'}>
  {activeTab === 'test' && (
    <TestingDojo
      projectId={projectId!}
      onNavigateAway={(dest) => {
        if (dest === 'recommendations') {
          // Navigate to recommendations panel (Spec 3)
        }
      }}
    />
  )}
</div>
```

## User Experience

### Session Lifecycle Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Enter     │────▶│   Active    │────▶│   Ended     │
│   Dojo      │     │   Session   │     │   Session   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │
      │                    │                    │
      ▼                    ▼                    ▼
 Auto-create         Chat + Comment       Read-only
 or resume           Add feedback        history
```

### Navigation Modal Flow

```
User clicks away from Test tab
        │
        ▼
┌───────────────────────────────────────┐
│        Navigation Modal               │
│                                       │
│  [Keep Session Live]                  │
│  Return later to same state           │
│                                       │
│  [End Session]                        │
│  Save history, mark complete          │
│                                       │
│  [End & Apply Feedback] (if comments) │
│  Generate recommendations             │
│                                       │
│  [Cancel]                             │
└───────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests

```typescript
describe('TestSession Controller', () => {
  describe('createTestSession', () => {
    // Purpose: Verify session creation with auto-naming
    it('should create session with default name', async () => {
      const response = await controller.createTestSession(req, res)
      expect(response.session.name).toMatch(/Session #\d+/)
    })

    // Purpose: Verify ownership check
    it('should reject if user does not own project', async () => {
      // ... test authorization
    })
  })

  describe('sendTestMessage', () => {
    // Purpose: Verify streaming works
    it('should stream response and store messages', async () => {
      // ... test SSE streaming
    })
  })
})
```

### Integration Tests

```typescript
describe('Testing Dojo API', () => {
  // Purpose: Verify complete session flow
  it('should support full session lifecycle', async () => {
    // Create session
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/test-sessions`)
      .set('Authorization', `Bearer ${token}`)

    const sessionId = createRes.body.session.id

    // Send message
    const messageRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello' })

    // Add comment
    // ... verify comment creation

    // End session
    // ... verify status update
  })
})
```

### E2E Tests

```typescript
test('should allow testing and commenting', async ({ page }) => {
  // Navigate to Test tab
  await page.click('[data-testid="tab-test"]')

  // Send test message
  await page.fill('[data-testid="chat-input"]', 'What is the ROI?')
  await page.click('[data-testid="send-button"]')

  // Wait for response
  await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible()

  // Add comment
  await page.hover('[data-testid="assistant-message"]')
  await page.click('[data-testid="add-comment-button"]')
  await page.fill('[data-testid="comment-input"]', 'Too formal')
  await page.click('[data-testid="submit-comment"]')

  // Verify comment appears
  await expect(page.locator('text=Too formal')).toBeVisible()
})
```

## Performance Considerations

- **Streaming**: Use SSE for real-time response streaming
- **Session Loading**: Load messages lazily, paginate if >100 messages
- **Comment Counts**: Pre-aggregate in session list query
- **Caching**: Cache active session in React state

## Security Considerations

- All endpoints verify project ownership
- Test sessions isolated from production conversations
- Comments are creator-private, never exposed to viewers
- Rate limiting on message sending (same as production chat)

## Documentation

- Add Testing Dojo section to user guide
- Document comment templates and their purpose
- Document session management flow

## Implementation Phases

### Phase 1: Backend Infrastructure
- Database schema migration
- Session CRUD endpoints
- Message streaming endpoint
- Comment endpoints
- Unit and integration tests

### Phase 2: Frontend - Core Dojo
- TestingDojo container component
- DojoChat with streaming
- SessionManager dropdown
- Basic session lifecycle

### Phase 3: Frontend - Comments
- CommentOverlay with templates
- CommentSidebar
- Comment indicators on messages
- Delete comment functionality

### Phase 4: Navigation & Polish
- NavigationModal with 3 options
- Tab integration in ProjectPage
- Error states and loading states
- E2E tests

## Open Questions

1. **Resolved**: Session comparison → Explicitly excluded
2. **Resolved**: Comment templates → Yes, aligned with 5 profile sections
3. **Future**: How recommendations integrate → Covered in Spec 3

## References

- Ideation: `docs/ideation/ai-agent-testing-dojo-with-profile.md`
- Profile spec: `specs/feat-ai-agent-profile-synthesis.md`
- Chat controller: `backend/src/controllers/chat.controller.ts`
- Context service: `backend/src/services/contextService.ts`
