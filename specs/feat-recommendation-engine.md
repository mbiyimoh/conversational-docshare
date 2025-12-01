# Recommendation Engine for Testing Feedback

## Status
Draft

## Authors
Claude Code - November 26, 2025

## Overview

Add a recommendation engine that analyzes comments from testing sessions and suggests specific updates to interview answers and the AI agent profile. The engine uses LLM to identify patterns in feedback, maps them to relevant interview questions, and generates actionable recommendations with diff previews. Creators can apply recommendations to pre-fill the interview form or dismiss them.

## Background/Problem Statement

### Current State
After testing in the Dojo and leaving comments on AI responses, creators must manually translate their feedback into interview answer changes. There's no automated way to close the feedback loop.

### Problem
1. **Manual Translation**: Creators must remember and manually apply feedback
2. **Pattern Recognition**: Hard to identify themes across multiple comments
3. **Mapping Difficulty**: Not obvious which interview question relates to which feedback
4. **Iteration Friction**: High effort to refine agent behavior based on testing

### Solution
An AI-powered recommendation engine that analyzes all testing comments, identifies patterns, and suggests specific interview answer updates with rationale.

## Goals

- Analyze all comments across testing sessions for a project
- Generate structured recommendations mapped to specific interview questions
- Show current answer vs. suggested update (diff preview)
- Display rationale with related comments that drove the recommendation
- Allow "Apply to Interview" to pre-fill interview form with suggestion
- Allow "Dismiss" to hide recommendation
- Support "Regenerate" to get fresh recommendations
- Target < 10 seconds for recommendation generation

## Non-Goals

- Automatic application without creator approval
- Learning from acceptance/rejection patterns (future ML enhancement)
- Cross-project recommendation patterns
- Real-time recommendation updates as comments are added
- Recommendation history/versioning

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recommendation generation time | < 10 seconds | Backend timer from request to response |
| LLM success rate | > 95% | Successful parses / total requests |
| Recommendation relevance | Each rec maps to valid questionId | Automated validation |
| Apply flow completion | Pre-filled data matches suggestion | E2E test verification |
| Error handling | Graceful degradation on timeout | No 500 errors exposed to user |

## Technical Dependencies

### External Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| OpenAI SDK | ^4.x | LLM-powered comment analysis |
| Prisma | ^5.x | Database queries |
| React | ^18.x | Frontend components |

### Internal Dependencies
| Component | Path | Purpose |
|-----------|------|---------|
| AgentConfig | `backend/prisma/schema.prisma` | Interview data storage |
| TestComment | `backend/prisma/schema.prisma` | Comment storage |
| OpenAI Client | `backend/src/utils/openai.ts` | LLM client |
| AgentInterview | `frontend/src/components/AgentInterview.tsx` | Apply recommendations |

## Detailed Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RECOMMENDATION ENGINE FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "Get Recommendations" in Testing Dojo
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Backend                                          │
│                                                                           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │
│  │ Fetch Comments  │───▶│ Build Analysis  │───▶│ LLM Analysis    │       │
│  │ (all sessions)  │    │ Prompt          │    │ (GPT-4)         │       │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘       │
│                                                          │                │
│  ┌─────────────────┐    ┌─────────────────┐             │                │
│  │ Return JSON     │◀───│ Parse & Validate│◀────────────┘                │
│  │ Recommendations │    │ Response        │                               │
│  └─────────────────┘    └─────────────────┘                               │
└───────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Frontend                                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    RecommendationPanel                               │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Recommendation Card                                          │    │  │
│  │  │ Question: Communication Style                                │    │  │
│  │  │ Current: "Professional and formal"                           │    │  │
│  │  │ Suggested: "Professional but approachable..."                │    │  │
│  │  │ Rationale: Based on 3 comments about tone...                 │    │  │
│  │  │ [Apply to Interview] [Dismiss]                               │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
                │
                │ User clicks "Apply"
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  AgentInterview opens with pre-filled suggestion, user reviews & saves    │
└───────────────────────────────────────────────────────────────────────────┘
```

### TypeScript Type Definitions

#### New File: `frontend/src/types/recommendation.ts`

```typescript
export interface Recommendation {
  id: string
  questionId: 'audience' | 'purpose' | 'tone' | 'emphasis' | 'questions'
  questionLabel: string
  currentAnswer: string
  suggestedAnswer: string
  rationale: string
  relatedComments: RelatedComment[]
  confidence: 'high' | 'medium' | 'low'
  status: 'pending' | 'applied' | 'dismissed'
}

