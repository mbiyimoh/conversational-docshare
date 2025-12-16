# Task Breakdown: Audience Synthesis & Versioning

**Generated:** 2025-12-07
**Source:** specs/feat-audience-synthesis.md
**Spec ID:** feat-audience-synthesis

---

## Overview

Implement audience-level aggregate synthesis that analyzes patterns across all conversations for a project. The synthesis is incrementally updated after each conversation ends, versioned for historical tracking, and displayed in the Analytics tab.

---

## Phase 1: Database Schema & Backend Foundation

### Task 1.1: Add AudienceSynthesis Model to Schema

**Description:** Create AudienceSynthesis Prisma model with versioning support and aggregate fields
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation task)

**Technical Requirements:**

Add to `backend/prisma/schema.prisma`:

```prisma
model AudienceSynthesis {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  version      Int

  // Aggregate insights (JSON fields)
  overview            String   @db.Text     // Overall pattern description
  commonQuestions     Json     // Array of { pattern, frequency, documents[] }
  knowledgeGaps       Json     // Array of { topic, severity, suggestion }
  documentSuggestions Json     // Array of { document, section, suggestion }
  sentimentTrend      String   // improving, stable, declining
  insights            Json     // Array of string insights

  // Metadata
  conversationCount   Int
  totalMessages       Int
  dateRangeFrom       DateTime
  dateRangeTo         DateTime

  createdAt    DateTime @default(now())

  @@unique([projectId, version])
  @@index([projectId])
}
```

Add relation to Project model:
```prisma
model Project {
  // ... existing fields
  audienceSyntheses  AudienceSynthesis[]
}
```

**Implementation Steps:**
1. Open `backend/prisma/schema.prisma`
2. Add AudienceSynthesis model after existing models
3. Add `audienceSyntheses` relation to Project model
4. Run `npx prisma validate`

**Acceptance Criteria:**
- [ ] AudienceSynthesis model created with all fields
- [ ] Unique constraint on [projectId, version]
- [ ] Index on projectId for query performance
- [ ] Relation to Project established
- [ ] Schema validates without errors

---

### Task 1.2: Push Schema Changes to Database

**Description:** Apply AudienceSynthesis schema changes to Supabase PostgreSQL
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Technical Requirements:**

Run database push using direct connection:
```bash
DATABASE_URL="postgresql://postgres.zflwtgaustyjpjmawnjw:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" npx prisma db push --schema=backend/prisma/schema.prisma
```

**Implementation Steps:**
1. Ensure DATABASE_URL uses port 5432 (direct connection, not pooler)
2. Run `npm run db:push` from backend directory
3. Verify AudienceSynthesis table created in Supabase
4. Regenerate Prisma client: `npx prisma generate`

**Acceptance Criteria:**
- [ ] AudienceSynthesis table created with all columns
- [ ] Unique constraint and indexes applied
- [ ] Foreign key to Project established
- [ ] Prisma client regenerated

---

### Task 1.3: Create AudienceSynthesis Service

**Description:** Build service with incremental and full synthesis generation logic using GPT-4o
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 1.4

**Technical Requirements:**

Create `backend/src/services/audienceSynthesis.ts`:

