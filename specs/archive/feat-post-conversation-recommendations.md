# Post-Conversation Recommendations & Leave Message

**Status:** Draft
**Authors:** Claude Code
**Date:** 2025-12-07
**Related:**
- `docs/ideation/collaborative-capsule-enhancements.md`
- `docs/ideation/recommendation-generation-system-spec.md`
- `specs/feat-document-editing-versioning.md`

---

## Overview

Enhance the conversation end experience with two features:

1. **Leave a Message Modal**: Prompt recipients to leave a message for the sender before ending their session
2. **AI-Generated Recommendations**: Analyze ended conversations to generate actionable recommendations for document updates and considerations

These features close the feedback loop between audience interactions and document improvement.

---

## Background/Problem Statement

Currently, when a conversation ends:
- The sender receives a basic summary with topics and sentiment
- There's no structured way for recipients to provide direct feedback
- Insights from conversations don't translate into actionable document improvements
- The sender must manually analyze conversations to identify improvement opportunities

**Core Problem:** Valuable feedback from conversations is lost or requires significant manual effort to extract.

**Root Cause:** The end-of-conversation flow focuses on conversation wrap-up, not knowledge capture.

---

## Goals

- Prompt all recipients to leave optional feedback for sender before session ends
- Generate AI-powered recommendations after each conversation ends
- Categorize recommendations: document updates, considerations, follow-ups
- Show evidence from conversation supporting each recommendation
- Enable AI-assisted application of document update recommendations
- Display recommendations prominently in Analytics dashboard
- Store recipient messages for sender review

---

## Non-Goals

- Real-time recommendations during conversation
- Automatic document updates without sender approval
- Recommendation generation for conversations with <5 messages
- Recipient-to-recipient messaging
- Custom leave-message prompts (fixed system prompt for MVP)

---

## Technical Dependencies

### Existing Dependencies Used

| Package | Purpose |
|---------|---------|
| `openai` (backend) | GPT-4o for recommendation generation |
| `zod` (backend) | Structured output validation |
| `@radix-ui/react-dialog` (frontend) | Leave message modal |
| `@radix-ui/react-accordion` (frontend) | Recommendation display |
| `lucide-react` (frontend) | Icons |
| `react-markdown` (frontend) | Render recommendation content |

### Integration Dependencies

- **Spec 1 (Document Editing)**: Recommendations can trigger document edits
- **Existing conversationAnalysis.ts**: Extend for recommendation generation

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Recipient Ends Conversation                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Leave Message Modal                               │
│  "Is there anything you'd like to share with [Sender]?"             │
│                    [Skip]  [Send & Continue]                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    End Confirmation Modal                            │
│                    (existing flow continues)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend: Conversation End                         │
│                                                                      │
│  1. Generate conversation summary (existing)                        │
│  2. Generate recommendations (NEW)                                  │
│  3. Store recipient message (NEW)                                   │
│  4. Return to frontend                                              │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Analytics Dashboard                               │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Conversation    │  │ Recommendations │  │ Recipient Message   │ │
│  │ Summary         │  │ (with evidence) │  │ (if provided)       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Model Changes

#### New Model: RecipientMessage

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
```

#### New Model: ConversationRecommendation

```prisma
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

#### Modify Conversation Model

```prisma
model Conversation {
  // ... existing fields ...

  // Add relations
  recipientMessage    RecipientMessage?
  recommendations     ConversationRecommendation[]

  // ... existing relations ...
}
```

### API Endpoints

#### 1. Submit Recipient Message

```typescript
// POST /api/conversations/:id/message
// Authorization: None (anonymous recipients can submit)

interface SubmitMessageRequest {
  content: string  // Max 2000 chars
}

interface SubmitMessageResponse {
  success: boolean
  messageId: string
}
```

#### 2. End Conversation (Modified)

```typescript
// POST /api/conversations/:id/end
// Modified to also generate recommendations

interface EndConversationRequest {
  recipientMessage?: string  // Optional message from recipient
}

interface EndConversationResponse {
  conversation: {
    id: string
    endedAt: string
    summary: string | null
    sentiment: string | null
    topics: string[]
  }
  recommendationCount: number  // NEW: Number of recommendations generated
}

// Implementation flow:
// 1. Mark conversation as ended (existing)
// 2. Generate summary if 5+ messages (existing)
// 3. Store recipient message if provided (NEW)
// 4. Generate recommendations (NEW - async but awaited)
// 5. Return response
```