export interface RelatedComment {
  id: string
  content: string
  messagePreview: string
}

export interface RecommendationResponse {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}

export interface ApplyRecommendationResponse {
  prefilledData: Record<string, string>
  changedField: string
  previousValue: string
  newValue: string
}
```

#### Extend: `backend/src/utils/errors.ts`

```typescript
// Add to existing errors file
export class RateLimitError extends Error {
  statusCode = 429

  constructor(message: string = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitError'
  }
}
```

### Data Structures (Backend)

```typescript
interface Recommendation {
  id: string
  questionId: 'audience' | 'purpose' | 'tone' | 'emphasis' | 'questions'
  questionLabel: string
  currentAnswer: string
  suggestedAnswer: string
  rationale: string
  relatedComments: {
    id: string
    content: string
    messagePreview: string  // First 100 chars of AI response
  }[]
  confidence: 'high' | 'medium' | 'low'
  status: 'pending' | 'applied' | 'dismissed'
}

interface RecommendationResponse {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}
```

### Backend Implementation

#### New File: `backend/src/services/recommendationEngine.ts`

```typescript
import { getOpenAI } from '../utils/openai'
import { prisma } from '../utils/prisma'

// Constants
const MAX_COMMENTS = 50  // Limit comments to prevent prompt overflow
const LLM_TIMEOUT_MS = 30000  // 30 second timeout
const VALID_QUESTION_IDS = ['audience', 'purpose', 'tone', 'emphasis', 'questions'] as const

type QuestionId = typeof VALID_QUESTION_IDS[number]

interface InterviewData {
  audience?: string
  purpose?: string
  tone?: string
  emphasis?: string
  questions?: string
}

interface CommentWithContext {
  id: string
  content: string
  templateId: string | null
  messageContent: string
}

interface Recommendation {
  id: string
  questionId: string
  questionLabel: string
  currentAnswer: string
  suggestedAnswer: string
  rationale: string
  relatedComments: {
    id: string
    content: string
    messagePreview: string
  }[]
  confidence: 'high' | 'medium' | 'low'
  status: 'pending'
}

const QUESTION_LABELS: Record<string, string> = {
  audience: 'Who is your primary audience?',
  purpose: "What's the main purpose of these documents?",
  tone: 'What communication style should the AI use?',
  emphasis: 'What should the AI emphasize?',
  questions: 'What proactive questions should the AI ask?',
}

const ANALYSIS_PROMPT = `You are an expert at analyzing user feedback on AI agent behavior and suggesting configuration improvements.

## Current Interview Configuration
{interviewConfig}

## Testing Feedback Comments
The user left these comments while testing their AI agent. Each comment is tagged to a specific AI response:

{comments}

## Task
Analyze the feedback comments and generate specific recommendations for updating the interview answers.

For each recommendation:
1. Identify which interview question the feedback relates to
2. Explain why the change is needed (reference specific comments)
3. Suggest a specific updated answer that addresses the feedback
4. Rate confidence as "high" (multiple comments agree), "medium" (clear pattern), or "low" (single comment)

Return a JSON array with this structure:
[
  {
    "questionId": "tone",
    "suggestedAnswer": "Professional but approachable, with a conversational tone especially when discussing timelines and practical implications",
    "rationale": "Multiple comments (3) mentioned the tone being too formal, particularly when discussing practical topics",
    "relatedCommentIds": ["comment-id-1", "comment-id-2"],
    "confidence": "high"
  }
]

Rules:
- Only suggest changes if there's clear feedback supporting it
- Don't suggest changes for questions with no related feedback
- Be specific in suggested answers, incorporating the feedback themes
- Keep suggested answers concise (1-3 sentences max)
- Group similar feedback into single recommendations`

