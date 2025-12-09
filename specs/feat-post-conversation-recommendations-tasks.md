# Task Breakdown: Post-Conversation Recommendations & Leave Message

**Generated:** 2025-12-07
**Source:** specs/feat-post-conversation-recommendations.md

---

## Overview

Enhance conversation end experience with Leave Message Modal for recipient feedback and AI-generated recommendations for document improvements. Closes the feedback loop between audience interactions and document refinement.

---

## Phase 1: Foundation (Database & Models)

### Task 1.1: Add Database Schema Changes

**Description**: Add RecipientMessage and ConversationRecommendation models
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (must complete first)

**Technical Requirements**:

Add to `backend/prisma/schema.prisma`:

```prisma
model RecipientMessage {
  id             String       @id @default(cuid())
  conversationId String       @unique
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  content        String       @db.Text

  // Metadata
  viewerEmail    String?
  viewerName     String?

  createdAt      DateTime     @default(now())

  @@index([conversationId])
  @@map("recipient_messages")
}

model ConversationRecommendation {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  // Recommendation type
  type           String       // "document_update" | "consideration" | "follow_up"

  // Target (for document_update type)
  targetDocumentId String?
  targetDocument   Document?  @relation(fields: [targetDocumentId], references: [id])
  targetSectionId  String?    // Section within document
  targetChunkId    String?    // Specific chunk

  // Content
  title           String                  // "Clarify revenue assumptions"
  description     String       @db.Text   // 1-2 sentence summary
  proposedContent String?      @db.Text   // Production-ready content (for document_update)
  changeHighlight String?      @db.Text   // Just the delta for preview

  // Evidence from conversation
  evidenceQuotes  Json                    // Array of exact conversation excerpts
  reasoning       String       @db.Text   // Why this change is warranted

  // Scoring
  confidence      Float                   // 0.0 to 1.0
  impactLevel     String                  // "low" | "medium" | "high"
  priority        Int          @default(0)

  // Workflow
  status          String       @default("pending")  // pending | approved | rejected | applied
  reviewedAt      DateTime?
  appliedAt       DateTime?
  appliedToVersion Int?        // Link to DocumentVersion if applied

  createdAt       DateTime     @default(now())

  @@index([conversationId])
  @@index([targetDocumentId])
  @@index([status])
  @@map("conversation_recommendations")
}
```

Modify Conversation model:
```prisma
model Conversation {
  // ... existing fields ...

  // Add relations
  recipientMessage    RecipientMessage?
  recommendations     ConversationRecommendation[]

  // ... existing relations ...
}
```

Add relation to Document model:
```prisma
model Document {
  // ... existing fields ...

  // Add relation
  recommendations ConversationRecommendation[]

  // ... existing relations ...
}
```

**Implementation Steps**:
1. Edit `backend/prisma/schema.prisma`
2. Add RecipientMessage model
3. Add ConversationRecommendation model
4. Add relations to Conversation and Document
5. Run `cd backend && npm run db:push`
6. Verify with `npx prisma studio`

**Acceptance Criteria**:
- [ ] RecipientMessage model created with unique conversationId
- [ ] ConversationRecommendation model created with all fields
- [ ] Cascade delete configured for both models
- [ ] Indices created for performance
- [ ] `npm run db:push` completes without errors

---

### Task 1.2: Create TypeScript Types

**Description**: Create shared TypeScript types for recommendations
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3

**Technical Requirements**:

Create `backend/src/types/recommendation.ts`:

```typescript
export type RecommendationType = 'document_update' | 'consideration' | 'follow_up'
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'applied'
export type ImpactLevel = 'low' | 'medium' | 'high'

export interface RecommendationInput {
  type: RecommendationType
  targetDocumentId: string | null
  targetSectionId: string | null
  title: string
  description: string
  proposedContent: string | null
  changeHighlight: string | null
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  impactLevel: ImpactLevel
}

export interface RecommendationOutput {
  id: string
  conversationId: string
  type: RecommendationType
  targetDocumentId: string | null
  targetDocument?: {
    id: string
    filename: string
  }
  targetSectionId: string | null
  title: string
  description: string
  proposedContent: string | null
  changeHighlight: string | null
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  impactLevel: ImpactLevel
  status: RecommendationStatus
  reviewedAt: string | null
  appliedAt: string | null
  appliedToVersion: number | null
  createdAt: string
}

export interface RecipientMessageOutput {
  id: string
  content: string
  viewerEmail: string | null
  viewerName: string | null
  createdAt: string
}

export interface GeneratedRecommendations {
  recommendations: RecommendationInput[]
  noRecommendationsReason?: string | null
}
```

