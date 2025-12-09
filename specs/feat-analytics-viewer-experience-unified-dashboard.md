# Analytics Enhancement + Viewer Experience + Unified Dashboard

## Status: Draft
## Authors: Claude Code
## Date: 2025-12-04
## Related:
- Ideation: `docs/ideation/analytics-viewer-experience-unified-dashboard.md`
- Task files: `.simple-task-master/tasks/14-task-114-basic-analytics.md`, `16-task-21-enhanced-analytics-dashboard.md`

---

## 1. Overview

This specification covers three interconnected features that complete the analytics system and enable viewer-to-creator conversion:

1. **Analytics Completion** - Finish Phase 1/2 analytics with conversation detail views, AI-generated summaries, sentiment analysis, and CSV export
2. **Viewer End-of-Session Experience** - Implement an end-conversation flow that prompts viewers to create accounts and save their conversation threads
3. **Unified Dashboard** - Refactor the dashboard to gracefully handle three user journeys: creator-only, viewer-only, and hybrid users

These features work together to close the loop on viewer engagement and encourage platform adoption.

---

## 2. Background/Problem Statement

### Current State

The analytics system is partially implemented:
- `AnalyticsDashboard.tsx` displays overview cards and a conversations table
- `analytics.controller.ts` provides aggregate statistics and recent conversations
- Conversation model has `summary`, `sentiment`, `topics` fields but they're never populated
- Conversations never explicitly end - they remain open indefinitely

The viewer experience has gaps:
- No mechanism for viewers to end conversations
- No prompt to save conversations or create accounts
- Viewers who create accounts see only the creator dashboard (projects)

### Problems This Solves

1. **Creator Visibility Gap**: Creators can't see detailed conversation insights (full transcripts, topics, sentiment)
2. **Lost Conversion Opportunity**: Viewers leave without any prompt to create accounts or save their work
3. **Dashboard Confusion**: Users who started as viewers see an empty "My Projects" page with no indication of their saved conversations
4. **Data Incompleteness**: Duration tracking is broken because conversations never end; AI insights are never generated

### Business Value

- **Viewer → Account conversion**: Estimated 15%+ of viewers will create accounts when prompted at session end
- **Retention**: Users with saved conversations are more likely to return
- **Creator insights**: AI summaries save creators time reviewing conversations

---

## 3. Goals

- [ ] Enable creators to view full conversation transcripts with AI-generated summaries
- [ ] Generate sentiment analysis and topic extraction for conversations with 5+ messages
- [ ] Provide CSV export of conversation data for offline analysis
- [ ] Add "End Conversation" button to viewer experience (always visible in header)
- [ ] Prompt viewers to save conversations via account creation at session end
- [ ] Allow viewers to continue saved conversations after returning
- [ ] Create unified dashboard showing both saved threads and projects
- [ ] Support three user journeys: creator-only, viewer-only, hybrid

---

## 4. Non-Goals

- [ ] PDF export (deferred - CSV sufficient for MVP, export is rare use case)
- [ ] Real-time dashboard updates via WebSocket/SSE
- [ ] Email notifications for conversation summaries
- [ ] Conversation sharing between users
- [ ] Mobile-specific UI optimizations
- [ ] Phase 4 advanced analytics (heat maps, cohort analysis, A/B testing)
- [ ] Magic link authentication (full registration form preferred for consistency)
- [ ] Full-page conversation detail route (slide-over panel maintains context better)

---

## 5. Technical Dependencies

### External Libraries (Already Installed)

| Library | Version | Purpose |
|---------|---------|---------|
| `@ai-sdk/openai` | ^1.0.0 | LLM calls for summary generation |
| `openai` | ^4.x | Backup for direct API calls |
| `prisma` | ^5.x | Database operations |
| `react` | ^18.x | Frontend framework |
| `tailwindcss` | ^3.x | Styling |

### Internal Dependencies