export async function generateRecommendations(projectId: string): Promise<{
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
}> {
  // 1. Fetch most recent comments (limited to prevent prompt overflow)
  const comments = await prisma.testComment.findMany({
    where: {
      message: {
        session: {
          projectId,
        },
      },
    },
    take: MAX_COMMENTS,  // Limit to most recent comments
    orderBy: { createdAt: 'desc' },  // Most recent first
    include: {
      message: {
        select: {
          content: true,
          session: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (comments.length === 0) {
    return {
      recommendations: [],
      totalComments: 0,
      sessionsAnalyzed: 0,
    }
  }

  // Get unique session count
  const sessionIds = new Set(comments.map((c) => c.message.session.id))

  // 2. Fetch current interview data
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new Error('Agent config not found')
  }

  const interviewData = agentConfig.interviewData as InterviewData

  // 3. Build the analysis prompt
  const interviewConfigStr = Object.entries(interviewData)
    .filter(([_, value]) => value)
    .map(([key, value]) => `- ${QUESTION_LABELS[key] || key}: "${value}"`)
    .join('\n')

  const commentsStr = comments
    .map(
      (c, i) =>
        `Comment ${i + 1} (ID: ${c.id})${c.templateId ? ` [${c.templateId}]` : ''}:
  Feedback: "${c.content}"
  On AI response: "${c.message.content.substring(0, 200)}..."`
    )
    .join('\n\n')

  const prompt = ANALYSIS_PROMPT
    .replace('{interviewConfig}', interviewConfigStr)
    .replace('{comments}', commentsStr)

  // 4. Call LLM with timeout
  const openai = getOpenAI()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You analyze AI agent testing feedback and generate actionable recommendations. Always return valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    }, { signal: controller.signal })

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Failed to generate recommendations: Empty response')
    }

    // 5. Parse and validate response
    let parsed: { recommendations?: unknown[] } | unknown[]
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('Failed to parse recommendations response')
    }

    // Handle both array and object responses
    const rawRecs = Array.isArray(parsed)
      ? parsed
      : (parsed as { recommendations?: unknown[] }).recommendations || []

    // 6. Build and validate recommendation objects
    const recommendations: Recommendation[] = rawRecs
      .map((rec: any, index: number) => {
        // Validate questionId is valid
        const questionId = rec.questionId as QuestionId
        if (!VALID_QUESTION_IDS.includes(questionId)) {
          console.warn(`Skipping recommendation with invalid questionId: ${rec.questionId}`)
          return null
        }

        const currentAnswer = interviewData[questionId] || ''

        // Validate suggestedAnswer exists and is different
        if (!rec.suggestedAnswer || rec.suggestedAnswer.trim() === '') {
          return null
        }

        // Validate confidence is valid
        const validConfidence = ['high', 'medium', 'low'].includes(rec.confidence)
        const confidence = validConfidence ? rec.confidence : 'medium'

        // Find the actual comments referenced
        const relatedComments = (rec.relatedCommentIds || [])
          .map((id: string) => {
            const comment = comments.find((c) => c.id === id)
            if (!comment) return null
            return {
              id: comment.id,
              content: comment.content,
              messagePreview: comment.message.content.substring(0, 100) + '...',
            }
          })
          .filter(Boolean)

        return {
          id: `rec-${index}-${Date.now()}`,
          questionId,
          questionLabel: QUESTION_LABELS[questionId] || questionId,
          currentAnswer,
          suggestedAnswer: rec.suggestedAnswer,
          rationale: rec.rationale || 'Based on your testing feedback.',
          relatedComments,
          confidence,
          status: 'pending' as const,
        }
      })
      .filter((r): r is Recommendation => r !== null)

    return {
      recommendations,
      totalComments: comments.length,
      sessionsAnalyzed: sessionIds.size,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Recommendation generation timed out. Please try again.')
    }
    throw error
  }
}
```

#### New File: `backend/src/controllers/recommendation.controller.ts`

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { generateRecommendations } from '../services/recommendationEngine'
import { NotFoundError, AuthorizationError, RateLimitError } from '../utils/errors'

// Rate limiting: track requests per project
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10  // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000  // 1 hour in ms

function checkRateLimit(projectId: string): void {
  const now = Date.now()
  const record = requestCounts.get(projectId)

  if (!record || now > record.resetAt) {
    // Start new window
    requestCounts.set(projectId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return
  }

  if (record.count >= RATE_LIMIT) {
    const minutesRemaining = Math.ceil((record.resetAt - now) / (60 * 1000))
    throw new RateLimitError(
      `Rate limit exceeded. Please try again in ${minutesRemaining} minutes.`
    )
  }

  record.count++
}

/**
 * Generate recommendations from testing comments
 * POST /api/projects/:projectId/recommendations
 */
export async function getRecommendations(req: Request, res: Response) {
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

  // Check rate limit (10 requests per hour per project)
  checkRateLimit(projectId)

  const result = await generateRecommendations(projectId)

  res.json({
    ...result,
    generatedAt: new Date().toISOString(),
  })
}

/**
 * Apply a recommendation (returns pre-filled interview data)
 * POST /api/projects/:projectId/recommendations/apply
 */
export async function applyRecommendation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { questionId, suggestedAnswer } = req.body

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

  // Get current interview data
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new NotFoundError('Agent config')
  }

  // Return pre-filled data (don't auto-apply)
  const interviewData = agentConfig.interviewData as Record<string, string>
  const prefilledData = {
    ...interviewData,
    [questionId]: suggestedAnswer,
  }

  res.json({
    prefilledData,
    changedField: questionId,
    previousValue: interviewData[questionId] || '',
    newValue: suggestedAnswer,
  })
}
```