**Acceptance Criteria**:
- [ ] All types exported
- [ ] Types match Prisma schema
- [ ] No TypeScript errors

---

## Phase 2: Leave Message Feature

### Task 2.1: Create LeaveMessageModal Component

**Description**: Build frontend modal for recipient feedback
**Size**: Medium
**Priority**: High
**Dependencies**: None (can start immediately)
**Can run parallel with**: Task 1.1, 1.2

**Technical Requirements**:

Create `frontend/src/components/LeaveMessageModal.tsx`:

```typescript
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare } from 'lucide-react'

interface LeaveMessageModalProps {
  isOpen: boolean
  senderName: string
  onSubmit: (message: string) => void
  onSkip: () => void
}

export function LeaveMessageModal({
  isOpen,
  senderName,
  onSubmit,
  onSkip
}: LeaveMessageModalProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) {
      onSkip()
      return
    }
    setIsSubmitting(true)
    try {
      onSubmit(message.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  const characterCount = message.length
  const maxCharacters = 2000

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <DialogTitle>Before you go...</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-muted-foreground">
            Is there anything specific you'd like me to share with{' '}
            <span className="font-medium text-foreground">{senderName}</span>{' '}
            now that you've explored this document capsule?
          </p>

          <Textarea
            placeholder="Share your thoughts, questions, or feedback..."
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxCharacters))}
            rows={5}
            className="resize-none"
          />

          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Examples: Feedback, questions for follow-up, clarifications you'd like, suggestions...
            </span>
            <span className={characterCount > maxCharacters * 0.9 ? 'text-orange-500' : ''}>
              {characterCount}/{maxCharacters}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria**:
- [ ] Modal renders with sender name
- [ ] Textarea with 2000 character limit
- [ ] Character counter shown
- [ ] Skip button works
- [ ] Send button submits message
- [ ] Modal cannot be dismissed by clicking outside

---

### Task 2.2: Modify EndSessionModal Flow

**Description**: Integrate LeaveMessageModal into end session flow
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.3

**Technical Requirements**:

Modify `frontend/src/components/EndSessionModal.tsx`:

```typescript
import { useState } from 'react'
import { LeaveMessageModal } from './LeaveMessageModal'
// ... existing imports

interface EndSessionFlowProps {
  isOpen: boolean
  onClose: () => void
  onEndSession: (recipientMessage?: string) => Promise<void>
  senderName: string
  // ... existing props
}

export function EndSessionFlow({
  isOpen,
  onClose,
  onEndSession,
  senderName,
  ...existingProps
}: EndSessionFlowProps) {
  const [step, setStep] = useState<'message' | 'confirm' | 'done'>('message')
  const [recipientMessage, setRecipientMessage] = useState<string | null>(null)

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('message')
      setRecipientMessage(null)
    }
  }, [isOpen])

  const handleMessageSubmit = (message: string) => {
    setRecipientMessage(message)
    setStep('confirm')
  }

  const handleMessageSkip = () => {
    setRecipientMessage(null)
    setStep('confirm')
  }

  const handleConfirm = async () => {
    await onEndSession(recipientMessage || undefined)
    setStep('done')
  }

  if (!isOpen) return null

  return (
    <>
      {step === 'message' && (
        <LeaveMessageModal
          isOpen={true}
          senderName={senderName}
          onSubmit={handleMessageSubmit}
          onSkip={handleMessageSkip}
        />
      )}

      {step === 'confirm' && (
        <Dialog open={true} onOpenChange={onClose}>
          {/* Existing EndSessionModal content */}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End Session?</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to end this session?</p>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleConfirm}>End Session</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {step === 'done' && (
        // Existing post-session content (register/login options)
        <ExistingPostSessionContent {...existingProps} />
      )}
    </>
  )
}
```

**Acceptance Criteria**:
- [ ] Leave message modal shows FIRST when ending session
- [ ] Message or skip leads to confirmation
- [ ] recipientMessage passed to endConversation API
- [ ] Flow resets when modal reopens

---

### Task 2.3: Add Message Storage to End Conversation Endpoint

**Description**: Modify end conversation endpoint to store recipient message
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.2

**Technical Requirements**:

Modify `backend/src/controllers/conversation.controller.ts`:

```typescript
/**
 * End a conversation and generate AI summary
 * POST /api/conversations/:id/end
 *
 * Modified to also store recipient message
 */