- `backend/src/services/chatService.ts` - Extend with summary generation
- `backend/src/controllers/analytics.controller.ts` - Add conversation detail endpoint
- `frontend/src/lib/api.ts` - Add new API methods
- `backend/prisma/schema.prisma` - No changes needed (fields exist)

### Database Schema (Verified - No Changes Required)

The `Conversation` model already has all required fields:

```prisma
model Conversation {
  // ... existing fields ...

  // These fields exist but are unpopulated - will be used:
  summary       String?   @db.Text
  sentiment     String?   // positive, neutral, negative
  topics        String[]  // Extracted topics
  endedAt       DateTime?
  durationSeconds Int?
  savedByUserId String?
  savedBy       User?     @relation("SavedConversations", ...)
}
```

**Recommended Index** (add to schema.prisma):
```prisma
@@index([savedByUserId])  // For efficient saved conversations query
```

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VIEWER JOURNEY (Phase B)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SharePage ──► ChatInterface ──► [End Button] ──► EndSessionModal       │
│       │                               │                  │               │
│       │                               │          ┌───────┴───────┐       │
│       │                               │          │               │       │
│       │                               ▼          ▼               ▼       │
│       │                        POST /end    [Just End]    [Save & Register]
│       │                               │          │               │       │
│       │                               │          │          RegisterForm │
│       │                               ▼          │               │       │
│       │                    Generate Summary      │          POST /save   │
│       │                    (if 5+ messages)      │               │       │
│       │                               │          │               ▼       │
│       │                               ▼          │        Link to User   │
│       │                        Close Session     │               │       │
│       │                               │          ▼               ▼       │
│       │                               └──────► Thank You ◄───────┘       │
│       │                                           │                      │
│       │                                           ▼                      │
│       └────────────────────────────────────► Dashboard                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       ANALYTICS JOURNEY (Phase A)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ProjectPage ──► Analytics Tab ──► AnalyticsDashboard                   │
│                                           │                              │
│                       ┌───────────────────┼───────────────────┐         │
│                       │                   │                   │          │
│                       ▼                   ▼                   ▼          │
│                 OverviewCards      ConversationsTable    CitationStats   │
│                       │                   │                   │          │
│                       │           [Click Row]                 │          │
│                       │                   │                   │          │
│                       │                   ▼                   │          │
│                       │      ConversationDetailPanel          │          │
│                       │        (Slide-over)                   │          │
│                       │           │                           │          │
│                       │     ┌─────┴─────┐                     │          │
│                       │     │           │                     │          │
│                       │     ▼           ▼                     │          │
│                       │  Messages   Metadata                  │          │
│                       │     │        (summary,                │          │
│                       │     │        sentiment,               │          │
│                       │     │        topics)                  │          │
│                       │     │                                 │          │
│                       └─────┼─────────────────────────────────┘          │
│                             ▼                                            │
│                       [Export CSV]                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED DASHBOARD (Phase C)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GET /api/users/me/dashboard                                            │
│            │                                                             │
│            ▼                                                             │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  DashboardPage                                          │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────────┐ │            │
│  │  │ SavedThreadsSection (if savedConversations.length) │ │            │
│  │  │   ├── SavedThreadCard                              │ │            │
│  │  │   ├── SavedThreadCard                              │ │            │
│  │  │   └── ...                                          │ │            │
│  │  └────────────────────────────────────────────────────┘ │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────────┐ │            │
│  │  │ ProjectsSection (always shown)                      │ │            │
│  │  │   ├── ProjectCard / EmptyState with CTA            │ │            │
│  │  │   └── ...                                          │ │            │
│  │  └────────────────────────────────────────────────────┘ │            │
│  │                                                          │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                          │
│  Click SavedThreadCard ──► /threads/:conversationId                     │
│                                    │                                     │
│                                    ▼                                     │
│                            SavedThreadPage                               │
│                             ├── MessageList                              │
│                             ├── ContinueChat                             │
│                             └── BackToDashboard                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Backend Implementation

