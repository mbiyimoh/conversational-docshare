# Task Breakdown: Analytics Enhancement + Viewer Experience + Unified Dashboard

**Generated:** 2025-12-04
**Source:** `specs/feat-analytics-viewer-experience-unified-dashboard.md`
**Ideation:** `docs/ideation/analytics-viewer-experience-unified-dashboard.md`

---

## Overview

This task breakdown covers implementing three interconnected features:
1. **Phase A: Analytics Completion** - Conversation detail views, AI summaries, CSV export
2. **Phase B: End-of-Session Experience** - Viewer account creation prompt, conversation saving
3. **Phase C: Unified Dashboard** - Support creator-only, viewer-only, and hybrid users

**Total Tasks:** 14 core tasks + 2 deprioritized tasks
**Estimated Parallel Opportunities:** Tasks within each phase can run in parallel where noted

---

## Phase A: Analytics Completion

### Task A.1: Backend - Conversation Detail Endpoint

**Description:** Create GET /api/conversations/:id endpoint returning full conversation with messages
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task A.2, A.3

**Technical Requirements:**
- Create new file `backend/src/controllers/conversation.controller.ts`
- Implement authorization: project owner OR savedByUser can view
- Include all messages ordered by createdAt ascending
- Include project info for context

**Implementation:**

```typescript
// File: backend/src/controllers/conversation.controller.ts

import { Request, Response } from 'express'
import { prisma } from '../lib/db'
import { NotFoundError, AuthorizationError } from '../lib/errors'

// GET /api/conversations/:id
// Returns full conversation with messages for detail view
export async function getConversationDetail(req: Request, res: Response) {
  const { id } = req.params

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      project: { select: { id: true, name: true, ownerId: true } },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation not found')
  }

  // Authorization: creator of project OR savedByUser
  if (req.user) {
    const isOwner = conversation.project.ownerId === req.user.userId
    const isSaver = conversation.savedByUserId === req.user.userId
    if (!isOwner && !isSaver) {
      throw new AuthorizationError('Not authorized to view this conversation')
    }
  }

  res.json({ conversation })
}
```

**Route Setup:**
```typescript
// Add to backend/src/routes/conversation.routes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import { getConversationDetail } from '../controllers/conversation.controller'

const router = Router()

router.get('/:id', authenticate, asyncHandler(getConversationDetail))

export default router
```

**Acceptance Criteria:**
- [ ] Endpoint returns conversation with all messages
- [ ] Messages ordered by createdAt ascending
- [ ] Project owner can access any conversation in their project
- [ ] User who saved conversation can access it
- [ ] Returns 404 for non-existent conversations
- [ ] Returns 403 for unauthorized access attempts
- [ ] Test: GET with valid project owner token returns full conversation
- [ ] Test: GET with savedByUser token returns conversation
- [ ] Test: GET with unrelated user token returns 403

---

### Task A.2: Backend - End Conversation Endpoint with AI Summary

**Description:** Create POST /api/conversations/:id/end to mark conversation ended and generate AI summary
**Size:** Large
**Priority:** High
**Dependencies:** Task A.3 (conversationAnalysis service)
**Can run parallel with:** Task A.1

**Technical Requirements:**
- Mark endedAt timestamp
- Calculate durationSeconds from startedAt to endedAt
- Generate AI summary only if 5+ messages (cost control)
- Update summary, sentiment, and topics fields
- Idempotent - if already ended, return existing data

**Implementation:**

```typescript
// Add to backend/src/controllers/conversation.controller.ts

import { generateConversationSummary } from '../services/conversationAnalysis'

// POST /api/conversations/:id/end
// Marks conversation ended and triggers summary generation
export async function endConversation(req: Request, res: Response) {
  const { id } = req.params

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: true },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation not found')
  }

  // Idempotent - if already ended, return existing data
  if (conversation.endedAt) {
    return res.json({ conversation, summary: conversation.summary })
  }

  const endedAt = new Date()
  const durationSeconds = Math.floor(
    (endedAt.getTime() - conversation.startedAt.getTime()) / 1000
  )

  // Generate summary only if 5+ messages (cost control)
  let summary = null
  let sentiment = null
  let topics: string[] = []

  if (conversation.messages.length >= 5) {
    const analysis = await generateConversationSummary(conversation.messages)
    summary = analysis.summary
    sentiment = analysis.sentiment
    topics = analysis.topics
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      endedAt,
      durationSeconds,
      summary,
      sentiment,
      topics,
    },
  })

  res.json({ conversation: updated, summary })
}
```