export async function endConversation(req: Request, res: Response) {
  const { id } = req.params
  const { recipientMessage } = req.body  // NEW

  // Validate id is a valid CUID
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(id)) {
    throw new ValidationError('Invalid conversation ID format')
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          content: true,
        },
      },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Idempotent - if already ended, return existing data
  if (conversation.endedAt) {
    const existingRecommendations = await prisma.conversationRecommendation.count({
      where: { conversationId: id }
    })

    res.json({
      conversation: {
        id: conversation.id,
        endedAt: conversation.endedAt,
        durationSeconds: conversation.durationSeconds,
        summary: conversation.summary,
        sentiment: conversation.sentiment,
        topics: conversation.topics,
      },
      summary: conversation.summary,
      recommendationCount: existingRecommendations,  // NEW
    })
    return
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
    try {
      const analysis = await generateConversationSummary(conversation.messages)
      summary = analysis.summary
      sentiment = analysis.sentiment
      topics = analysis.topics
    } catch (error) {
      console.error('Failed to generate conversation summary:', error)
    }
  }

  // Store recipient message if provided (NEW)
  if (recipientMessage && typeof recipientMessage === 'string' && recipientMessage.trim()) {
    const trimmedMessage = recipientMessage.trim().slice(0, 2000)
    await prisma.recipientMessage.create({
      data: {
        conversationId: id,
        content: trimmedMessage,
        viewerEmail: conversation.viewerEmail,
        viewerName: conversation.viewerName,
      }
    })
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

  // Generate recommendations asynchronously (NEW)
  let recommendationCount = 0
  if (conversation.messages.length >= 5) {
    try {
      const recommendations = await generateRecommendations(id)
      recommendationCount = recommendations.length
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
    }
  }

  res.json({
    conversation: {
      id: updated.id,
      endedAt: updated.endedAt,
      durationSeconds: updated.durationSeconds,
      summary: updated.summary,
      sentiment: updated.sentiment,
      topics: updated.topics,
    },
    summary: updated.summary,
    recommendationCount,  // NEW
  })
}
```

**Acceptance Criteria**:
- [ ] recipientMessage stored in database if provided
- [ ] Message trimmed to 2000 characters
- [ ] viewerEmail and viewerName captured from conversation
- [ ] recommendationCount returned in response
- [ ] No errors if message is null/undefined

---

## Phase 3: Recommendation Generation

### Task 3.1: Create Recommendation Generator Service

**Description**: Build AI service for generating recommendations from conversations
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: Phase 2 tasks

**Technical Requirements**:

Create `backend/src/services/recommendationGenerator.ts`:

```typescript
import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { prisma } from '../utils/prisma'
import { RecommendationInput, GeneratedRecommendations } from '../types/recommendation'

const openai = new OpenAI()

const recommendationSchema = z.object({
  recommendations: z.array(z.object({
    type: z.enum(['document_update', 'consideration', 'follow_up']),
    targetDocumentId: z.string().nullable(),
    targetSectionId: z.string().nullable(),
    title: z.string(),
    description: z.string(),
    proposedContent: z.string().nullable(),
    changeHighlight: z.string().nullable(),
    evidenceQuotes: z.array(z.string()),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
    impactLevel: z.enum(['low', 'medium', 'high']),
  })),
  noRecommendationsReason: z.string().nullable().optional(),
})

const RECOMMENDATION_SYSTEM_PROMPT = `You are an expert analyst who reviews conversations between viewers and AI agents discussing documents.

Your task is to identify actionable improvements based on:
1. Questions that weren't fully answered
2. Confusion or misunderstanding expressed by the viewer
3. Topics the viewer asked about repeatedly
4. Gaps between what the viewer needed and what documents provide

Generate recommendations that help the document sender improve their materials.`

function buildRecommendationPrompt(
  messages: Array<{ role: string; content: string }>,
  documents: Array<{ id: string; filename: string; outline: any }>
): string {
  const transcript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const documentsList = documents
    .map(d => {
      const sections = d.outline?.map((s: any) => s.title).join(', ') || 'No sections'
      return `- ${d.filename} (ID: ${d.id})\n  Sections: ${sections}`
    })
    .join('\n')

  return `## Conversation Transcript

${transcript}

## Available Documents

${documentsList}

## Your Task

Analyze the conversation and generate recommendations for the document sender.

For each recommendation, provide:

1. **type**: One of:
   - "document_update": Specific change to document content
   - "consideration": General insight for sender to consider
   - "follow_up": Suggested follow-up action with viewer

2. **targetDocumentId** and **targetSectionId**: For document_update type only

3. **title**: Clear 5-10 word title

4. **description**: 1-2 sentence summary

5. **proposedContent**: For document_update type, provide COMPLETE production-ready text to add or replace. This should be usable immediately without further editing.

6. **changeHighlight**: For document_update type, just the new/changed portion for quick preview

7. **evidenceQuotes**: 2-3 EXACT quotes from the conversation that support this recommendation. Copy verbatim.

8. **reasoning**: Explain why this recommendation will help

9. **confidence**: 0.0 to 1.0 score
   - 0.9-1.0: Very clear signal from conversation
   - 0.7-0.9: Strong evidence
   - 0.5-0.7: Moderate evidence
   - 0.3-0.5: Weak evidence
   - Below 0.3: Speculative

10. **impactLevel**: low, medium, or high

CRITICAL RULES:
- proposedContent must be PRODUCTION-READY, not placeholder text
- evidenceQuotes must be EXACT matches from the transcript
- Generate 0-5 recommendations (quality over quantity)
- If no recommendations are warranted, explain why in noRecommendationsReason

Return valid JSON.`
}