#### 6.2.1 New API Endpoints

**File: `backend/src/controllers/conversation.controller.ts`** (new file)

```typescript
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

  if (conversation.endedAt) {
    return res.json({ conversation, summary: conversation.summary })
  }

  const endedAt = new Date()
  const durationSeconds = Math.floor(
    (endedAt.getTime() - conversation.startedAt.getTime()) / 1000
  )

  // Generate summary only if 5+ messages
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

**File: `backend/src/controllers/user.controller.ts`** (add methods)

```typescript
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

#### 6.2.2 AI Summary Generation Service

**File: `backend/src/services/conversationAnalysis.ts`** (new file)

```typescript
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

#### 6.2.3 Citation Statistics Endpoint

**File: `backend/src/controllers/analytics.controller.ts`** (add method)

```typescript
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

### 6.3 Frontend Implementation

#### 6.3.1 API Client Extensions

**File: `frontend/src/lib/api.ts`** (add methods)

```typescript
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

async saveConversation(conversationId: string) {
  return this.request<{
    savedConversation: unknown
  }>(`/api/conversations/${conversationId}/save`, {
    method: 'POST',
  })
}

// User endpoints
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
      project: { id: string; name: string }
    }>
    stats: {
      projectCount: number
      savedConversationCount: number
    }
  }>('/api/users/me/dashboard')
}

// Analytics
async getCitationStats(projectId: string) {
  return this.request<{
    topDocuments: Array<{ filename: string; count: number }>
    topSections: Array<{ filename: string; sectionId: string; count: number }>
  }>(`/api/projects/${projectId}/analytics/citations`)
}

async exportConversationsCSV(projectId: string) {
  // Returns blob for download
  const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/analytics/export`, {
    headers: {
      Authorization: `Bearer ${this.token}`,
    },
  })
  return response.blob()
}
```

#### 6.3.2 EndSessionModal Component

**File: `frontend/src/components/EndSessionModal.tsx`** (new file)

```typescript
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

#### 6.3.3 ConversationDetailPanel Component

**File: `frontend/src/components/ConversationDetailPanel.tsx`** (new file)

```typescript
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

#### 6.3.4 SavedThreadsSection Component

**File: `frontend/src/components/SavedThreadsSection.tsx`** (new file)

```typescript
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

#### 6.3.5 DashboardPage Refactor

**File: `frontend/src/pages/DashboardPage.tsx`** (modify)

Key changes:
1. Fetch unified dashboard data via `api.getDashboardData()`
2. Render `SavedThreadsSection` if user has saved conversations
3. Keep `ProjectsSection` with empty state CTA

```typescript
// Key structural changes to DashboardPage.tsx:

const [dashboardData, setDashboardData] = useState<{
  projects: Project[]
  savedConversations: SavedThread[]
  stats: { projectCount: number; savedConversationCount: number }
} | null>(null)

useEffect(() => {
  loadDashboard()
}, [])

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

// In render:
return (
  <div className="min-h-screen bg-gray-50">
    <Header ... />

    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Saved Threads Section - only if user has saved conversations */}
      {dashboardData?.savedConversations.length > 0 && (
        <SavedThreadsSection threads={dashboardData.savedConversations} />
      )}

      {/* Projects Section - always shown */}
      <ProjectsSection
        projects={dashboardData?.projects || []}
        onCreateNew={() => setShowCreateModal(true)}
      />
    </main>
  </div>
)
```

#### 6.3.6 SharePage End Button Integration

**File: `frontend/src/pages/SharePage.tsx`** (modify)

Key changes:
1. Add "End Conversation" button to header
2. Add `EndSessionModal` state and rendering
3. Add `beforeunload` handler as backup