```typescript
import { prisma } from '../utils/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface SynthesisData {
  overview: string
  commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
  knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
  documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
  sentimentTrend: 'improving' | 'stable' | 'declining'
  insights: string[]
}

/**
 * Get the latest synthesis version for a project
 */
export async function getLatestSynthesis(projectId: string) {
  return prisma.audienceSynthesis.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' }
  })
}

/**
 * Update synthesis incrementally after a conversation ends
 */
export async function updateAudienceSynthesis(
  projectId: string,
  conversationId: string
) {
  // 1. Load previous synthesis
  const previousSynthesis = await getLatestSynthesis(projectId)

  // 2. Load the new conversation
  const newConversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      summary: true,
      topics: true,
      sentiment: true,
      messageCount: true,
      startedAt: true
    }
  })

  if (!newConversation) {
    throw new Error(`Conversation ${conversationId} not found`)
  }

  // 3. If no previous synthesis, do full regeneration
  if (!previousSynthesis) {
    return regenerateAudienceSynthesis(projectId)
  }

  // 4. Build incremental update prompt
  const prompt = buildIncrementalPrompt(previousSynthesis, newConversation)

  // 5. Call LLM for updated synthesis
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert at analyzing audience engagement patterns.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  })

  const synthesisData = JSON.parse(response.choices[0].message.content!) as SynthesisData

  // 6. Store as new version
  return prisma.audienceSynthesis.create({
    data: {
      projectId,
      version: previousSynthesis.version + 1,
      overview: synthesisData.overview,
      commonQuestions: synthesisData.commonQuestions,
      knowledgeGaps: synthesisData.knowledgeGaps,
      documentSuggestions: synthesisData.documentSuggestions,
      sentimentTrend: synthesisData.sentimentTrend,
      insights: synthesisData.insights,
      conversationCount: previousSynthesis.conversationCount + 1,
      totalMessages: previousSynthesis.totalMessages + newConversation.messageCount,
      dateRangeFrom: previousSynthesis.dateRangeFrom,
      dateRangeTo: new Date()
    }
  })
}

/**
 * Regenerate synthesis from all conversations (full analysis)
 */
export async function regenerateAudienceSynthesis(projectId: string) {
  // Load all ended conversations for project
  const conversations = await prisma.conversation.findMany({
    where: {
      project: {
        id: projectId
      },
      endedAt: { not: null }
    },
    select: {
      id: true,
      summary: true,
      topics: true,
      sentiment: true,
      messageCount: true,
      startedAt: true,
      endedAt: true
    },
    orderBy: { startedAt: 'asc' }
  })

  if (conversations.length === 0) {
    return null
  }

  // Build full analysis prompt
  const prompt = buildFullAnalysisPrompt(conversations)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert at analyzing audience engagement patterns.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  })

  const synthesisData = JSON.parse(response.choices[0].message.content!) as SynthesisData

  // Get current max version
  const latestSynthesis = await getLatestSynthesis(projectId)
  const newVersion = (latestSynthesis?.version ?? 0) + 1

  // Calculate totals
  const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0)

  return prisma.audienceSynthesis.create({
    data: {
      projectId,
      version: newVersion,
      overview: synthesisData.overview,
      commonQuestions: synthesisData.commonQuestions,
      knowledgeGaps: synthesisData.knowledgeGaps,
      documentSuggestions: synthesisData.documentSuggestions,
      sentimentTrend: synthesisData.sentimentTrend,
      insights: synthesisData.insights,
      conversationCount: conversations.length,
      totalMessages,
      dateRangeFrom: conversations[0].startedAt,
      dateRangeTo: conversations[conversations.length - 1].endedAt!
    }
  })
}

function buildIncrementalPrompt(
  previousSynthesis: any,
  newConversation: any
): string {
  return `
You are updating an audience synthesis based on a new conversation.

## Previous Synthesis (Version ${previousSynthesis.version})
Overview: ${previousSynthesis.overview}

Common Questions:
${JSON.stringify(previousSynthesis.commonQuestions, null, 2)}

Knowledge Gaps:
${JSON.stringify(previousSynthesis.knowledgeGaps, null, 2)}

Document Suggestions:
${JSON.stringify(previousSynthesis.documentSuggestions, null, 2)}

Sentiment Trend: ${previousSynthesis.sentimentTrend}

Insights:
${JSON.stringify(previousSynthesis.insights, null, 2)}

Conversation Count: ${previousSynthesis.conversationCount}

## New Conversation Summary
Summary: ${newConversation.summary || 'No summary available'}
Topics: ${(newConversation.topics || []).join(', ')}
Sentiment: ${newConversation.sentiment || 'neutral'}
Message Count: ${newConversation.messageCount}

## Instructions
Update the synthesis to incorporate insights from this new conversation.

Return JSON with this structure:
{
  "overview": "Updated overall pattern description (1-2 paragraphs)",
  "commonQuestions": [
    { "pattern": "Question pattern", "frequency": 5, "documents": ["doc1.pdf"] }
  ],
  "knowledgeGaps": [
    { "topic": "Area of confusion", "severity": "high", "suggestion": "How to address" }
  ],
  "documentSuggestions": [
    { "documentId": "...", "section": "Section name", "suggestion": "What to improve" }
  ],
  "sentimentTrend": "improving|stable|declining",
  "insights": ["Specific insight 1", "Specific insight 2"]
}