**Route Setup:**
```typescript
// Add to conversation.routes.ts
router.post('/:id/end', asyncHandler(endConversation))
```

**Acceptance Criteria:**
- [ ] Sets endedAt to current timestamp
- [ ] Calculates durationSeconds correctly
- [ ] Generates summary for conversations with 5+ messages
- [ ] Skips summary generation for conversations with <5 messages
- [ ] Updates sentiment field (positive/neutral/negative)
- [ ] Updates topics array with extracted topics
- [ ] Idempotent: calling twice returns same data without re-generating
- [ ] Test: End conversation with 6 messages generates summary
- [ ] Test: End conversation with 3 messages has null summary
- [ ] Test: End already-ended conversation returns existing data

---

### Task A.3: Backend - AI Summary Generation Service

**Description:** Create conversationAnalysis.ts service using Vercel AI SDK for structured summary generation
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task A.1, A.2

**Technical Requirements:**
- Use `generateObject` from Vercel AI SDK with Zod schema
- Use `gpt-4o-mini` for cost-effective summaries
- Return structured object with summary, topics, sentiment, actionItems
- Handle errors gracefully

**Implementation:**

```typescript
// File: backend/src/services/conversationAnalysis.ts

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const SummarySchema = z.object({
  summary: z.string().describe('2-3 sentence summary of the conversation'),
  topics: z.array(z.string()).describe('3-5 key topics as single words or short phrases'),
  sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall conversation sentiment'),
  actionItems: z.array(z.string()).optional().describe('Any action items mentioned'),
})

export type ConversationAnalysis = z.infer<typeof SummarySchema>

export async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>
): Promise<ConversationAnalysis> {
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'), // Cost-effective for summaries
    schema: SummarySchema,
    prompt: `Analyze this conversation and provide a structured analysis.

Focus on:
1. What the viewer was trying to learn or accomplish
2. Key topics discussed
3. Overall tone and sentiment of the exchange
4. Any follow-up actions mentioned

Conversation:
${transcript}`,
  })

  return object
}
```

**Acceptance Criteria:**
- [ ] Returns valid ConversationAnalysis object
- [ ] Summary is 2-3 sentences
- [ ] Topics array has 3-5 items
- [ ] Sentiment is one of: positive, neutral, negative
- [ ] ActionItems is optional array
- [ ] Uses gpt-4o-mini model
- [ ] Test: Valid messages array returns structured summary
- [ ] Test: Empty messages array doesn't throw (returns minimal response)

---

### Task A.4: Backend - CSV Export Endpoint

**Description:** Create endpoint to export project conversations as CSV
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task A.1
**Can run parallel with:** Task A.5, A.6

**Technical Requirements:**
- Export all conversations for a project
- Include: viewerEmail, messageCount, duration, sentiment, topics, startedAt, endedAt
- Return as downloadable CSV blob
- Only project owner can export

**Implementation:**

```typescript
// Add to backend/src/controllers/analytics.controller.ts

// GET /api/projects/:id/analytics/export
export async function exportConversationsCSV(req: Request, res: Response) {
  const { id: projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project || project.ownerId !== req.user?.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const conversations = await prisma.conversation.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      viewerEmail: true,
      viewerName: true,
      messageCount: true,
      durationSeconds: true,
      sentiment: true,
      topics: true,
      summary: true,
      startedAt: true,
      endedAt: true,
    },
  })

  // Build CSV
  const headers = [
    'ID',
    'Viewer Email',
    'Viewer Name',
    'Messages',
    'Duration (seconds)',
    'Sentiment',
    'Topics',
    'Summary',
    'Started At',
    'Ended At',
  ]

  const rows = conversations.map((c) => [
    c.id,
    c.viewerEmail || '',
    c.viewerName || '',
    c.messageCount.toString(),
    c.durationSeconds?.toString() || '',
    c.sentiment || '',
    c.topics.join('; '),
    (c.summary || '').replace(/"/g, '""'), // Escape quotes
    c.startedAt.toISOString(),
    c.endedAt?.toISOString() || '',
  ])

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${project.name}-conversations.csv"`
  )
  res.send(csv)
}
```

**Route Setup:**
```typescript
// Add to analytics.routes.ts
router.get('/:id/analytics/export', authenticate, asyncHandler(exportConversationsCSV))
```

**Acceptance Criteria:**
- [ ] Returns valid CSV file
- [ ] Includes all specified columns
- [ ] Handles special characters (quotes, commas) in data
- [ ] Filename includes project name
- [ ] Only accessible by project owner
- [ ] Test: Export project with conversations returns valid CSV
- [ ] Test: Export empty project returns headers only
- [ ] Test: Non-owner gets 403

---

### Task A.5: Frontend - API Client Extensions

**Description:** Add new API methods to frontend api.ts for conversation operations
**Size:** Small
**Priority:** High
**Dependencies:** Task A.1, A.2
**Can run parallel with:** Task A.4, A.6

**Implementation:**

```typescript
// Add to frontend/src/lib/api.ts