```typescript
// Add to SharePage state:
const [showEndModal, setShowEndModal] = useState(false)

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

// In header area (after project name):
<button
  onClick={() => setShowEndModal(true)}
  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100"
>
  End Conversation
</button>

// At end of component:
{showEndModal && conversationId && (
  <EndSessionModal
    conversationId={conversationId}
    messageCount={messages.length}
    startedAt={conversationStartedAt}
    projectName={project?.name || 'this project'}
    onClose={() => setShowEndModal(false)}
    onEnded={() => {
      setShowEndModal(false)
      // Show thank you or redirect
    }}
  />
)}
```

---

## 7. User Experience

### 7.1 Viewer End-of-Session Flow

```
1. Viewer clicks "End Conversation" in header
                    ↓
2. EndSessionModal appears with:
   - Thank you message + project name
   - Quick stats (message count, duration)
   - Value proposition for saving
                    ↓
3. Viewer chooses:
   ├─► "Save & Create Account" → Registration form
   │                              ↓
   │                         Account created
   │                              ↓
   │                         Conversation saved
   │                              ↓
   │                         Success message
   │                              ↓
   │                         → Dashboard
   │
   └─► "Just End" → Conversation marked ended
                              ↓
                    Thank you message
                              ↓
                    Session closed
```

### 7.2 Creator Analytics Flow

```
1. Creator views Analytics tab
                    ↓
2. Sees overview cards + conversation table
                    ↓
3. Clicks conversation row
                    ↓
4. Slide-over panel opens with:
   - Metadata (viewer, duration, sentiment)
   - AI summary (if generated)
   - Topics
   - Full message transcript
                    ↓
5. Click outside or "Back" to close
```

### 7.3 Unified Dashboard Scenarios

**Scenario A: Creator-only user**
- Sees "My Projects" section with project cards
- No "Saved Conversations" section (empty)

**Scenario B: Viewer-only user (new)**
- Sees "Saved Conversations" section with their threads
- Sees empty "My Projects" with CTA: "Share your own documents"

**Scenario C: Hybrid user**
- Sees both sections
- "Saved Conversations" at top (recent activity)
- "My Projects" below

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Backend:**

```typescript
// conversationAnalysis.test.ts
// Purpose: Verify AI summary generation handles edge cases and produces valid output

describe('generateConversationSummary', () => {
  it('generates summary for conversations with 5+ messages', async () => {
    const messages = Array(6).fill({ role: 'user', content: 'Test' })
    const result = await generateConversationSummary(messages)

    expect(result.summary).toBeTruthy()
    expect(result.sentiment).toMatch(/positive|neutral|negative/)
    expect(result.topics.length).toBeGreaterThan(0)
  })

  it('handles empty message array gracefully', async () => {
    // Should not throw, should return minimal response
    const result = await generateConversationSummary([])
    expect(result.summary).toBeDefined()
  })
})

// conversation.controller.test.ts
// Purpose: Verify conversation lifecycle endpoints handle authorization correctly

describe('endConversation', () => {
  it('sets endedAt and calculates duration', async () => {
    const conv = await createTestConversation()
    await request(app)
      .post(`/api/conversations/${conv.id}/end`)
      .expect(200)

    const updated = await prisma.conversation.findUnique({ where: { id: conv.id } })
    expect(updated.endedAt).toBeTruthy()
    expect(updated.durationSeconds).toBeGreaterThan(0)
  })

  it('generates summary only for 5+ message conversations', async () => {
    const conv = await createTestConversation({ messageCount: 3 })
    const { body } = await request(app)
      .post(`/api/conversations/${conv.id}/end`)
      .expect(200)

    expect(body.summary).toBeNull()
  })
})

describe('saveConversation', () => {
  it('requires authentication', async () => {
    await request(app)
      .post(`/api/conversations/${convId}/save`)
      .expect(401)
  })

  it('links conversation to user', async () => {
    await request(app)
      .post(`/api/conversations/${convId}/save`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const conv = await prisma.conversation.findUnique({ where: { id: convId } })
    expect(conv.savedByUserId).toBe(userId)
  })
})
```