/**
 * Generate recommendations for a conversation
 */
export async function generateRecommendations(
  conversationId: string
): Promise<{ id: string }[]> {
  console.log(`Generating recommendations for conversation ${conversationId}`)

  // 1. Load conversation with messages and project documents
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true }
      },
      project: {
        include: {
          documents: {
            select: { id: true, filename: true, outline: true }
          }
        }
      }
    }
  })

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`)
  }

  // Skip if < 5 messages
  if (conversation.messages.length < 5) {
    console.log(`Skipping recommendations: only ${conversation.messages.length} messages`)
    return []
  }

  // 2. Build prompt
  const prompt = buildRecommendationPrompt(
    conversation.messages,
    conversation.project.documents
  )

  // 3. Call GPT-4o with structured output
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: RECOMMENDATION_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recommendations',
        schema: zodResponseFormat(recommendationSchema, 'recommendations').json_schema.schema,
        strict: true
      }
    },
    temperature: 0.7
  })

  // 4. Parse and validate
  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No content in OpenAI response')
  }

  const parsed = recommendationSchema.parse(JSON.parse(content))

  // 5. Filter by confidence threshold
  const MIN_CONFIDENCE = 0.4
  const filtered = parsed.recommendations.filter(r => r.confidence >= MIN_CONFIDENCE)

  if (filtered.length === 0) {
    console.log(`No recommendations above confidence threshold for ${conversationId}`)
    return []
  }

  // 6. Validate evidence quotes exist in conversation
  const transcript = conversation.messages.map(m => m.content).join(' ')
  filtered.forEach(rec => {
    rec.evidenceQuotes = rec.evidenceQuotes.filter(quote => {
      const exists = transcript.toLowerCase().includes(quote.toLowerCase().slice(0, 50))
      if (!exists) {
        console.warn(`Quote not found in transcript: "${quote.slice(0, 50)}..."`)
      }
      return exists
    })
  })

  // 7. Store in database
  const created = await prisma.$transaction(
    filtered.map((rec, index) =>
      prisma.conversationRecommendation.create({
        data: {
          conversationId,
          type: rec.type,
          targetDocumentId: rec.targetDocumentId,
          targetSectionId: rec.targetSectionId,
          title: rec.title,
          description: rec.description,
          proposedContent: rec.proposedContent,
          changeHighlight: rec.changeHighlight,
          evidenceQuotes: rec.evidenceQuotes,
          reasoning: rec.reasoning,
          confidence: rec.confidence,
          impactLevel: rec.impactLevel,
          priority: index,
          status: 'pending'
        },
        select: { id: true }
      })
    )
  )

  console.log(`Created ${created.length} recommendations for ${conversationId}`)
  return created
}
```

**Acceptance Criteria**:
- [ ] Loads conversation with messages and documents
- [ ] Skips conversations with < 5 messages
- [ ] Uses GPT-4o with structured output
- [ ] Filters by 0.4 confidence threshold
- [ ] Validates evidence quotes exist (partial match)
- [ ] Stores recommendations in database
- [ ] Returns created recommendation IDs

---

### Task 3.2: Create Recommendation Controller

**Description**: Build API endpoints for recommendations
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.3

**Technical Requirements**:

Create `backend/src/controllers/recommendation.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'

/**
 * Get recommendations for a conversation
 * GET /api/conversations/:id/recommendations
 */
export async function getRecommendations(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify conversation exists and user is project owner
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      project: { select: { ownerId: true } }
    }
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can view recommendations')
  }

  const recommendations = await prisma.conversationRecommendation.findMany({
    where: { conversationId: id },
    orderBy: [{ priority: 'asc' }, { confidence: 'desc' }],
    include: {
      targetDocument: {
        select: { id: true, filename: true }
      }
    }
  })

  res.json({
    recommendations: recommendations.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      proposedContent: r.proposedContent,
      changeHighlight: r.changeHighlight,
      evidenceQuotes: r.evidenceQuotes,
      reasoning: r.reasoning,
      confidence: r.confidence,
      impactLevel: r.impactLevel,
      status: r.status,
      targetDocument: r.targetDocument,
      targetSectionId: r.targetSectionId,
      reviewedAt: r.reviewedAt?.toISOString() || null,
      appliedAt: r.appliedAt?.toISOString() || null,
      appliedToVersion: r.appliedToVersion,
      createdAt: r.createdAt.toISOString()
    }))
  })
}

/**
 * Apply a recommendation
 * POST /api/recommendations/:id/apply
 */
export async function applyRecommendation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Load recommendation with conversation and project info
  const recommendation = await prisma.conversationRecommendation.findUnique({
    where: { id },
    include: {
      conversation: {
        include: {
          project: { select: { id: true, ownerId: true } }
        }
      },
      targetDocument: { select: { id: true, isEditable: true, currentVersion: true } }
    }
  })

  if (!recommendation) {
    throw new NotFoundError('Recommendation')
  }

  if (recommendation.conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can apply recommendations')
  }

  if (recommendation.status !== 'pending') {
    throw new ValidationError(`Recommendation is already ${recommendation.status}`)
  }

  // For document_update type, update the document
  let appliedToVersion: number | null = null

  if (recommendation.type === 'document_update' && recommendation.targetDocument) {
    if (!recommendation.targetDocument.isEditable) {
      throw new ValidationError('Target document is not editable')
    }

    if (!recommendation.proposedContent) {
      throw new ValidationError('Recommendation has no proposed content')
    }

    // Import document versioning service
    const { createDocumentVersion, plainTextToTipTap } = await import('../services/documentVersioning')

    // Create new version with proposed content
    const content = plainTextToTipTap(recommendation.proposedContent)
    const { version } = await createDocumentVersion(
      recommendation.targetDocument.id,
      content,
      req.user.userId,
      `Applied recommendation: ${recommendation.title}`,
      'recommendation',
      recommendation.id
    )

    appliedToVersion = version.version
  }

  // Update recommendation status
  const updated = await prisma.conversationRecommendation.update({
    where: { id },
    data: {
      status: 'applied',
      reviewedAt: new Date(),
      appliedAt: new Date(),
      appliedToVersion
    }
  })

  res.json({
    success: true,
    recommendation: {
      id: updated.id,
      status: updated.status,
      appliedAt: updated.appliedAt?.toISOString(),
      appliedToVersion: updated.appliedToVersion
    },
    documentVersion: appliedToVersion ? {
      version: appliedToVersion
    } : undefined
  })
}

/**
 * Dismiss a recommendation
 * POST /api/recommendations/:id/dismiss
 */
export async function dismissRecommendation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Load recommendation
  const recommendation = await prisma.conversationRecommendation.findUnique({
    where: { id },
    include: {
      conversation: {
        include: {
          project: { select: { ownerId: true } }
        }
      }
    }
  })

  if (!recommendation) {
    throw new NotFoundError('Recommendation')
  }

  if (recommendation.conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can dismiss recommendations')
  }

  if (recommendation.status !== 'pending') {
    throw new ValidationError(`Recommendation is already ${recommendation.status}`)
  }

  const updated = await prisma.conversationRecommendation.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedAt: new Date()
    }
  })

  res.json({
    success: true,
    recommendation: {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString()
    }
  })
}
```

Create `backend/src/routes/recommendation.routes.ts`:

```typescript
import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { authenticate } from '../middleware/auth'
import {
  getRecommendations,
  applyRecommendation,
  dismissRecommendation
} from '../controllers/recommendation.controller'

const router = Router()

// Conversation recommendations
router.get('/conversations/:id/recommendations', authenticate, asyncHandler(getRecommendations))

// Recommendation actions
router.post('/recommendations/:id/apply', authenticate, asyncHandler(applyRecommendation))
router.post('/recommendations/:id/dismiss', authenticate, asyncHandler(dismissRecommendation))

export default router
```

Register routes in `backend/src/index.ts`:
```typescript
import recommendationRoutes from './routes/recommendation.routes'
// ...
app.use('/api', recommendationRoutes)
```