#### 3. Get Recommendations

```typescript
// GET /api/conversations/:id/recommendations
// Authorization: Project owner only

interface GetRecommendationsResponse {
  recommendations: Array<{
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
    targetDocument?: {
      id: string
      filename: string
    }
    targetSectionId: string | null
    createdAt: string
  }>
}
```

#### 4. Apply Recommendation

```typescript
// POST /api/recommendations/:id/apply
// Authorization: Project owner only

interface ApplyRecommendationRequest {
  // Empty - uses proposedContent from recommendation
}

interface ApplyRecommendationResponse {
  success: boolean
  recommendation: {
    id: string
    status: 'applied'
    appliedAt: string
    appliedToVersion: number
  }
  documentVersion?: {
    id: string
    version: number
  }
}

// Implementation:
// 1. Verify recommendation is pending
// 2. If type is document_update:
//    - Call document versioning to update document
//    - Link recommendation to created version
// 3. Mark recommendation as applied
```

#### 5. Dismiss Recommendation

```typescript
// POST /api/recommendations/:id/dismiss
// Authorization: Project owner only

interface DismissRecommendationResponse {
  success: boolean
  recommendation: {
    id: string
    status: 'rejected'
    reviewedAt: string
  }
}
```

### Recommendation Generation Service

```typescript
// backend/src/services/recommendationGenerator.ts

import { z } from 'zod'

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

async function generateRecommendations(
  conversationId: string
): Promise<ConversationRecommendation[]> {
  // 1. Load conversation with messages
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      project: {
        include: {
          documents: {
            include: { chunks: true }
          }
        }
      }
    }
  })

  if (!conversation || conversation.messages.length < 5) {
    return []
  }

  // 2. Build prompt with conversation and documents
  const prompt = buildRecommendationPrompt(conversation)

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
  const parsed = recommendationSchema.parse(
    JSON.parse(response.choices[0].message.content!)
  )

  // 5. Filter by confidence threshold
  const MIN_CONFIDENCE = 0.4
  const filtered = parsed.recommendations.filter(r => r.confidence >= MIN_CONFIDENCE)

  // 6. Store in database
  const created = await prisma.conversationRecommendation.createMany({
    data: filtered.map((rec, index) => ({
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
    }))
  })

  return created
}
```

### Recommendation Prompt

```typescript
const RECOMMENDATION_SYSTEM_PROMPT = `You are an expert analyst who reviews conversations between viewers and AI agents discussing documents.

Your task is to identify actionable improvements based on:
1. Questions that weren't fully answered
2. Confusion or misunderstanding expressed by the viewer
3. Topics the viewer asked about repeatedly
4. Gaps between what the viewer needed and what documents provide

Generate recommendations that help the document sender improve their materials.`

function buildRecommendationPrompt(conversation: ConversationWithDetails): string {
  const transcript = conversation.messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const documentsList = conversation.project.documents
    .map(d => `- ${d.filename} (ID: ${d.id})\n  Sections: ${d.outline?.map(s => s.title).join(', ')}`)
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
```

### Frontend Components

#### 1. LeaveMessageModal Component

```typescript
// frontend/src/components/LeaveMessageModal.tsx

interface LeaveMessageModalProps {
  isOpen: boolean
  senderName: string
  onSubmit: (message: string) => void
  onSkip: () => void
}

// UI Structure:
// - Title: "Before you go..."
// - Prompt: "Is there anything specific you'd like me to share with [senderName]
//           now that you've explored this document capsule?"
// - Textarea (optional, max 2000 chars)
// - Example suggestions text
// - [Skip] and [Send & Continue] buttons
```

#### 2. ConversationRecommendations Component