**Frontend:**

```typescript
// EndSessionModal.test.tsx
// Purpose: Verify modal states and user flows work correctly

describe('EndSessionModal', () => {
  it('shows confirm mode initially', () => {
    render(<EndSessionModal {...defaultProps} />)
    expect(screen.getByText('End Conversation?')).toBeInTheDocument()
    expect(screen.getByText('Save & Create Account')).toBeInTheDocument()
  })

  it('transitions to register mode when save clicked', async () => {
    render(<EndSessionModal {...defaultProps} />)
    await userEvent.click(screen.getByText('Save & Create Account'))

    expect(screen.getByText('Create Your Account')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('calls onEnded when Just End clicked', async () => {
    const onEnded = jest.fn()
    render(<EndSessionModal {...defaultProps} onEnded={onEnded} />)

    await userEvent.click(screen.getByText('Just End'))
    await waitFor(() => expect(onEnded).toHaveBeenCalled())
  })
})
```

### 8.2 Integration Tests

```typescript
// analytics-flow.test.ts
// Purpose: Verify complete analytics flow from ending conversation to viewing in dashboard

describe('Analytics Integration', () => {
  it('end conversation → generate summary → view in analytics', async () => {
    // Setup: Create project + conversation with messages
    const project = await createProject(creatorToken)
    const conv = await createConversation(project.id)
    await addMessages(conv.id, 6) // Enough for summary

    // End conversation
    await request(app)
      .post(`/api/conversations/${conv.id}/end`)
      .expect(200)

    // Verify summary generated
    const { body } = await request(app)
      .get(`/api/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200)

    expect(body.conversation.summary).toBeTruthy()
    expect(body.conversation.sentiment).toBeTruthy()

    // Verify shows in project analytics
    const analytics = await request(app)
      .get(`/api/projects/${project.id}/analytics`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200)

    const recentConv = analytics.body.recentConversations.find(c => c.id === conv.id)
    expect(recentConv.sentiment).toBeTruthy()
  })
})

// viewer-to-user.test.ts
// Purpose: Verify complete viewer registration and conversation saving flow

describe('Viewer to User Conversion', () => {
  it('viewer creates account and saves conversation', async () => {
    // Setup: Create share link + conversation as viewer
    const shareLink = await createShareLink(project.id)
    const conv = await createConversation(project.id)

    // End conversation
    await request(app)
      .post(`/api/conversations/${conv.id}/end`)
      .expect(200)

    // Register as new user
    const { body: auth } = await request(app)
      .post('/api/auth/register')
      .send({ email: 'viewer@test.com', password: 'testpass123' })
      .expect(200)

    // Save conversation
    await request(app)
      .post(`/api/conversations/${conv.id}/save`)
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200)

    // Verify in saved conversations
    const { body: saved } = await request(app)
      .get('/api/users/me/saved-conversations')
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200)

    expect(saved.conversations).toHaveLength(1)
    expect(saved.conversations[0].id).toBe(conv.id)
  })
})
```

### 8.3 E2E Tests

```typescript
// e2e/viewer-end-session.spec.ts
// Purpose: Verify complete viewer UX from chat to account creation