**Acceptance Criteria**:
- [ ] GET recommendations returns list for conversation
- [ ] Apply creates document version for document_update type
- [ ] Apply links recommendation to version
- [ ] Dismiss sets status to rejected
- [ ] All endpoints require authentication
- [ ] All endpoints verify project ownership
- [ ] Cannot apply/dismiss non-pending recommendations

---

## Phase 4: Recommendation UI

### Task 4.1: Create RecommendationCard Component

**Description**: Build UI component for displaying single recommendation
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Task 4.2

**Technical Requirements**:

Create `frontend/src/components/RecommendationCard.tsx`:

```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FileEdit, Lightbulb, UserPlus, ChevronDown, ChevronUp,
  Check, X, ExternalLink
} from 'lucide-react'

interface RecommendationCardProps {
  recommendation: {
    id: string
    type: 'document_update' | 'consideration' | 'follow_up'
    title: string
    description: string
    proposedContent: string | null
    changeHighlight: string | null
    evidenceQuotes: string[]
    reasoning: string
    confidence: number
    impactLevel: 'low' | 'medium' | 'high'
    status: 'pending' | 'approved' | 'rejected' | 'applied'
    targetDocument?: { id: string; filename: string }
    targetSectionId: string | null
  }
  onApply: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}

const typeConfig = {
  document_update: { icon: FileEdit, label: 'Document Update', color: 'bg-blue-100 text-blue-800' },
  consideration: { icon: Lightbulb, label: 'Consideration', color: 'bg-yellow-100 text-yellow-800' },
  follow_up: { icon: UserPlus, label: 'Follow-up', color: 'bg-green-100 text-green-800' }
}

const impactColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800'
}

export function RecommendationCard({
  recommendation,
  onApply,
  onDismiss
}: RecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  const config = typeConfig[recommendation.type]
  const Icon = config.icon

  const handleApply = async () => {
    setIsApplying(true)
    try {
      await onApply(recommendation.id)
    } finally {
      setIsApplying(false)
    }
  }

  const handleDismiss = async () => {
    setIsDismissing(true)
    try {
      await onDismiss(recommendation.id)
    } finally {
      setIsDismissing(false)
    }
  }

  const isPending = recommendation.status === 'pending'

  return (
    <div className="border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge className={config.color}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          <Badge variant="outline">
            {Math.round(recommendation.confidence * 100)}% Confidence
          </Badge>
          <Badge className={impactColors[recommendation.impactLevel]}>
            Impact: {recommendation.impactLevel.toUpperCase()}
          </Badge>
        </div>
        {!isPending && (
          <Badge variant={recommendation.status === 'applied' ? 'default' : 'secondary'}>
            {recommendation.status}
          </Badge>
        )}
      </div>

      {/* Title and Description */}
      <h4 className="font-medium mb-1">{recommendation.title}</h4>
      <p className="text-sm text-muted-foreground mb-3">{recommendation.description}</p>

      {/* Target Document */}
      {recommendation.targetDocument && (
        <div className="text-sm text-muted-foreground mb-3">
          Target: {recommendation.targetDocument.filename}
          {recommendation.targetSectionId && ` → ${recommendation.targetSectionId}`}
        </div>
      )}

      {/* Expandable Details */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            {isExpanded ? 'Hide details' : 'Show details'}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Evidence Quotes */}
          {recommendation.evidenceQuotes.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Evidence from conversation:</h5>
              <div className="space-y-2">
                {recommendation.evidenceQuotes.map((quote, i) => (
                  <blockquote key={i} className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                    "{quote}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Change */}
          {recommendation.proposedContent && (
            <div>
              <h5 className="text-sm font-medium mb-2">Proposed change:</h5>
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm whitespace-pre-wrap">
                {recommendation.changeHighlight || recommendation.proposedContent}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <h5 className="text-sm font-medium mb-2">Reasoning:</h5>
            <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
          {recommendation.targetDocument && (
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Document
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDismiss} disabled={isDismissing}>
            <X className="h-4 w-4 mr-2" />
            {isDismissing ? 'Dismissing...' : 'Dismiss'}
          </Button>
          {recommendation.type === 'document_update' && (
            <Button size="sm" onClick={handleApply} disabled={isApplying}>
              <Check className="h-4 w-4 mr-2" />
              {isApplying ? 'Applying...' : 'Approve & Apply'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Type badge with correct icon and color
- [ ] Confidence percentage displayed
- [ ] Impact level badge
- [ ] Expandable evidence quotes
- [ ] Proposed change preview
- [ ] Reasoning section
- [ ] Apply/Dismiss buttons for pending
- [ ] Status badge for non-pending

---

### Task 4.2: Create ConversationRecommendations Component

**Description**: Build container component for recommendations list
**Size**: Medium
**Priority**: High
**Dependencies**: Task 4.1
**Can run parallel with**: Task 4.3

**Technical Requirements**:

Create `frontend/src/components/ConversationRecommendations.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Lightbulb, Loader2 } from 'lucide-react'
import { RecommendationCard } from './RecommendationCard'
import { api } from '@/lib/api'