#### New File: `backend/src/routes/recommendation.routes.ts`

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getRecommendations, applyRecommendation } from '../controllers/recommendation.controller'

const router = Router()

router.post('/projects/:projectId/recommendations', authenticate, getRecommendations)
router.post('/projects/:projectId/recommendations/apply', authenticate, applyRecommendation)

export default router
```

#### Register Routes in Express App: `backend/src/index.ts`

```typescript
import recommendationRoutes from './routes/recommendation.routes'

// ... existing route registrations ...

// Register recommendation routes
app.use('/api', recommendationRoutes)
```

### Frontend Implementation

#### Extended: `frontend/src/lib/api.ts`

```typescript
// Recommendation endpoints
async getRecommendations(projectId: string) {
  return this.request<RecommendationResponse>(
    `/api/projects/${projectId}/recommendations`,
    { method: 'POST' }
  )
}

async applyRecommendation(projectId: string, questionId: string, suggestedAnswer: string) {
  return this.request<{
    prefilledData: Record<string, string>
    changedField: string
    previousValue: string
    newValue: string
  }>(
    `/api/projects/${projectId}/recommendations/apply`,
    {
      method: 'POST',
      body: JSON.stringify({ questionId, suggestedAnswer }),
    }
  )
}
```

#### New File: `frontend/src/components/RecommendationPanel.tsx`

```typescript
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface Recommendation {
  id: string
  questionId: string
  questionLabel: string
  currentAnswer: string
  suggestedAnswer: string
  rationale: string
  relatedComments: {
    id: string
    content: string
    messagePreview: string
  }[]
  confidence: 'high' | 'medium' | 'low'
  status: 'pending' | 'applied' | 'dismissed'
}

interface RecommendationPanelProps {
  projectId: string
  onApply: (questionId: string, suggestedAnswer: string) => void
  onClose: () => void
}