Important:
- Preserve patterns that still hold true
- Update frequencies where relevant
- Add new patterns if they emerge
- Remove patterns that are no longer supported
- Keep insights actionable and specific
- sentimentTrend should reflect direction across all conversations
`
}

function buildFullAnalysisPrompt(conversations: any[]): string {
  const conversationSummaries = conversations.map((c, i) => `
Conversation ${i + 1}:
- Summary: ${c.summary || 'No summary'}
- Topics: ${(c.topics || []).join(', ')}
- Sentiment: ${c.sentiment || 'neutral'}
- Messages: ${c.messageCount}
`).join('\n')

  return `
Analyze all conversations to create an audience synthesis.

## All Conversations (${conversations.length} total)
${conversationSummaries}

## Instructions
Create a comprehensive synthesis of audience engagement patterns.

Return JSON with this structure:
{
  "overview": "Overall pattern description (1-2 paragraphs)",
  "commonQuestions": [
    { "pattern": "Question pattern", "frequency": 5, "documents": ["doc1.pdf"] }
  ],
  "knowledgeGaps": [
    { "topic": "Area of confusion", "severity": "high", "suggestion": "How to address" }
  ],
  "documentSuggestions": [
    { "documentId": "...", "section": "Section name", "suggestion": "What to improve" }
  ],
  "sentimentTrend": "improving|stable|declining",
  "insights": ["Specific insight 1", "Specific insight 2"]
}

Guidelines:
- Identify recurring question patterns
- Note areas where multiple people struggle
- Suggest specific document improvements
- Track overall sentiment direction
- Provide actionable insights
`
}
```

**Acceptance Criteria:**
- [ ] getLatestSynthesis returns most recent version
- [ ] updateAudienceSynthesis performs incremental update
- [ ] regenerateAudienceSynthesis analyzes all conversations
- [ ] LLM prompt generates valid JSON structure
- [ ] Version numbers increment correctly
- [ ] Metadata (counts, date ranges) calculated correctly

---

### Task 1.4: Create AudienceSynthesis Controller

**Description:** Build backend controller with endpoints for getting and regenerating synthesis
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3
**Can run parallel with:** Task 1.3

**Technical Requirements:**