```typescript
// frontend/src/components/ConversationRecommendations.tsx

interface ConversationRecommendationsProps {
  conversationId: string
  projectId: string
  onApply?: (recommendationId: string) => void
}

// Features:
// - Accordion-style list of recommendations
// - Type badge: Document Update (blue), Consideration (yellow), Follow-up (green)
// - Confidence indicator (percentage)
// - Impact badge (low/medium/high)
// - Evidence quotes in collapsible section
// - For document_update: Diff preview with before/after
// - Action buttons: [Approve & Apply] [Dismiss]
// - Status indicators for applied/dismissed
```

#### 3. RecipientMessageDisplay Component

```typescript
// frontend/src/components/RecipientMessageDisplay.tsx

interface RecipientMessageDisplayProps {
  message: {
    content: string
    viewerName?: string
    viewerEmail?: string
    createdAt: string
  }
}

// Simple card showing the recipient's direct message
// - Icon: envelope
// - Header: "Message from [name]" or "Message from viewer"
// - Content: The message text
// - Timestamp
```

### File Structure

```
frontend/src/
├── components/
│   ├── LeaveMessageModal.tsx            # NEW
│   ├── ConversationRecommendations.tsx  # NEW
│   ├── RecommendationCard.tsx           # NEW
│   ├── RecipientMessageDisplay.tsx      # NEW
│   ├── EndSessionModal.tsx              # MODIFY - integrate LeaveMessageModal
│   └── AnalyticsDashboard.tsx           # MODIFY - show recommendations
├── lib/
│   └── api.ts                           # MODIFY - add recommendation endpoints
└── hooks/
    └── useRecommendations.ts            # NEW - recommendation management

backend/src/
├── controllers/
│   ├── conversation.controller.ts       # MODIFY - add message/recommendation logic
│   └── recommendation.controller.ts     # NEW
├── services/
│   └── recommendationGenerator.ts       # NEW
├── routes/
│   ├── conversation.routes.ts           # MODIFY - add message endpoint
│   └── recommendation.routes.ts         # NEW
└── types/
    └── recommendation.ts                # NEW - TypeScript types
```

### Integration with EndSessionModal

```typescript
// Modify frontend/src/components/EndSessionModal.tsx

// Current flow:
// 1. User clicks "End Session"
// 2. EndSessionModal opens with confirmation
// 3. User confirms
// 4. Show register/login option

// New flow:
// 1. User clicks "End Session"
// 2. LeaveMessageModal opens FIRST
// 3. User submits message OR skips
// 4. EndSessionModal opens with confirmation
// 5. endConversation() called with recipientMessage
// 6. Show register/login option

function EndSessionFlow() {
  const [step, setStep] = useState<'message' | 'confirm' | 'done'>('message')
  const [recipientMessage, setRecipientMessage] = useState<string | null>(null)

  return (
    <>
      {step === 'message' && (
        <LeaveMessageModal
          isOpen={true}
          senderName={senderName}
          onSubmit={(msg) => {
            setRecipientMessage(msg)
            setStep('confirm')
          }}
          onSkip={() => setStep('confirm')}
        />
      )}

      {step === 'confirm' && (
        <EndSessionModal
          isOpen={true}
          onConfirm={async () => {
            await endConversation({ recipientMessage })
            setStep('done')
          }}
          // ... existing props
        />
      )}
    </>
  )
}
```

### Analytics Dashboard Integration

```typescript
// Add to AnalyticsDashboard.tsx

// New section in conversation detail view:

<div className="space-y-6">
  {/* Existing: Conversation Summary */}
  <ConversationSummary conversation={conversation} />

  {/* NEW: Recipient Message (if exists) */}
  {conversation.recipientMessage && (
    <RecipientMessageDisplay message={conversation.recipientMessage} />
  )}

  {/* NEW: AI Recommendations */}
  <ConversationRecommendations
    conversationId={conversation.id}
    projectId={projectId}
    onApply={handleApplyRecommendation}
  />
</div>
```

---

## User Experience

### Leave Message Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│    Before you go...                                                 │
│                                                                     │
│    Is there anything specific you'd like me to share               │
│    with Sarah now that you've explored this document               │
│    capsule?                                                         │
│                                                                     │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │                                                              │ │
│    │ Great overview of the business model! I'm still a bit       │ │
│    │ unclear on the timeline for Phase 2. Would love more        │ │
│    │ detail on the technical roadmap.                            │ │
│    │                                                              │ │
│    └─────────────────────────────────────────────────────────────┘ │
│                                                                     │
│    Examples: Feedback, questions for follow-up,                     │
│    clarifications you'd like, suggestions...                        │
│                                                                     │
│                           [Skip]        [Send & Continue]           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommendations in Analytics