// Conversation endpoints
async getConversationDetail(conversationId: string) {
  return this.request<{
    conversation: {
      id: string
      projectId: string
      viewerEmail: string | null
      viewerName: string | null
      messageCount: number
      durationSeconds: number | null
      summary: string | null
      sentiment: string | null
      topics: string[]
      startedAt: string
      endedAt: string | null
      messages: Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        createdAt: string
      }>
      project: { id: string; name: string }
    }
  }>(`/api/conversations/${conversationId}`)
}

async endConversation(conversationId: string) {
  return this.request<{
    conversation: unknown
    summary: string | null
  }>(`/api/conversations/${conversationId}/end`, {
    method: 'POST',
  })
}

async exportConversationsCSV(projectId: string) {
  // Returns blob for download
  const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/analytics/export`, {
    headers: {
      Authorization: `Bearer ${this.token}`,
    },
  })
  if (!response.ok) {
    throw new Error('Export failed')
  }
  return response.blob()
}
```

**Acceptance Criteria:**
- [ ] getConversationDetail returns typed response
- [ ] endConversation sends POST request
- [ ] exportConversationsCSV returns blob
- [ ] All methods include authorization header
- [ ] Proper error handling for failed requests

---

### Task A.6: Frontend - ConversationDetailPanel Component

**Description:** Create slide-over panel component for viewing conversation details
**Size:** Large
**Priority:** High
**Dependencies:** Task A.5
**Can run parallel with:** Task A.4

**Implementation:**

```typescript
// File: frontend/src/components/ConversationDetailPanel.tsx

import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { ProfileSectionContent } from './ProfileSectionContent'

interface ConversationDetailPanelProps {
  conversationId: string
  onClose: () => void
}

export function ConversationDetailPanel({
  conversationId,
  onClose,
}: ConversationDetailPanelProps) {
  const [conversation, setConversation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadConversation()
  }, [conversationId])

  const loadConversation = async () => {
    try {
      setLoading(true)
      const { conversation } = await api.getConversationDetail(conversationId)
      setConversation(conversation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getSentimentColor = (sentiment: string | null) => {
    if (sentiment === 'positive') return 'text-green-600 bg-green-100'
    if (sentiment === 'negative') return 'text-red-600 bg-red-100'
    return 'text-gray-600 bg-gray-100'
  }

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50">
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 p-6">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <div className="mt-4 text-red-600">{error || 'Conversation not found'}</div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
              ← Back to Analytics
            </button>
            <h2 className="mt-1 text-lg font-semibold">Conversation Details</h2>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-4 border-b bg-gray-50 space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">Viewer:</span>
            <span className="font-medium">{conversation.viewerEmail || conversation.viewerName || 'Anonymous'}</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">Duration:</span>
            <span>{formatDuration(conversation.durationSeconds)}</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">Messages:</span>
            <span>{conversation.messageCount}</span>
          </div>

          {conversation.sentiment && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">Sentiment:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(conversation.sentiment)}`}>
                {conversation.sentiment}
              </span>
            </div>
          )}

          {conversation.topics?.length > 0 && (
            <div className="flex items-start gap-4 text-sm">
              <span className="text-gray-500">Topics:</span>
              <div className="flex flex-wrap gap-1">
                {conversation.topics.map((topic: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {conversation.summary && (
            <div className="mt-3 p-3 bg-white rounded-lg border">
              <p className="text-xs font-medium text-gray-500 mb-1">AI Summary</p>
              <p className="text-sm text-gray-700">{conversation.summary}</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.messages.map((message: any) => (
            <div
              key={message.id}
              className={`${
                message.role === 'user'
                  ? 'ml-8 bg-blue-50 rounded-lg p-3'
                  : 'mr-8 bg-gray-50 rounded-lg p-3'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {message.role === 'user' ? 'Viewer' : 'AI Agent'}
              </div>
              <ProfileSectionContent content={message.content} className="text-sm" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

**Acceptance Criteria:**
- [ ] Panel slides in from right side
- [ ] Backdrop closes panel on click
- [ ] Shows loading state while fetching
- [ ] Shows error state on failure
- [ ] Displays viewer info (email/name or Anonymous)
- [ ] Displays duration formatted as Xm Ys
- [ ] Displays message count
- [ ] Displays sentiment with color coding
- [ ] Displays topics as tags
- [ ] Displays AI summary if available
- [ ] Scrollable message list
- [ ] Messages styled differently for user vs assistant
- [ ] Uses ProfileSectionContent for message rendering

---

### Task A.7: Frontend - AnalyticsDashboard Integration

**Description:** Add click handlers to conversation table and CSV export button
**Size:** Medium
**Priority:** High
**Dependencies:** Task A.5, A.6
**Can run parallel with:** None (integrates previous tasks)

**Implementation Changes to AnalyticsDashboard.tsx:**

```typescript
// Add state for selected conversation
const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
const [exporting, setExporting] = useState(false)

// Add export handler
const handleExportCSV = async () => {
  try {
    setExporting(true)
    const blob = await api.exportConversationsCSV(projectId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversations-${projectId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Export failed:', err)
  } finally {
    setExporting(false)
  }
}

// In the conversations table, make rows clickable:
<tr
  key={conversation.id}
  onClick={() => setSelectedConversationId(conversation.id)}
  className="cursor-pointer hover:bg-gray-50"
>
  {/* existing cells */}
</tr>

// Add export button in header area:
<button
  onClick={handleExportCSV}
  disabled={exporting}
  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
>
  {exporting ? 'Exporting...' : 'Export CSV'}
</button>

// Add ConversationDetailPanel at end of component:
{selectedConversationId && (
  <ConversationDetailPanel
    conversationId={selectedConversationId}
    onClose={() => setSelectedConversationId(null)}
  />
)}
```

**Acceptance Criteria:**
- [ ] Clicking conversation row opens detail panel
- [ ] Export CSV button downloads file
- [ ] Export button shows loading state
- [ ] Panel closes when clicking backdrop or back button
- [ ] Cursor changes to pointer on hoverable rows
- [ ] Row highlights on hover

---

## Phase B: End-of-Session Experience

### Task B.1: Backend - Save Conversation Endpoint

**Description:** Create POST /api/conversations/:id/save to link conversation to authenticated user
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task B.2

**Implementation:**

```typescript
// Add to backend/src/controllers/conversation.controller.ts

import { BadRequestError } from '../lib/errors'

// POST /api/conversations/:id/save
// Links conversation to authenticated user
export async function saveConversation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError('Must be logged in to save conversations')
  }

  const { id } = req.params

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation not found')
  }

  if (conversation.savedByUserId) {
    throw new BadRequestError('Conversation already saved')
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { savedByUserId: req.user.userId },
  })

  res.json({ savedConversation: updated })
}
```

**Route Setup:**
```typescript
// Add to conversation.routes.ts
router.post('/:id/save', authenticate, asyncHandler(saveConversation))
```

**Acceptance Criteria:**
- [ ] Requires authentication
- [ ] Links conversation to current user
- [ ] Returns 400 if already saved
- [ ] Returns 404 if conversation not found
- [ ] Test: Save with valid token succeeds
- [ ] Test: Save without token returns 401
- [ ] Test: Save already-saved conversation returns 400

---

### Task B.2: Backend - User Saved Conversations Endpoints

**Description:** Create endpoints for fetching user's saved conversations and unified dashboard data
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task B.1

**Implementation:**

```typescript
// Add to backend/src/controllers/user.controller.ts (or create new file)

// GET /api/users/me/saved-conversations
export async function getSavedConversations(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError('Not authenticated')
  }

  const conversations = await prisma.conversation.findMany({
    where: { savedByUserId: req.user.userId },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  res.json({ conversations, total: conversations.length })
}

// GET /api/users/me/dashboard
export async function getDashboardData(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError('Not authenticated')
  }

  const [projects, savedConversations] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: req.user.userId },
      include: {
        _count: { select: { documents: true, conversations: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.conversation.findMany({
      where: { savedByUserId: req.user.userId },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10, // Limit to recent 10
    }),
  ])

  res.json({
    projects,
    savedConversations,
    stats: {
      projectCount: projects.length,
      savedConversationCount: savedConversations.length,
    },
  })
}
```

**Route Setup:**
```typescript
// Add to user.routes.ts or create new file
router.get('/me/saved-conversations', authenticate, asyncHandler(getSavedConversations))
router.get('/me/dashboard', authenticate, asyncHandler(getDashboardData))
```

**Acceptance Criteria:**
- [ ] Saved conversations returns all user's saved threads
- [ ] Dashboard data returns projects AND saved conversations
- [ ] Dashboard limits saved conversations to 10
- [ ] Both endpoints require authentication
- [ ] Includes project name for context
- [ ] Test: User with saved conversations sees them
- [ ] Test: User with no saved conversations gets empty array

---

### Task B.3: Frontend - API Client for User Endpoints

**Description:** Add API methods for saving conversations and fetching dashboard data
**Size:** Small
**Priority:** High
**Dependencies:** Task B.1, B.2
**Can run parallel with:** Task B.4

**Implementation:**

```typescript
// Add to frontend/src/lib/api.ts

async saveConversation(conversationId: string) {
  return this.request<{
    savedConversation: unknown
  }>(`/api/conversations/${conversationId}/save`, {
    method: 'POST',
  })
}

async getSavedConversations() {
  return this.request<{
    conversations: Array<{
      id: string
      projectId: string
      messageCount: number
      startedAt: string
      endedAt: string | null
      project: { id: string; name: string }
    }>
    total: number
  }>('/api/users/me/saved-conversations')
}

async getDashboardData() {
  return this.request<{
    projects: unknown[]
    savedConversations: Array<{
      id: string
      messageCount: number
      startedAt: string
      endedAt: string | null
      project: { id: string; name: string }
    }>
    stats: {
      projectCount: number
      savedConversationCount: number
    }
  }>('/api/users/me/dashboard')
}
```

**Acceptance Criteria:**
- [ ] saveConversation sends POST request
- [ ] getSavedConversations returns typed array
- [ ] getDashboardData returns unified structure
- [ ] All methods include auth header

---

### Task B.4: Frontend - EndSessionModal Component

**Description:** Create modal component for end-of-session flow with registration option
**Size:** Large
**Priority:** High
**Dependencies:** Task B.3
**Can run parallel with:** Task B.3

**Implementation:**

```typescript
// File: frontend/src/components/EndSessionModal.tsx

import { useState } from 'react'
import { api } from '../lib/api'

interface EndSessionModalProps {
  conversationId: string
  messageCount: number
  startedAt: string
  projectName: string
  onClose: () => void
  onEnded: () => void
}

export function EndSessionModal({
  conversationId,
  messageCount,
  startedAt,
  projectName,
  onClose,
  onEnded,
}: EndSessionModalProps) {
  const [mode, setMode] = useState<'confirm' | 'register' | 'success'>('confirm')
  const [ending, setEnding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Registration form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const duration = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60

  const handleJustEnd = async () => {
    try {
      setEnding(true)
      await api.endConversation(conversationId)
      onEnded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end conversation')
    } finally {
      setEnding(false)
    }
  }

  const handleSaveAndRegister = async () => {
    if (!email || !password) {
      setError('Email and password are required')
      return
    }

    try {
      setSaving(true)
      setError('')

      // 1. End the conversation first
      await api.endConversation(conversationId)

      // 2. Register the user
      const { token } = await api.register(email, password, name || undefined)
      api.setToken(token)

      // 3. Save the conversation to the new user
      await api.saveConversation(conversationId)

      setMode('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {mode === 'confirm' && (
          <>
            <h2 className="text-xl font-semibold text-gray-900">
              End Conversation?
            </h2>
            <p className="mt-2 text-gray-600">
              Thanks for chatting about <strong>{projectName}</strong>
            </p>

            {/* Quick stats */}
            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span>{messageCount} messages</span>
              <span>{minutes}m {seconds}s</span>
            </div>

            {/* Value proposition */}
            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <strong>Save this conversation?</strong> Create a free account to
                save your chat history and continue this conversation later.
              </p>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600">{error}</div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => setMode('register')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Save & Create Account
              </button>
              <button
                onClick={handleJustEnd}
                disabled={ending}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {ending ? 'Ending...' : 'Just End'}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <h2 className="text-xl font-semibold text-gray-900">
              Create Your Account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Save this conversation and continue later
            </p>

            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveAndRegister() }}>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 8 characters"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600">{error}</div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating Account...' : 'Create Account & Save'}
              </button>

              <button
                type="button"
                onClick={() => setMode('confirm')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Back
              </button>
            </form>
          </>
        )}

        {mode === 'success' && (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                Conversation Saved!
              </h2>
              <p className="mt-2 text-gray-600">
                Your account has been created and this conversation has been saved.
              </p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Shows confirm mode initially with stats
- [ ] Transitions to register mode on "Save & Create Account"
- [ ] Registration form has name, email, password fields
- [ ] Validates required fields before submit
- [ ] Ends conversation, registers, and saves in sequence
- [ ] Shows success mode after successful registration
- [ ] "Go to Dashboard" navigates to /dashboard
- [ ] "Just End" ends without registration
- [ ] Cancel closes modal without action
- [ ] Shows error messages appropriately
- [ ] Loading states on buttons during async operations

---

### Task B.5: Frontend - SharePage End Button Integration

**Description:** Add End Conversation button and modal to SharePage
**Size:** Medium
**Priority:** High
**Dependencies:** Task B.4
**Can run parallel with:** None

**Implementation Changes to SharePage.tsx:**

```typescript
// Add imports
import { EndSessionModal } from '../components/EndSessionModal'

// Add state
const [showEndModal, setShowEndModal] = useState(false)
const [conversationStartedAt, setConversationStartedAt] = useState<string>('')

// Track conversation start time when created
// In the createConversationAndGrant function, after setting conversationId:
setConversationStartedAt(new Date().toISOString())

// Add beforeunload handler (BACKUP MECHANISM ONLY - unreliable across browsers)
// Primary mechanism is the explicit "End Conversation" button in header
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (conversationId && accessGranted) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [conversationId, accessGranted])

// In header area (after project name), add button:
{accessGranted && conversationId && (
  <button
    onClick={() => setShowEndModal(true)}
    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100"
    data-testid="end-conversation-button"
  >
    End Conversation
  </button>
)}

// At end of component, add modal:
{showEndModal && conversationId && (
  <EndSessionModal
    conversationId={conversationId}
    messageCount={messages.length}
    startedAt={conversationStartedAt}
    projectName={shareLink?.project?.name || 'this project'}
    onClose={() => setShowEndModal(false)}
    onEnded={() => {
      setShowEndModal(false)
      // Optionally show thank you message or redirect
    }}
  />
)}
```

**Acceptance Criteria:**
- [ ] End Conversation button visible in header when chat is active
- [ ] Button only shows after conversation created
- [ ] Clicking button opens EndSessionModal
- [ ] Modal receives correct props (conversationId, messageCount, startedAt, projectName)
- [ ] beforeunload shows browser warning when leaving
- [ ] Modal closes on cancel
- [ ] Test: Click end button opens modal
- [ ] Test: Complete registration flow works

---

## Phase C: Unified Dashboard

### Task C.1: Frontend - SavedThreadsSection Component

**Description:** Create component to display user's saved conversation threads
**Size:** Medium
**Priority:** High
**Dependencies:** Task B.3
**Can run parallel with:** Task C.2

**Implementation:**

```typescript
// File: frontend/src/components/SavedThreadsSection.tsx

import { useNavigate } from 'react-router-dom'

interface SavedThread {
  id: string
  messageCount: number
  startedAt: string
  endedAt: string | null
  project: { id: string; name: string }
}

interface SavedThreadsSectionProps {
  threads: SavedThread[]
}

export function SavedThreadsSection({ threads }: SavedThreadsSectionProps) {
  const navigate = useNavigate()

  if (threads.length === 0) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Conversations</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="saved-threads-section">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => navigate(`/threads/${thread.id}`)}
            className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="font-medium text-gray-900 truncate">
              {thread.project.name}
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
              <span>{thread.messageCount} messages</span>
              <span>•</span>
              <span>{formatDate(thread.startedAt)}</span>
            </div>
            <div className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                thread.endedAt
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-green-100 text-green-700'
              }`}>
                {thread.endedAt ? 'Ended' : 'Active'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Returns null if no threads
- [ ] Displays project name for each thread
- [ ] Shows message count and date
- [ ] Shows status badge (Active/Ended)
- [ ] Click navigates to /threads/:id
- [ ] Responsive grid layout
- [ ] Hover effects on cards

---

### Task C.2: Frontend - DashboardPage Refactor

**Description:** Refactor DashboardPage to fetch unified data and show both saved threads and projects
**Size:** Medium
**Priority:** High
**Dependencies:** Task B.3, C.1
**Can run parallel with:** Task C.1

**Implementation Changes to DashboardPage.tsx:**

```typescript
// Update imports
import { SavedThreadsSection } from '../components/SavedThreadsSection'

// Update state type
interface DashboardData {
  projects: Project[]
  savedConversations: Array<{
    id: string
    messageCount: number
    startedAt: string
    endedAt: string | null
    project: { id: string; name: string }
  }>
  stats: { projectCount: number; savedConversationCount: number }
}

const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

// Update load function
const loadDashboard = async () => {
  try {
    setLoading(true)
    const data = await api.getDashboardData()
    setDashboardData(data)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load dashboard')
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadDashboard()
}, [])

// Update render
return (
  <div className="min-h-screen bg-gray-50">
    {/* Header with logout and new project buttons */}
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            New Project
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-800"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 py-8">
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {dashboardData && (
        <>
          {/* Saved Threads Section - only if user has saved conversations */}
          {dashboardData.savedConversations.length > 0 && (
            <SavedThreadsSection threads={dashboardData.savedConversations} />
          )}

          {/* Projects Section - always shown */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Projects</h2>
            {dashboardData.projects.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
                <p className="mt-2 text-gray-600">
                  Share your documents with AI-powered conversations.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create your first project
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dashboardData.projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>

    {/* Create Project Modal */}
    {showCreateModal && (
      <CreateProjectModal
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          loadDashboard()
        }}
      />
    )}
  </div>
)
```

**Acceptance Criteria:**
- [ ] Fetches unified dashboard data on mount
- [ ] Shows SavedThreadsSection if user has saved conversations
- [ ] Always shows Projects section
- [ ] Empty state CTA for users with no projects
- [ ] Creator-only users see only projects
- [ ] Viewer-only users see saved threads + empty projects with CTA
- [ ] Hybrid users see both sections
- [ ] Loading and error states handled

---

### Task C.3: Frontend - SavedThreadPage Route

**Description:** Create page for viewing and continuing saved conversation threads
**Size:** Large
**Priority:** High
**Dependencies:** Task B.3, A.5
**Can run parallel with:** None

**Implementation:**

```typescript
// File: frontend/src/pages/SavedThreadPage.tsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { ProfileSectionContent } from '../components/ProfileSectionContent'

export function SavedThreadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (id) loadConversation()
  }, [id])

  const loadConversation = async () => {
    try {
      setLoading(true)
      const { conversation } = await api.getConversationDetail(id!)
      setConversation(conversation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return

    try {
      setSending(true)
      // This would need a new endpoint to continue conversations
      // For MVP, we can show the conversation read-only
      // await api.sendMessage(id, newMessage)
      // setNewMessage('')
      // await loadConversation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading conversation...</div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <div className="text-red-600">{error || 'Conversation not found'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-700 text-sm mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-semibold">{conversation.project.name}</h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>{conversation.messageCount} messages</span>
            {conversation.endedAt && <span>• Ended</span>}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          {conversation.messages.map((message: any) => (
            <div
              key={message.id}
              className={`${
                message.role === 'user'
                  ? 'ml-12 bg-blue-50 rounded-lg p-4'
                  : 'mr-12 bg-gray-50 rounded-lg p-4'
              }`}
            >
              <div className="text-xs text-gray-500 mb-2">
                {message.role === 'user' ? 'You' : 'AI Agent'}
              </div>
              <ProfileSectionContent content={message.content} />
            </div>
          ))}
        </div>

        {/* Continue Chat (if conversation not ended) */}
        {!conversation.endedAt && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Continue the conversation..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
```

**Router Setup:**
```typescript
// Add to App.tsx routes
import { SavedThreadPage } from './pages/SavedThreadPage'

// In router:
<Route path="/threads/:id" element={<SavedThreadPage />} />
```

**Acceptance Criteria:**
- [ ] Route /threads/:id loads conversation
- [ ] Shows project name in header
- [ ] Displays all messages
- [ ] Back to Dashboard link works
- [ ] Loading and error states handled
- [ ] Shows continue input if conversation not ended
- [ ] Note: Full continuation requires additional backend work

---

## Deprioritized Tasks (Implement Last If Time Permits)

### Task D.1: Backend - Citation Statistics Endpoint

**Description:** Create endpoint for document/section citation statistics
**Size:** Medium
**Priority:** Low (deprioritized)
**Dependencies:** Task A.1
**Note:** Low usage feature - implement last in Phase A if time permits

**Implementation:**

```typescript
// Add to backend/src/controllers/analytics.controller.ts

// GET /api/projects/:id/analytics/citations
export async function getCitationStats(req: Request, res: Response) {
  const { id: projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project || project.ownerId !== req.user?.userId) {
    throw new AuthorizationError('Not authorized')
  }

  // Get all messages with citations for this project
  const messages = await prisma.message.findMany({
    where: {
      conversation: { projectId },
      role: 'assistant',
      content: { contains: '[DOC:' },
    },
    select: { content: true },
  })

  // Parse citations from messages
  const citationRegex = /\[DOC:([^\]:]+)(?::([^\]]+))?\]/g
  const documentCounts: Record<string, number> = {}
  const sectionCounts: Record<string, number> = {}

  for (const msg of messages) {
    let match
    while ((match = citationRegex.exec(msg.content)) !== null) {
      const [, filename, sectionId] = match
      documentCounts[filename] = (documentCounts[filename] || 0) + 1
      if (sectionId) {
        const key = `${filename}:${sectionId}`
        sectionCounts[key] = (sectionCounts[key] || 0) + 1
      }
    }
  }

  // Sort and take top 10
  const topDocuments = Object.entries(documentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([filename, count]) => ({ filename, count }))

  const topSections = Object.entries(sectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const [filename, sectionId] = key.split(':')
      return { filename, sectionId, count }
    })

  res.json({ topDocuments, topSections })
}
```

**Acceptance Criteria:**
- [ ] Returns top 10 cited documents
- [ ] Returns top 10 cited sections
- [ ] Parses [DOC:filename:section] format correctly
- [ ] Only accessible by project owner

---

### Task D.2: Frontend - CitationStats Component

**Description:** Display citation statistics in analytics dashboard
**Size:** Small
**Priority:** Low (deprioritized)
**Dependencies:** Task D.1
**Note:** Implement only if D.1 completed

---

## Database Index

### Task DB.1: Add savedByUserId Index

**Description:** Add index to optimize saved conversations queries
**Size:** Small
**Priority:** Medium
**Dependencies:** None

**Implementation:**

```prisma
// Add to backend/prisma/schema.prisma in Conversation model

model Conversation {
  // ... existing fields ...

  @@index([savedByUserId])  // Add this line
}
```

**Commands:**
```bash
cd backend && npm run db:push
```

**Acceptance Criteria:**
- [ ] Index created on savedByUserId
- [ ] Queries for saved conversations are fast

---

## Dependency Graph

```
Phase A (Analytics):
A.1 (GET conversation) ─┬─► A.5 (API client) ─► A.6 (Detail panel) ─► A.7 (Dashboard integration)
A.3 (AI service) ───────┤
A.2 (End endpoint) ─────┘
A.4 (CSV export) ───────────────────────────────────────────────────► A.7

Phase B (End Session):
B.1 (Save endpoint) ─┬─► B.3 (API client) ─► B.4 (EndSessionModal) ─► B.5 (SharePage integration)
B.2 (User endpoints) ┘

Phase C (Unified Dashboard):
B.3 ─► C.1 (SavedThreadsSection) ─┬─► C.2 (DashboardPage refactor)
A.5 ─────────────────────────────► C.3 (SavedThreadPage)

Deprioritized:
D.1 (Citation stats) ─► D.2 (CitationStats component)

Database:
DB.1 (Index) - Can be done anytime
```

---

## Execution Strategy

### Recommended Order:

**Sprint 1: Foundation (can be parallel)**
- DB.1: Add index
- A.1 + A.3: Backend conversation detail + AI service
- A.2: End conversation endpoint

**Sprint 2: Analytics Frontend**
- A.5: API client extensions
- A.6: ConversationDetailPanel
- A.4: CSV export
- A.7: AnalyticsDashboard integration

**Sprint 3: End Session Experience**
- B.1 + B.2: Backend user endpoints
- B.3: API client for user endpoints
- B.4: EndSessionModal
- B.5: SharePage integration

**Sprint 4: Unified Dashboard**
- C.1: SavedThreadsSection
- C.2: DashboardPage refactor
- C.3: SavedThreadPage route

**Optional (if time permits):**
- D.1 + D.2: Citation statistics

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| A: Analytics | 7 tasks | High |
| B: End Session | 5 tasks | High |
| C: Dashboard | 3 tasks | High |
| D: Deprioritized | 2 tasks | Low |
| DB: Index | 1 task | Medium |

**Total: 18 tasks** (14 core + 2 deprioritized + 1 DB + 1 integration)

**Parallel Opportunities:**
- A.1, A.2, A.3 can run in parallel
- B.1, B.2 can run in parallel
- C.1, C.2 can run in parallel (once dependencies met)