Create `backend/src/controllers/audienceSynthesis.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'
import {
  getLatestSynthesis,
  regenerateAudienceSynthesis
} from '../services/audienceSynthesis'

/**
 * Get current (latest) synthesis
 * GET /api/projects/:projectId/audience-synthesis
 */
export async function getCurrentSynthesis(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true }
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized to view this project')
  }

  const synthesis = await getLatestSynthesis(projectId)

  res.json({
    synthesis: synthesis ? {
      id: synthesis.id,
      version: synthesis.version,
      overview: synthesis.overview,
      commonQuestions: synthesis.commonQuestions,
      knowledgeGaps: synthesis.knowledgeGaps,
      documentSuggestions: synthesis.documentSuggestions,
      sentimentTrend: synthesis.sentimentTrend,
      insights: synthesis.insights,
      conversationCount: synthesis.conversationCount,
      totalMessages: synthesis.totalMessages,
      dateRangeFrom: synthesis.dateRangeFrom,
      dateRangeTo: synthesis.dateRangeTo,
      createdAt: synthesis.createdAt
    } : null
  })
}

/**
 * Get synthesis version history (metadata only)
 * GET /api/projects/:projectId/audience-synthesis/versions
 */
export async function getSynthesisVersions(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true }
  })

  if (!project || project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const versions = await prisma.audienceSynthesis.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      conversationCount: true,
      createdAt: true
    }
  })

  res.json({ versions })
}

/**
 * Get specific synthesis version
 * GET /api/projects/:projectId/audience-synthesis/versions/:version
 */
export async function getSynthesisVersion(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId, version } = req.params
  const versionNum = parseInt(version, 10)

  if (isNaN(versionNum)) {
    throw new ValidationError('Invalid version number')
  }

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true }
  })

  if (!project || project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const synthesis = await prisma.audienceSynthesis.findUnique({
    where: {
      projectId_version: { projectId, version: versionNum }
    }
  })

  if (!synthesis) {
    throw new NotFoundError('Synthesis version')
  }

  res.json({
    synthesis: {
      id: synthesis.id,
      version: synthesis.version,
      overview: synthesis.overview,
      commonQuestions: synthesis.commonQuestions,
      knowledgeGaps: synthesis.knowledgeGaps,
      documentSuggestions: synthesis.documentSuggestions,
      sentimentTrend: synthesis.sentimentTrend,
      insights: synthesis.insights,
      conversationCount: synthesis.conversationCount,
      totalMessages: synthesis.totalMessages,
      dateRangeFrom: synthesis.dateRangeFrom,
      dateRangeTo: synthesis.dateRangeTo,
      createdAt: synthesis.createdAt
    }
  })
}

/**
 * Regenerate synthesis from all conversations
 * POST /api/projects/:projectId/audience-synthesis/regenerate
 */
export async function regenerateSynthesis(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true }
  })

  if (!project || project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const synthesis = await regenerateAudienceSynthesis(projectId)

  res.json({
    synthesis: synthesis ? {
      id: synthesis.id,
      version: synthesis.version,
      overview: synthesis.overview,
      commonQuestions: synthesis.commonQuestions,
      knowledgeGaps: synthesis.knowledgeGaps,
      documentSuggestions: synthesis.documentSuggestions,
      sentimentTrend: synthesis.sentimentTrend,
      insights: synthesis.insights,
      conversationCount: synthesis.conversationCount,
      totalMessages: synthesis.totalMessages,
      dateRangeFrom: synthesis.dateRangeFrom,
      dateRangeTo: synthesis.dateRangeTo,
      createdAt: synthesis.createdAt
    } : null,
    regenerated: true
  })
}
```

**Acceptance Criteria:**
- [ ] getCurrentSynthesis returns latest version
- [ ] getSynthesisVersions returns metadata only
- [ ] getSynthesisVersion returns specific version
- [ ] regenerateSynthesis triggers full analysis
- [ ] All endpoints verify project ownership
- [ ] Proper error handling for missing data

---

### Task 1.5: Create AudienceSynthesis Routes

**Description:** Create Express routes for audience synthesis endpoints
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.4
**Can run parallel with:** None

**Technical Requirements:**

Create `backend/src/routes/audienceSynthesis.routes.ts`:

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getCurrentSynthesis,
  getSynthesisVersions,
  getSynthesisVersion,
  regenerateSynthesis
} from '../controllers/audienceSynthesis.controller'

const router = Router()

// Get current (latest) synthesis
router.get(
  '/projects/:projectId/audience-synthesis',
  authenticate,
  asyncHandler(getCurrentSynthesis)
)

// Get version history
router.get(
  '/projects/:projectId/audience-synthesis/versions',
  authenticate,
  asyncHandler(getSynthesisVersions)
)

// Get specific version
router.get(
  '/projects/:projectId/audience-synthesis/versions/:version',
  authenticate,
  asyncHandler(getSynthesisVersion)
)

// Regenerate synthesis
router.post(
  '/projects/:projectId/audience-synthesis/regenerate',
  authenticate,
  asyncHandler(regenerateSynthesis)
)

export default router
```

Register in `backend/src/index.ts`:
```typescript
import audienceSynthesisRoutes from './routes/audienceSynthesis.routes'
// ...
app.use('/api', audienceSynthesisRoutes)
```

**Acceptance Criteria:**
- [ ] All routes require authentication
- [ ] Routes registered in main app
- [ ] asyncHandler wraps all controllers

---

## Phase 2: Auto-trigger Integration

### Task 2.1: Integrate Synthesis Update into endConversation

**Description:** Trigger audience synthesis update when conversation ends
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3
**Can run parallel with:** None

**Technical Requirements:**

Modify `backend/src/controllers/conversation.controller.ts` endConversation function:

```typescript
// After the recommendation generation block, add:

// Update audience synthesis (async, don't block response)
if (conversation.messages.length >= 5) {
  try {
    // Generate recommendations (existing)
    const { generateConversationRecommendations } = await import(
      '../services/conversationRecommendationGenerator'
    )
    const recs = await generateConversationRecommendations(id)
    recommendationCount = recs.length

    // NEW: Update audience synthesis
    const { updateAudienceSynthesis } = await import(
      '../services/audienceSynthesis'
    )
    // Get projectId from conversation
    const conversationWithProject = await prisma.conversation.findUnique({
      where: { id },
      select: { projectId: true }
    })
    if (conversationWithProject) {
      await updateAudienceSynthesis(conversationWithProject.projectId, id)
    }
  } catch (error) {
    // Log but don't fail - synthesis is enhancement, not critical
    console.warn('Failed to update synthesis:', error)
  }
}
```

**Implementation Notes:**
- Synthesis update is async and non-blocking
- Errors are logged but don't fail the conversation end
- Only triggers for conversations with 5+ messages (same as recommendations)
- Uses dynamic import to keep bundle size manageable

**Acceptance Criteria:**
- [ ] Synthesis updates after conversation ends
- [ ] Only triggers for 5+ message conversations
- [ ] Errors don't block response
- [ ] projectId correctly retrieved

---

## Phase 3: Frontend Display

### Task 3.1: Create AudienceSynthesisPanel Component

**Description:** Build main component for displaying synthesis in Analytics tab
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.5
**Can run parallel with:** Task 3.2, Task 3.3

**Technical Requirements:**

Create `frontend/src/components/AudienceSynthesisPanel.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { SynthesisVersionSelector } from './SynthesisVersionSelector'
import { CommonQuestionsCard } from './CommonQuestionsCard'
import { KnowledgeGapsCard } from './KnowledgeGapsCard'
import { DocumentSuggestionsCard } from './DocumentSuggestionsCard'

interface AudienceSynthesis {
  id: string
  version: number
  overview: string
  commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
  knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
  documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
  sentimentTrend: string
  insights: string[]
  conversationCount: number
  totalMessages: number
  dateRangeFrom: string
  dateRangeTo: string
  createdAt: string
}

interface VersionMeta {
  id: string
  version: number
  conversationCount: number
  createdAt: string
}

interface AudienceSynthesisPanelProps {
  projectId: string
}