```
┌─────────────────────────────────────────────────────────────────────┐
│  Conversation: John Smith - Dec 7, 2025                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Summary                                                            │
│  John explored the financial projections and asked several         │
│  questions about revenue assumptions. Sentiment: Neutral.          │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  📨 Message from John                                               │
│  "Great overview! Would love more detail on go-to-market timeline." │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  💡 Recommendations (3)                                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📝 DOCUMENT UPDATE    87% Confidence    Impact: HIGH        │   │
│  │                                                              │   │
│  │ Clarify revenue growth assumptions                           │   │
│  │                                                              │   │
│  │ Target: business-plan.pdf → Financials                       │   │
│  │                                                              │   │
│  │ ▼ Evidence from conversation                                 │   │
│  │ ┌──────────────────────────────────────────────────────────┐│   │
│  │ │ • "I'm confused about the 20% number"                    ││   │
│  │ │ • "Where does that assumption come from?"                ││   │
│  │ │ • "Is that based on historical data?"                    ││   │
│  │ └──────────────────────────────────────────────────────────┘│   │
│  │                                                              │   │
│  │ ▼ Proposed Change                                            │   │
│  │ ┌──────────────────────────────────────────────────────────┐│   │
│  │ │ - We project 20% quarterly growth.                       ││   │
│  │ │ + We project 20% quarterly growth based on:              ││   │
│  │ │ +   - Historical SaaS benchmarks (15-25% typical)       ││   │
│  │ │ +   - Our pipeline conversion rates (currently 18%)     ││   │
│  │ │ +   - Seasonal adjustment for Q4 enterprise buying      ││   │
│  │ └──────────────────────────────────────────────────────────┘│   │
│  │                                                              │   │
│  │ Reasoning: John asked 3 questions about the growth          │   │
│  │ assumption, indicating this needs more context.              │   │
│  │                                                              │   │
│  │         [View Document]  [Approve & Apply]  [Dismiss]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 💭 CONSIDERATION      72% Confidence    Impact: MEDIUM      │   │
│  │                                                              │   │
│  │ Add competitive landscape section                            │   │
│  │                                                              │   │
│  │ John asked about competitors 3 times but the document       │   │
│  │ doesn't address this topic directly.                         │   │
│  │                                                              │   │
│  │         [Note for Later]  [Dismiss]                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

```typescript
// backend/src/services/__tests__/recommendationGenerator.test.ts

describe('RecommendationGenerator', () => {
  describe('generateRecommendations', () => {
    it('should generate recommendations for conversations with 5+ messages', async () => {
      // Purpose: Verify core recommendation generation works
    })

    it('should skip recommendations for short conversations (<5 messages)', async () => {
      // Purpose: Verify cost control threshold
    })

    it('should filter out low-confidence recommendations', async () => {
      // Purpose: Verify quality threshold (0.4)
    })

    it('should extract exact evidence quotes from conversation', async () => {
      // Purpose: Verify evidence is verbatim, not paraphrased
    })
  })

  describe('applyRecommendation', () => {
    it('should create document version when applying document_update', async () => {
      // Purpose: Verify integration with document versioning
    })

    it('should reject application of non-pending recommendations', async () => {
      // Purpose: Prevent double-application
    })
  })
})
```

### Integration Tests

```typescript
// backend/src/controllers/__tests__/recommendation.controller.test.ts

describe('Recommendation API', () => {
  describe('POST /api/conversations/:id/end', () => {
    it('should generate recommendations after ending conversation', async () => {
      // 1. Create conversation with 5+ messages
      // 2. End conversation
      // 3. Verify recommendations were created
    })

    it('should store recipient message if provided', async () => {
      // Verify message storage
    })
  })

  describe('POST /api/recommendations/:id/apply', () => {
    it('should update document and mark recommendation applied', async () => {
      // Full apply flow verification
    })

    it('should reject non-owner requests', async () => {
      // Authorization check
    })
  })
})
```

### E2E Tests

```typescript
// e2e/conversation-recommendations.spec.ts