export function RecommendationPanel({
  projectId,
  onApply,
  onClose,
}: RecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ totalComments: 0, sessionsAnalyzed: 0 })
  const [expandedRec, setExpandedRec] = useState<string | null>(null)

  useEffect(() => {
    loadRecommendations()
  }, [projectId])

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getRecommendations(projectId)
      setRecommendations(response.recommendations)
      setStats({
        totalComments: response.totalComments,
        sessionsAnalyzed: response.sessionsAnalyzed,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async (rec: Recommendation) => {
    try {
      await api.applyRecommendation(projectId, rec.questionId, rec.suggestedAnswer)
      onApply(rec.questionId, rec.suggestedAnswer)

      // Mark as applied locally
      setRecommendations(
        recommendations.map((r) =>
          r.id === rec.id ? { ...r, status: 'applied' as const } : r
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply recommendation')
    }
  }

  const handleDismiss = (recId: string) => {
    setRecommendations(
      recommendations.map((r) =>
        r.id === recId ? { ...r, status: 'dismissed' as const } : r
      )
    )
  }

  const confidenceColors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800',
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
          <div className="text-gray-600">Analyzing your testing feedback...</div>
          <div className="text-sm text-gray-400 mt-2">This may take up to 10 seconds</div>
        </div>
      </div>
    )
  }

  const pendingRecs = recommendations.filter((r) => r.status === 'pending')

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <p className="text-sm text-gray-500">
            Based on {stats.totalComments} comments across {stats.sessionsAnalyzed} sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRecommendations}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ↻ Regenerate
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {pendingRecs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {recommendations.length === 0
                ? 'No recommendations available. Add more comments during testing.'
                : 'All recommendations have been processed.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRecs.map((rec) => (
              <div
                key={rec.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">
                      {rec.questionLabel}
                    </span>
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        confidenceColors[rec.confidence]
                      }`}
                    >
                      {rec.confidence} confidence
                    </span>
                  </div>
                </div>

                {/* Diff View */}
                <div className="space-y-2 mb-4">
                  <div className="bg-red-50 rounded p-3">
                    <div className="text-xs text-red-600 mb-1">Current</div>
                    <div className="text-sm text-red-900">
                      {rec.currentAnswer || <em className="text-gray-400">Not set</em>}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded p-3">
                    <div className="text-xs text-green-600 mb-1">Suggested</div>
                    <div className="text-sm text-green-900">{rec.suggestedAnswer}</div>
                  </div>
                </div>

                {/* Rationale */}
                <div className="text-sm text-gray-600 mb-3">
                  <strong>Why:</strong> {rec.rationale}
                </div>

                {/* Related Comments (Expandable) */}
                {rec.relatedComments.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() =>
                        setExpandedRec(expandedRec === rec.id ? null : rec.id)
                      }
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {expandedRec === rec.id ? '▼' : '▶'} {rec.relatedComments.length}{' '}
                      related comments
                    </button>
                    {expandedRec === rec.id && (
                      <div className="mt-2 space-y-2">
                        {rec.relatedComments.map((comment) => (
                          <div
                            key={comment.id}
                            className="bg-gray-50 rounded p-2 text-sm"
                          >
                            <div className="text-gray-700">"{comment.content}"</div>
                            <div className="text-xs text-gray-400 mt-1">
                              On: {comment.messagePreview}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleApply(rec)}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Apply to Interview
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-gray-50">
        <p className="text-xs text-gray-500">
          Applying a recommendation will pre-fill the interview form. You can review and edit before saving.
        </p>
      </div>
    </div>
  )
}
```

#### Integration with Testing Dojo

In `TestingDojo.tsx`, add recommendation panel:

```typescript
const [showRecommendations, setShowRecommendations] = useState(false)

// In the Comments Sidebar footer or separate modal
{showRecommendations && (
  <RecommendationPanel
    projectId={projectId}
    onApply={(questionId, suggestedAnswer) => {
      // Navigate to interview with pre-filled data
      // Store in session storage for interview component to read
      sessionStorage.setItem(
        'prefilled_interview',
        JSON.stringify({ questionId, value: suggestedAnswer })
      )
      onNavigateAway?.('interview')
    }}
    onClose={() => setShowRecommendations(false)}
  />
)}

// Add button in sidebar
<button
  onClick={() => setShowRecommendations(true)}
  disabled={!hasComments}
  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
>
  Get Recommendations
</button>
```

#### Integration with AgentInterview

In `AgentInterview.tsx`, check for pre-filled data on mount:

```typescript
useEffect(() => {
  // Check for pre-filled recommendation
  const prefilled = sessionStorage.getItem('prefilled_interview')
  if (prefilled) {
    const { questionId, value } = JSON.parse(prefilled)
    setInterviewData((prev) => ({ ...prev, [questionId]: value }))

    // Find the question index to navigate to
    const questionIndex = questions.findIndex((q) => q.id === questionId)
    if (questionIndex >= 0) {
      setCurrentStep(questionIndex)
    }

    // Clear the prefill data
    sessionStorage.removeItem('prefilled_interview')

    // Show notification
    setNotification('Recommendation applied. Review and save when ready.')
  }
}, [])
```

## User Experience

### Recommendation Flow

```
Testing Dojo
     │
     │ User clicks "Get Recommendations"
     ▼
┌─────────────────────────────────────────┐
│        Recommendation Panel             │
│                                         │
│  Based on 5 comments across 2 sessions  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Communication Style               │  │
│  │ Confidence: HIGH                  │  │
│  │                                   │  │
│  │ Current: "Professional"           │  │
│  │ Suggested: "Professional but..."  │  │
│  │                                   │  │
│  │ Why: 3 comments mentioned...      │  │
│  │ ▶ 3 related comments              │  │
│  │                                   │  │
│  │ [Dismiss] [Apply to Interview]    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Content Emphasis                  │  │
│  │ ...                               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [↻ Regenerate]                [Close]  │
└─────────────────────────────────────────┘
     │
     │ User clicks "Apply to Interview"
     ▼
AgentInterview (pre-filled with suggestion)
     │
     │ User reviews and saves
     ▼
Profile auto-regenerates
```

## Testing Strategy

### Unit Tests

```typescript
describe('recommendationEngine', () => {
  describe('generateRecommendations', () => {
    // Purpose: Verify comment aggregation
    it('should aggregate comments across sessions', async () => {
      // Create test data with multiple sessions
      const result = await generateRecommendations(projectId)
      expect(result.sessionsAnalyzed).toBe(2)
    })

    // Purpose: Verify empty handling
    it('should return empty array when no comments', async () => {
      const result = await generateRecommendations(emptyProjectId)
      expect(result.recommendations).toHaveLength(0)
    })

    // Purpose: Verify LLM response parsing
    it('should parse LLM response into structured recommendations', async () => {
      const result = await generateRecommendations(projectId)
      expect(result.recommendations[0]).toHaveProperty('questionId')
      expect(result.recommendations[0]).toHaveProperty('suggestedAnswer')
      expect(result.recommendations[0]).toHaveProperty('rationale')
    })
  })
})
```

### Integration Tests

```typescript
describe('Recommendation API', () => {
  // Purpose: Verify full flow
  it('should generate recommendations from project comments', async () => {
    // Setup: Create project, session, messages, comments

    const response = await request(app)
      .post(`/api/projects/${projectId}/recommendations`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.recommendations).toBeDefined()
    expect(response.body.totalComments).toBeGreaterThan(0)
  })

  // Purpose: Verify apply flow
  it('should return pre-filled data on apply', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/recommendations/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: 'tone',
        suggestedAnswer: 'More casual tone',
      })

    expect(response.body.prefilledData.tone).toBe('More casual tone')
    expect(response.body.changedField).toBe('tone')
  })
})
```

### E2E Tests

```typescript
test('should apply recommendation to interview', async ({ page }) => {
  // Add some comments first
  // ... navigate to test, send messages, add comments

  // Get recommendations
  await page.click('[data-testid="get-recommendations"]')

  // Wait for recommendations to load
  await expect(page.locator('[data-testid="recommendation-card"]')).toBeVisible()

  // Apply first recommendation
  await page.click('[data-testid="apply-recommendation"]')

  // Should be on interview with pre-filled value
  await expect(page.locator('[data-testid="interview-input"]')).toHaveValue(
    /more casual/i
  )
})
```

## Performance Considerations

- **LLM Latency**: Target < 10 seconds; use GPT-4-turbo
- **Comment Limit**: Process max 50 most recent comments if more exist
- **Caching**: Don't cache (recommendations should be fresh)
- **Timeout**: 30 second timeout on recommendation generation

## Security Considerations

- All endpoints verify project ownership
- No PII in recommendation prompts (only comment content)
- LLM outputs validated before returning to client
- Rate limiting: 10 recommendation requests per hour per project

## Documentation

- Add recommendation workflow to user guide
- Document confidence levels and their meaning
- Document diff preview and apply workflow

## Implementation Phases

### Phase 1: Backend Engine
- Implement recommendationEngine.ts
- Add controller and routes
- Unit tests for engine
- Integration tests for API

### Phase 2: Frontend Panel
- Create RecommendationPanel component
- Add to Testing Dojo
- Loading and error states
- Diff preview UI

### Phase 3: Apply Flow
- Session storage for pre-fill
- AgentInterview integration
- Notification after apply
- E2E tests

## Open Questions

1. **Resolved**: Auto-apply vs pre-fill → Pre-fill with review
2. **Future**: Learn from acceptance patterns → Out of scope for MVP
3. **Future**: Real-time recommendations → Out of scope

## References

- Ideation: `docs/ideation/ai-agent-testing-dojo-with-profile.md`
- Testing Dojo spec: `specs/feat-testing-dojo-sessions-comments.md`
- Profile spec: `specs/feat-ai-agent-profile-synthesis.md`
- Agent controller: `backend/src/controllers/agent.controller.ts`