export function AudienceSynthesisPanel({ projectId }: AudienceSynthesisPanelProps) {
  const [synthesis, setSynthesis] = useState<AudienceSynthesis | null>(null)
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [synthResponse, versionsResponse] = await Promise.all([
        api.getAudienceSynthesis(projectId),
        api.getAudienceSynthesisVersions(projectId)
      ])

      setSynthesis(synthResponse.synthesis)
      setVersions(versionsResponse.versions)
      if (synthResponse.synthesis) {
        setSelectedVersion(synthResponse.synthesis.version)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load synthesis')
    } finally {
      setLoading(false)
    }
  }

  const loadVersion = async (version: number) => {
    try {
      setLoading(true)
      const response = await api.getAudienceSynthesisVersion(projectId, version)
      setSynthesis(response.synthesis)
      setSelectedVersion(version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    try {
      setRegenerating(true)
      setError('')
      const response = await api.regenerateAudienceSynthesis(projectId)
      setSynthesis(response.synthesis)
      await loadData() // Refresh versions list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  const getSentimentIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗️'
      case 'declining': return '↘️'
      default: return '→'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!synthesis) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Audience Insights</h3>
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No synthesis available yet.</p>
          <p className="text-sm">
            Insights will appear after multiple conversations with 5+ messages.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {regenerating ? 'Generating...' : 'Generate Now'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Audience Insights</h3>
          <p className="text-sm text-gray-500">
            {synthesis.conversationCount} conversations • {synthesis.totalMessages} messages
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SynthesisVersionSelector
            versions={versions}
            currentVersion={selectedVersion!}
            onSelect={loadVersion}
          />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {regenerating ? 'Regenerating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Overview */}
      <div className="px-6 py-4 border-b">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Overview</h4>
        <p className="text-gray-700">{synthesis.overview}</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            Sentiment: {getSentimentIcon(synthesis.sentimentTrend)} {synthesis.sentimentTrend}
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-6 grid md:grid-cols-2 gap-6">
        <CommonQuestionsCard questions={synthesis.commonQuestions} />
        <KnowledgeGapsCard gaps={synthesis.knowledgeGaps} />
      </div>

      {/* Document Suggestions */}
      {synthesis.documentSuggestions.length > 0 && (
        <div className="px-6 pb-6">
          <DocumentSuggestionsCard
            suggestions={synthesis.documentSuggestions}
            onViewDocument={(docId, section) => {
              // TODO: Navigate to document
              console.log('View document:', docId, section)
            }}
          />
        </div>
      )}

      {/* Insights */}
      {synthesis.insights.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Key Insights</h4>
          <ul className="space-y-2">
            {synthesis.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Loads and displays current synthesis
- [ ] Shows loading and empty states
- [ ] Version selector works
- [ ] Regenerate button triggers refresh
- [ ] Sentiment trend displayed with icon
- [ ] All sections render correctly

---

### Task 3.2: Create Sub-components (Cards)

**Description:** Build CommonQuestionsCard, KnowledgeGapsCard, and DocumentSuggestionsCard
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 3.1, Task 3.3

**Technical Requirements:**

Create `frontend/src/components/CommonQuestionsCard.tsx`:

```tsx
interface CommonQuestionsCardProps {
  questions: Array<{
    pattern: string
    frequency: number
    documents: string[]
  }>
}

export function CommonQuestionsCard({ questions }: CommonQuestionsCardProps) {
  if (questions.length === 0) return null

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-3">Common Questions</h4>
      <div className="space-y-3">
        {questions.slice(0, 5).map((q, i) => (
          <div key={i} className="flex items-start justify-between">
            <span className="text-sm text-gray-600">{q.pattern}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {q.frequency}x
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create `frontend/src/components/KnowledgeGapsCard.tsx`:

```tsx
interface KnowledgeGapsCardProps {
  gaps: Array<{
    topic: string
    severity: string
    suggestion: string
  }>
}

export function KnowledgeGapsCard({ gaps }: KnowledgeGapsCardProps) {
  if (gaps.length === 0) return null

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700'
      case 'medium': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-3">Knowledge Gaps</h4>
      <div className="space-y-3">
        {gaps.slice(0, 5).map((gap, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(gap.severity)}`}>
                {gap.severity}
              </span>
              <span className="text-sm font-medium text-gray-700">{gap.topic}</span>
            </div>
            <p className="text-xs text-gray-500 ml-12">{gap.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create `frontend/src/components/DocumentSuggestionsCard.tsx`:

```tsx
interface DocumentSuggestionsCardProps {
  suggestions: Array<{
    documentId: string
    documentName?: string
    section: string
    suggestion: string
  }>
  onViewDocument: (documentId: string, section: string) => void
}

export function DocumentSuggestionsCard({
  suggestions,
  onViewDocument
}: DocumentSuggestionsCardProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-3">Document Improvement Suggestions</h4>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-700">{s.suggestion}</div>
              <div className="text-xs text-gray-500 mt-1">
                {s.documentName || s.documentId} → {s.section}
              </div>
            </div>
            <button
              onClick={() => onViewDocument(s.documentId, s.section)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-2"
            >
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] CommonQuestionsCard shows patterns with frequency
- [ ] KnowledgeGapsCard shows severity color coding
- [ ] DocumentSuggestionsCard has view button
- [ ] All cards handle empty arrays gracefully

---

### Task 3.3: Create SynthesisVersionSelector Component

**Description:** Build dropdown for selecting historical synthesis versions
**Size:** Small
**Priority:** Medium
**Dependencies:** None
**Can run parallel with:** Task 3.1, Task 3.2

**Technical Requirements:**

Create `frontend/src/components/SynthesisVersionSelector.tsx`:

```tsx
interface VersionMeta {
  id: string
  version: number
  conversationCount: number
  createdAt: string
}

interface SynthesisVersionSelectorProps {
  versions: VersionMeta[]
  currentVersion: number
  onSelect: (version: number) => void
}

export function SynthesisVersionSelector({
  versions,
  currentVersion,
  onSelect
}: SynthesisVersionSelectorProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <select
      value={currentVersion}
      onChange={(e) => onSelect(parseInt(e.target.value, 10))}
      className="text-sm border rounded px-2 py-1.5 bg-white"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.version}>
          v{v.version} - {formatDate(v.createdAt)} ({v.conversationCount} conv.)
        </option>
      ))}
    </select>
  )
}
```

**Acceptance Criteria:**
- [ ] Dropdown shows all versions
- [ ] Format: "v{N} - {date} ({count} conv.)"
- [ ] Selection triggers onSelect callback

---

### Task 3.4: Add API Methods to Frontend Client

**Description:** Add audience synthesis API methods to frontend api.ts
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.5
**Can run parallel with:** Task 3.1

**Technical Requirements:**

Add to `frontend/src/lib/api.ts`:

```typescript
// Audience Synthesis
async getAudienceSynthesis(projectId: string) {
  return this.request<{ synthesis: AudienceSynthesis | null }>(
    `projects/${projectId}/audience-synthesis`
  )
}

async getAudienceSynthesisVersions(projectId: string) {
  return this.request<{ versions: VersionMeta[] }>(
    `projects/${projectId}/audience-synthesis/versions`
  )
}

async getAudienceSynthesisVersion(projectId: string, version: number) {
  return this.request<{ synthesis: AudienceSynthesis }>(
    `projects/${projectId}/audience-synthesis/versions/${version}`
  )
}

async regenerateAudienceSynthesis(projectId: string) {
  return this.request<{ synthesis: AudienceSynthesis | null; regenerated: boolean }>(
    `projects/${projectId}/audience-synthesis/regenerate`,
    { method: 'POST' }
  )
}
```

**Acceptance Criteria:**
- [ ] All four API methods added
- [ ] Types match backend responses
- [ ] Methods use correct HTTP verbs

---

### Task 3.5: Integrate into AnalyticsDashboard

**Description:** Add AudienceSynthesisPanel to Analytics page
**Size:** Small
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** None

**Technical Requirements:**

Modify `frontend/src/components/AnalyticsDashboard.tsx`:

1. Import the component:
```typescript
import { AudienceSynthesisPanel } from './AudienceSynthesisPanel'
```

2. Add to the Analytics layout (typically as a new section at the top or as a tab):
```tsx
{/* Add after the overview stats section */}
<div className="mt-6">
  <AudienceSynthesisPanel projectId={projectId} />
</div>
```

**Acceptance Criteria:**
- [ ] Panel visible in Analytics view
- [ ] Loads synthesis data on mount
- [ ] Integrates visually with existing layout

---

## Phase 4: Testing & Verification

### Task 4.1: Manual Testing & Bug Fixes

**Description:** Comprehensive testing of audience synthesis functionality
**Size:** Medium
**Priority:** High
**Dependencies:** All previous tasks
**Can run parallel with:** None

**Test Scenarios:**

1. **Initial State:**
   - New project with no conversations → shows empty state
   - Project with <5 message conversations → no synthesis

2. **Auto-generation:**
   - End conversation with 5+ messages → synthesis created
   - End another conversation → synthesis version increments

3. **Version Navigation:**
   - Select older version → loads correct data
   - Return to latest → shows current version

4. **Manual Regeneration:**
   - Click Refresh → new version created
   - Verify counts updated

5. **Error Handling:**
   - API failure → error message shown
   - Empty project → appropriate message

**Acceptance Criteria:**
- [ ] All test scenarios pass
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Performance acceptable (<3s load time)

---

## Summary

| Phase | Tasks | Estimated Size |
|-------|-------|----------------|
| Phase 1: Database & Backend | 5 tasks | Large |
| Phase 2: Auto-trigger | 1 task | Medium |
| Phase 3: Frontend Display | 5 tasks | Large |
| Phase 4: Testing | 1 task | Medium |

**Total Tasks:** 12
**Critical Path:** 1.1 → 1.2 → 1.3 → 2.1 → 3.1 → 3.5 → 4.1

**Parallel Execution Opportunities:**
- Task 1.3 and 1.4 can run in parallel
- Task 3.1, 3.2, 3.3, and 3.4 can run in parallel