describe('Post-Conversation Recommendations', () => {
  test('leave message flow', async () => {
    // 1. Have a conversation as viewer
    // 2. Click End Session
    // 3. Verify leave message modal appears
    // 4. Type message and submit
    // 5. Verify modal closes
    // 6. Login as sender
    // 7. Verify message appears in analytics
  })

  test('recommendation display and apply', async () => {
    // 1. Have a conversation that triggers recommendations
    // 2. End conversation
    // 3. Login as sender
    // 4. Navigate to analytics
    // 5. Verify recommendations appear
    // 6. Apply a document_update recommendation
    // 7. Verify document was updated
    // 8. Verify recommendation status is 'applied'
  })
})
```

---

## Performance Considerations

### Recommendation Generation Latency

**Concern:** GPT-4o call adds 3-5 seconds to conversation end

**Mitigation:**
- Run recommendation generation asynchronously
- Return end confirmation immediately
- Recommendations appear when user views analytics (usually later)
- Show "Generating recommendations..." if viewed immediately

### Evidence Quote Matching

**Concern:** Verifying exact quotes exist in conversation

**Mitigation:**
- Post-process LLM output to validate quotes exist
- Log any hallucinated quotes for monitoring
- Fall back to showing reasoning without quotes if validation fails

---

## Security Considerations

### Recipient Message Content

- Sanitize message content (XSS prevention)
- Max length: 2000 characters
- Rate limit: 1 message per conversation

### Recommendation Application

- Only project owner can apply recommendations
- Validate recommendationId belongs to their project
- Document versioning creates audit trail

### LLM Prompt Injection

- Conversation content is user-generated
- System prompt is separate from user content
- Output is structured JSON, not executed code

---

## Documentation

### Updates Required

1. **API Reference** (specs/03-api-reference.md)
   - Add recommendation endpoints
   - Add recipient message endpoint

2. **Analytics Dashboard Guide**
   - Document new recommendations section
   - Explain apply/dismiss workflow

---

## Implementation Phases

### Phase 1: Leave Message Modal

- [ ] Create RecipientMessage model in schema
- [ ] Create LeaveMessageModal component
- [ ] Modify EndSessionModal to show message step first
- [ ] Add message to endConversation endpoint
- [ ] Display message in AnalyticsDashboard

### Phase 2: Recommendation Generation

- [ ] Create ConversationRecommendation model in schema
- [ ] Implement recommendationGenerator service
- [ ] Build recommendation prompt with Zod schema
- [ ] Integrate with conversation end flow
- [ ] Create recommendation.controller.ts

### Phase 3: Recommendation UI

- [ ] Create ConversationRecommendations component
- [ ] Create RecommendationCard component
- [ ] Implement evidence quotes display
- [ ] Implement diff preview for document updates
- [ ] Add to AnalyticsDashboard

### Phase 4: Apply/Dismiss Workflow

- [ ] Implement apply endpoint with document versioning
- [ ] Implement dismiss endpoint
- [ ] Add apply/dismiss buttons to UI
- [ ] Show status updates (pending → applied/rejected)

---

## Open Questions

1. **Recommendation Regeneration**: Should sender be able to regenerate recommendations?
   - **Current decision:** No for MVP
   - **Rationale:** Each conversation generates once; quality is set

2. **Bulk Actions**: Should sender be able to apply/dismiss all recommendations at once?
   - **Current decision:** No for MVP
   - **Future consideration:** Add "Apply All" button

3. **Recommendation Editing**: Should sender be able to edit proposedContent before applying?
   - **Current decision:** No for MVP (use as-is or dismiss)
   - **Future consideration:** Add inline editing

---

## References

- [Existing recommendation-generation-system-spec.md](docs/ideation/recommendation-generation-system-spec.md)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Existing conversationAnalysis.ts](backend/src/services/conversationAnalysis.ts)
- [Existing ProfileRecommendation pattern](backend/src/services/recommendationEngine.ts)
- [Ideation Document](docs/ideation/collaborative-capsule-enhancements.md)