interface Recommendation {
  id: string
  type: 'document_update' | 'consideration' | 'follow_up'
  title: string
  description: string
  proposedContent: string | null
  changeHighlight: string | null
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  impactLevel: 'low' | 'medium' | 'high'
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  targetDocument?: { id: string; filename: string }
  targetSectionId: string | null
}

interface ConversationRecommendationsProps {
  conversationId: string
  projectId: string
  onApply?: (recommendationId: string) => void
}

export function ConversationRecommendations({
  conversationId,
  projectId,
  onApply
}: ConversationRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRecommendations()
  }, [conversationId])

  async function loadRecommendations() {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/conversations/${conversationId}/recommendations`)
      setRecommendations(response.data.recommendations)
    } catch (err) {
      console.error('Failed to load recommendations:', err)
      setError('Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(id: string) {
    try {
      await api.post(`/recommendations/${id}/apply`)
      await loadRecommendations()
      onApply?.(id)
    } catch (err) {
      console.error('Failed to apply recommendation:', err)
    }
  }

  async function handleDismiss(id: string) {
    try {
      await api.post(`/recommendations/${id}/dismiss`)
      await loadRecommendations()
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {error}
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recommendations for this conversation</p>
      </div>
    )
  }

  const pendingCount = recommendations.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Recommendations ({recommendations.length})
        </h3>
        {pendingCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {pendingCount} pending review
          </span>
        )}
      </div>

      <div className="space-y-4">
        {recommendations.map(rec => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onApply={handleApply}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Loads recommendations on mount
- [ ] Shows loading spinner
- [ ] Shows error state
- [ ] Shows empty state with icon
- [ ] Lists all recommendations
- [ ] Shows pending count
- [ ] Refreshes after apply/dismiss

---

### Task 4.3: Create RecipientMessageDisplay Component

**Description**: Build component to show recipient's direct message
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 4.1, 4.2

**Technical Requirements**:

Create `frontend/src/components/RecipientMessageDisplay.tsx`:

```typescript
import { format } from 'date-fns'
import { Mail } from 'lucide-react'

interface RecipientMessageDisplayProps {
  message: {
    content: string
    viewerName?: string | null
    viewerEmail?: string | null
    createdAt: string
  }
}

export function RecipientMessageDisplay({ message }: RecipientMessageDisplayProps) {
  const senderIdentity = message.viewerName || message.viewerEmail || 'Viewer'

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-full">
          <Mail className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-blue-900">
              Message from {senderIdentity}
            </h4>
            <span className="text-sm text-blue-600">
              {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
          <p className="text-blue-800 whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Shows message with envelope icon
- [ ] Displays viewer name/email or "Viewer"
- [ ] Shows formatted timestamp
- [ ] Preserves whitespace in message

---

### Task 4.4: Integrate into AnalyticsDashboard

**Description**: Add recommendations and message to conversation detail view
**Size**: Medium
**Priority**: High
**Dependencies**: Task 4.2, Task 4.3
**Can run parallel with**: None

**Technical Requirements**:

Modify `frontend/src/components/AnalyticsDashboard.tsx`:

```typescript
import { ConversationRecommendations } from './ConversationRecommendations'
import { RecipientMessageDisplay } from './RecipientMessageDisplay'

// In conversation detail view section:
function ConversationDetailView({ conversation, projectId }) {
  return (
    <div className="space-y-6">
      {/* Existing: Conversation Summary */}
      <section>
        <h3 className="text-lg font-medium mb-4">Summary</h3>
        <p className="text-muted-foreground">{conversation.summary}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span>Sentiment: {conversation.sentiment}</span>
          <span>Topics: {conversation.topics?.join(', ')}</span>
        </div>
      </section>

      {/* NEW: Recipient Message (if exists) */}
      {conversation.recipientMessage && (
        <section>
          <RecipientMessageDisplay message={conversation.recipientMessage} />
        </section>
      )}

      {/* NEW: AI Recommendations */}
      <section>
        <ConversationRecommendations
          conversationId={conversation.id}
          projectId={projectId}
          onApply={(id) => {
            // Optional: show toast or refresh document list
            console.log('Recommendation applied:', id)
          }}
        />
      </section>

      {/* Existing: Message transcript, etc. */}
    </div>
  )
}
```

Also update API call to include recipientMessage:

```typescript
// When fetching conversation detail, include recipientMessage
const conversation = await api.get(`/conversations/${id}`)
// Ensure backend returns: conversation.recipientMessage
```

**Acceptance Criteria**:
- [ ] Recipient message shown if exists
- [ ] Recommendations section shows below summary
- [ ] Apply callback triggers refresh
- [ ] Layout flows naturally

---

## Testing Tasks

### Task T.1: Backend Unit Tests

**Description**: Write tests for recommendation generator
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1

Create `backend/src/services/__tests__/recommendationGenerator.test.ts`:

```typescript
import { generateRecommendations } from '../recommendationGenerator'

describe('RecommendationGenerator', () => {
  describe('generateRecommendations', () => {
    it('should skip conversations with < 5 messages', async () => {
      // Create conversation with 3 messages
      // Call generateRecommendations
      // Expect empty array
    })

    it('should filter out low-confidence recommendations', async () => {
      // Mock OpenAI response with low confidence items
      // Call generateRecommendations
      // Expect filtered results
    })

    it('should validate evidence quotes exist in transcript', async () => {
      // Mock response with fake quotes
      // Call generateRecommendations
      // Expect quotes to be filtered out
    })
  })
})
```

**Acceptance Criteria**:
- [ ] Tests for < 5 message skip
- [ ] Tests for confidence filtering
- [ ] Tests for quote validation

---

### Task T.2: Integration Tests

**Description**: Write API integration tests
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2

Create `backend/src/controllers/__tests__/recommendation.controller.test.ts`:

```typescript
describe('Recommendation API', () => {
  describe('GET /api/conversations/:id/recommendations', () => {
    it('should return recommendations for conversation', async () => {
      // Create conversation and recommendations
      // GET /api/conversations/:id/recommendations
      // Expect recommendations array
    })

    it('should reject non-owner requests', async () => {
      // Create as user A, request as user B
      // Expect 403
    })
  })

  describe('POST /api/recommendations/:id/apply', () => {
    it('should apply document_update recommendation', async () => {
      // Create recommendation
      // POST apply
      // Expect new document version
    })

    it('should reject already-applied recommendations', async () => {
      // Apply once, try again
      // Expect error
    })
  })

  describe('POST /api/recommendations/:id/dismiss', () => {
    it('should set status to rejected', async () => {
      // Create recommendation
      // POST dismiss
      // Expect status: rejected
    })
  })
})
```

**Acceptance Criteria**:
- [ ] GET recommendations tested
- [ ] Apply tested with document version creation
- [ ] Dismiss tested
- [ ] Authorization tested

---

## Dependency Graph

```
Task 1.1 (Schema) ──┬──→ Task 1.2 (Types) ──→ Task 3.1 (Generator)
                    │                              │
                    └──→ Task 2.3 (End API)        └──→ Task 3.2 (Controller)
                                                        │
Task 2.1 (Modal) ──→ Task 2.2 (Flow)                    └──→ Task 4.1 (Card)
                                                             │
                                                             └──→ Task 4.2 (List)
                                                                  │
Task 4.3 (Message) ─────────────────────────────────────────────→ Task 4.4 (Dashboard)
```

## Parallel Execution Opportunities

- Task 2.1 can start immediately (no backend dependency)
- Task 1.2 + Task 2.3 can run in parallel after Task 1.1
- Task 3.1 + Task 2.2 can run in parallel
- Task 4.1 + Task 4.2 + Task 4.3 can run in parallel after Task 3.2

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Foundation | 2 tasks | Medium |
| Phase 2: Leave Message | 3 tasks | Medium |
| Phase 3: Generation | 2 tasks | Large |
| Phase 4: UI | 4 tasks | Large |
| Testing | 2 tasks | Medium |

**Total Tasks**: 13
**Critical Path**: 1.1 → 3.1 → 3.2 → 4.1 → 4.4 → Complete

## Integration Note: Spec 1 Dependency

Task 3.2 (recommendation.controller.ts) `applyRecommendation` function imports from `documentVersioning.ts` which is created in Spec 1. If running specs in parallel:

- **Option A**: Implement a stub `plainTextToTipTap` function initially
- **Option B**: Complete Spec 1 Phase 1 first before Spec 3 Task 3.2
- **Option C**: Create the shared utility in Spec 3 and let Spec 1 reuse it

Recommended: **Option B** - Complete Spec 1 Phase 1 (Tasks 1.1-1.3) first since document versioning is foundational.