test.describe('Viewer End Session Flow', () => {
  test('viewer can end conversation and create account', async ({ page }) => {
    // Navigate to share link
    await page.goto(`/s/${shareSlug}`)

    // Wait for chat to load
    await page.waitForSelector('[data-testid="chat-interface"]')

    // Send a few messages
    for (let i = 0; i < 3; i++) {
      await page.fill('[data-testid="message-input"]', `Test message ${i}`)
      await page.click('[data-testid="send-button"]')
      await page.waitForSelector('[data-testid="assistant-message"]')
    }

    // Click end conversation
    await page.click('[data-testid="end-conversation-button"]')

    // Verify modal appears
    await expect(page.locator('text=End Conversation?')).toBeVisible()

    // Click save & create account
    await page.click('text=Save & Create Account')

    // Fill registration form
    await page.fill('[placeholder="you@example.com"]', 'newviewer@test.com')
    await page.fill('[placeholder="Min 8 characters"]', 'testpass123')
    await page.click('text=Create Account & Save')

    // Verify success
    await expect(page.locator('text=Conversation Saved!')).toBeVisible()

    // Go to dashboard
    await page.click('text=Go to Dashboard')

    // Verify saved conversation appears
    await expect(page.locator('[data-testid="saved-threads-section"]')).toBeVisible()
  })
})
```

---

## 9. Performance Considerations

### 9.1 AI Summary Generation

**Issue:** LLM calls add latency to conversation ending

**Mitigation:**
- Use `gpt-4o-mini` for summaries (faster, cheaper)
- Only generate for conversations with 5+ messages
- Return immediately after marking `endedAt`, generate summary async
- Consider background job for bulk regeneration

**Expected Performance:**
- Summary generation: 2-4 seconds
- End conversation API: <500ms (summary async)

### 9.2 Dashboard Data Loading

**Issue:** Unified dashboard fetches more data

**Mitigation:**
- Limit saved conversations to 10 most recent
- Use `select` to fetch only needed fields
- Add index on `savedByUserId` for fast queries

**Expected Performance:**
- Dashboard load: <1 second
- Conversation detail: <500ms

### 9.3 CSV Export

**Issue:** Large exports could timeout

**Mitigation:**
- Paginate conversations (max 1000 per export)
- Stream response for large datasets
- Add loading indicator in UI

---

## 10. Security Considerations

### 10.1 Authorization

- **Conversation Detail**: Only project owner or savedByUser can view
- **End Conversation**: Anyone with conversation access can end
- **Save Conversation**: Requires authentication
- **CSV Export**: Only project owner

### 10.2 Data Privacy

- Viewer email stored only if provided during access
- Conversations can be deleted by project owner
- Saved conversations deleted if user account deleted

### 10.3 Rate Limiting (Post-Launch Optimization)

**Note:** Rate limiting specifications are documented as targets but should NOT block MVP. Implement after observing actual usage patterns.

*Future targets (post-launch):*
- Summary generation: Max 10 per minute per project
- Registration: Max 5 attempts per IP per hour
- CSV export: Max 10 per hour per user

---

## 11. Documentation

### 11.1 Updates Required

- [ ] Update CLAUDE.md with new API endpoints
- [ ] Add Analytics section to user guide
- [ ] Document viewer-to-user conversion flow
- [ ] Update API reference (specs/03-api-reference.md)

### 11.2 Inline Documentation

- Add JSDoc comments to new service functions
- Document LLM prompt patterns in conversationAnalysis.ts
- Add component prop documentation

---

## 12. Implementation Phases

### Phase A: Analytics Completion (Backend + Frontend)

**Backend Tasks:**
1. Add `GET /api/conversations/:id` endpoint
2. Add `POST /api/conversations/:id/end` endpoint
3. Create `conversationAnalysis.ts` service
4. Add CSV export endpoint
5. *(Deprioritized)* Add `GET /api/projects/:id/analytics/citations` endpoint - implement last, low usage

**Frontend Tasks:**
1. Create `ConversationDetailPanel` component
2. Add click handlers to conversation table rows
3. Add CSV export button to AnalyticsDashboard
4. *(Deprioritized)* Create `CitationStats` component - implement last if time permits

### Phase B: End-of-Session Experience

**Backend Tasks:**
1. Add `POST /api/conversations/:id/save` endpoint
2. Add `GET /api/users/me/saved-conversations` endpoint
3. Add conversation linking to registration flow

**Frontend Tasks:**
1. Create `EndSessionModal` component
2. Add "End Conversation" button to SharePage header
3. Add beforeunload handler
4. Integrate registration form in modal

### Phase C: Unified Dashboard

**Backend Tasks:**
1. Add `GET /api/users/me/dashboard` endpoint

**Frontend Tasks:**
1. Create `SavedThreadsSection` component
2. Create `SavedThreadCard` component
3. Refactor `DashboardPage` for unified experience
4. Create `SavedThreadPage` route
5. Add empty state CTAs

---

## 13. Open Questions

1. **Summary regeneration**: Should creators be able to manually trigger summary regeneration for older conversations?
   - **Recommendation**: Defer to Phase 2, add "Regenerate Summary" button later

2. **Conversation continuation limit**: Should there be a limit on how many messages can be added to a saved conversation?
   - **Recommendation**: No limit for MVP, monitor usage

3. **Multiple saved conversations**: Can a viewer save multiple conversations from different projects?
   - **Recommendation**: Yes, each conversation is independent

---

## 14. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Viewer → Account conversion | >15% | (new registrations from EndSessionModal) / (total ended conversations) |
| Saved conversation rate | >30% | (saved conversations) / (ended conversations with registration) |
| Return visitor rate | >20% | (users who return to saved thread within 7 days) / (total saved threads) |
| Summary generation time | <5s | Average time from end request to summary stored |
| Analytics page load | <2s | P95 time to interactive |

---

## 15. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM API costs for summaries | Medium | Medium | 5+ message threshold, use gpt-4o-mini |
| beforeunload unreliable | Low | High | Prefer explicit end button, use as backup |
| Viewer spam accounts | Medium | Low | Rate limit registration, require email verification later |
| Dashboard complexity | Medium | Medium | Progressive disclosure, clear visual hierarchy |
| Summary quality inconsistent | Low | Medium | Standard prompt, manual regeneration option |

---

## 16. References

- [Ideation Document](../docs/ideation/analytics-viewer-experience-unified-dashboard.md)
- [Existing Analytics Controller](../backend/src/controllers/analytics.controller.ts)
- [Existing Dashboard Page](../frontend/src/pages/DashboardPage.tsx)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [TestingDojo Pattern](../frontend/src/components/TestingDojo/) - Reference for modal and session patterns

---

## 17. Appendix: API Response Examples

### GET /api/conversations/:id

```json
{
  "conversation": {
    "id": "clx123...",
    "projectId": "clx456...",
    "viewerEmail": "viewer@example.com",
    "viewerName": "Jane Doe",
    "messageCount": 8,
    "durationSeconds": 342,
    "summary": "The viewer asked about investment terms and projected ROI. Key discussion points included the 18-month timeline and risk mitigation strategies.",
    "sentiment": "positive",
    "topics": ["ROI", "timeline", "risks", "investment"],
    "startedAt": "2025-12-04T10:30:00Z",
    "endedAt": "2025-12-04T10:35:42Z",
    "messages": [
      {
        "id": "msg1",
        "role": "assistant",
        "content": "Welcome! I'm here to help you understand...",
        "createdAt": "2025-12-04T10:30:00Z"
      },
      {
        "id": "msg2",
        "role": "user",
        "content": "What's the expected ROI?",
        "createdAt": "2025-12-04T10:30:45Z"
      }
      // ... more messages
    ],
    "project": {
      "id": "clx456...",
      "name": "Q4 Investment Proposal"
    }
  }
}
```

### GET /api/users/me/dashboard

```json
{
  "projects": [
    {
      "id": "clx123...",
      "name": "Q4 Investment Proposal",
      "description": "Quarterly investment deck",
      "_count": {
        "documents": 3,
        "conversations": 12
      }
    }
  ],
  "savedConversations": [
    {
      "id": "clx789...",
      "messageCount": 8,
      "startedAt": "2025-12-04T10:30:00Z",
      "endedAt": "2025-12-04T10:35:42Z",
      "project": {
        "id": "clx456...",
        "name": "Startup Pitch Deck"
      }
    }
  ],
  "stats": {
    "projectCount": 1,
    "savedConversationCount": 1
  }
}
```
