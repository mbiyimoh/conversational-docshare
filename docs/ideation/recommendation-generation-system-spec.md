# Document Recommendation Generation System

## Specification for AI-Powered Corpus Update Recommendations

**Purpose:** This specification describes a system that takes a written text summary (from conversations, research, or other sources) and generates structured recommendations for updating a document corpus. Each recommendation includes confidence scoring, detailed justification, and production-ready content.

---

## 1. System Overview

### What This System Does

Given:
1. A **text summary** (conversation transcript, research findings, notes, etc.)
2. A **list of existing documents** in the corpus

The system generates:
- **Structured recommendations** to ADD, EDIT, or DELETE documents
- **Confidence scores** (0.0-1.0) for each recommendation
- **Detailed justifications** explaining WHY each change is warranted
- **Production-ready content** for each recommendation

### Core Workflow

```
Text Summary (Input)
        ↓
┌───────────────────────────────────────┐
│  GPT-4o Structured Output Generation  │
│  - Analyzes summary vs. corpus        │
│  - Identifies gaps, updates, removals │
│  - Generates recommendations          │
└───────────────────────────────────────┘
        ↓
Confidence Filtering (threshold: 0.4)
        ↓
Recommendations Array (Output)
        ↓
User Review (Approve/Reject)
        ↓
Apply to Corpus (with backup/audit trail)
```

---

## 2. Data Models

### Recommendation Schema

```typescript
interface Recommendation {
  id: string;                    // Unique identifier (CUID)
  sourceId: string;              // FK to source (conversation, research run, etc.)

  // Recommendation Type
  action: "ADD" | "EDIT" | "DELETE";
  targetType: string;            // Your document type(s) e.g., "DOCUMENT", "TEMPLATE", etc.
  targetId: string | null;       // ID of existing document (null for ADD)

  // Content
  title: string;                 // Clear, concise title (5-10 words)
  description: string;           // 1-3 sentence summary of change
  fullContent: string;           // Complete, production-ready content
  reasoning: string;             // Detailed justification for the change

  // Scoring & Metadata
  confidence: number;            // 0.0 to 1.0 confidence score
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
  priority: number;              // Ordering/importance

  // Workflow Status
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
  reviewedAt?: Date;
  appliedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

### Prisma Schema Example

```prisma
model Recommendation {
  id          String    @id @default(cuid())
  sourceId    String    // FK to your source model

  // Recommendation type
  action      RecommendationAction
  targetType  TargetType
  targetId    String?   // null for ADD, required for EDIT/DELETE

  // Content fields
  title       String
  description String    @db.Text
  fullContent String    @db.Text
  reasoning   String    @db.Text

  // Scoring
  confidence  Float     // 0.0 to 1.0
  impactLevel ImpactLevel
  priority    Int       @default(0)

  // Workflow
  status      RecommendationStatus @default(PENDING)
  reviewedAt  DateTime?
  appliedAt   DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  source      YourSourceModel @relation(fields: [sourceId], references: [id])
  document    Document?       @relation(fields: [targetId], references: [id])
}

enum RecommendationAction {
  ADD
  EDIT
  DELETE
}

enum TargetType {
  DOCUMENT
  // Add your document types here
}

enum ImpactLevel {
  LOW
  MEDIUM
  HIGH
}

enum RecommendationStatus {
  PENDING
  APPROVED
  REJECTED
  APPLIED
}
```

---

## 3. Zod Validation Schema

**Critical:** When using OpenAI's `strict: true` mode for structured outputs, optional fields MUST use `.nullable().optional()`:

```typescript
import { z } from "zod";

export const recommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      action: z.enum(["ADD", "EDIT", "DELETE"]),
      targetType: z.enum(["DOCUMENT"]), // Add your types
      targetId: z.string().nullable(),  // null for ADD
      title: z.string(),
      description: z.string(),
      fullContent: z.string(),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
      impactLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
  ),
  // CRITICAL: Use .nullable().optional() for optional fields with strict mode
  noRecommendationsReason: z.string().nullable().optional(),
});

export type RecommendationOutput = z.infer<typeof recommendationSchema>;
```

---

## 4. GPT-4o Prompt Engineering

### System Prompt

```
You are an expert knowledge engineer who analyzes text summaries and generates
structured recommendations for improving document collections.
```

### User Prompt Template

```typescript
const prompt = `You are an expert knowledge engineer creating recommendations for document updates.

## Content Guidelines

${getContentGuidelines()} // See Section 4.1 below

## Corpus Status

${getCorpusStatusGuidance(existingDocuments)} // See Section 4.2 below

## Input Summary

The following text contains information that may warrant updates to the document corpus:

---
${textSummary}
---

## Existing Documents (${existingDocuments.length})

${existingDocuments.length > 0
  ? existingDocuments.map((d, i) => `${i + 1}. ${d.title} (ID: ${d.id})`).join("\n")
  : "(no existing documents)"}

## Your Task

Generate recommendations for improving this document corpus based on the input summary.

For each recommendation provide:

1. **action**: ADD (new document), EDIT (modify existing), or DELETE (remove)
2. **targetType**: DOCUMENT (or your document types)
3. **targetId**: The document ID if editing/deleting, null if adding
4. **title**: Clear, concise title (5-10 words)
5. **description**: 1-3 sentence summary of WHAT is changing and WHY
6. **fullContent**: The COMPLETE, PRODUCTION-READY content
   - Must be ready to use immediately
   - Well-structured with proper formatting
   - 200-2000 words depending on type/complexity
7. **reasoning**: Detailed justification connecting the input summary to this recommendation
   - What specific information from the summary supports this change?
   - Why is this change valuable?
   - How does it improve the corpus?
8. **confidence**: 0.0 to 1.0 score
   - 0.9-1.0: Very high confidence, clear and direct support from summary
   - 0.7-0.9: High confidence, strong evidence in summary
   - 0.5-0.7: Moderate confidence, reasonable inference from summary
   - 0.3-0.5: Lower confidence, indirect or partial support
   - Below 0.3: Speculative, weak connection to summary
9. **impactLevel**:
   - LOW: Minor improvement, nice-to-have
   - MEDIUM: Moderate improvement, recommended
   - HIGH: Significant improvement, strongly recommended

## Quality Standards

- **Accuracy**: Recommendations must be grounded in the input summary
- **Completeness**: fullContent must be production-ready, not placeholder text
- **Justification**: reasoning must clearly connect summary to recommendation
- **Calibration**: confidence scores should reflect actual certainty

${getEmptyCorpusInstructions(existingDocuments)} // See Section 4.3
`;
```

### 4.1 Content Guidelines

Customize this section based on your document types:

```typescript
function getContentGuidelines(): string {
  return `
## Content Generation Guidelines

### Document Quality Standards

**Required:**
- Clear, concise writing optimized for the intended use case
- Proper structure with headings, sections, and formatting
- Actionable content that serves its purpose immediately
- Markdown formatting (headings, lists, emphasis, code blocks)
- Information-dense without unnecessary verbosity

**Avoid:**
- Generic summaries without actionable guidance
- Placeholder text or incomplete content
- Redundant content duplicating existing documents
- Vague statements without concrete details

### Document Structure Pattern

"# [Document Title]

## Overview
[Brief introduction to the topic - 1-2 paragraphs]

## Key Points
1. **[Point 1]**: [Explanation]
2. **[Point 2]**: [Explanation]
3. **[Point 3]**: [Explanation]

## Details
[Expanded information with examples]

## Practical Application
[How to use this information]

## Related Topics
[Links to other relevant documents if applicable]"
`;
}
```

### 4.2 Corpus Status Guidance

```typescript
function getCorpusStatusGuidance(documents: Document[]): string {
  const isEmpty = documents.length === 0;

  if (isEmpty) {
    return `
CORPUS STATUS: EMPTY

This corpus has NO existing documents. Your task is to generate foundational content.

Guidance for Empty Corpus:
1. Generate 4-8 foundational ADD recommendations
2. Focus on essential documents any corpus in this domain needs
3. Be liberal with recommendations - user can reject what they don't need
4. Use HIGH impact level for foundational content
5. DO NOT return an empty array - foundational content is required
`;
  }

  return `
CORPUS STATUS: ${documents.length} EXISTING DOCUMENTS

Review the existing documents and suggest improvements based on the input summary.
Be selective - only recommend changes that add clear value.
Avoid duplicating content that already exists.
`;
}
```

### 4.3 Empty Corpus Instructions

```typescript
function getEmptyCorpusInstructions(documents: Document[]): string {
  if (documents.length === 0) {
    return `
CRITICAL: EMPTY CORPUS HANDLING

This corpus is EMPTY. You MUST generate foundational recommendations.
An empty recommendations array is NOT acceptable.

Generate at minimum:
- 3-5 ADD recommendations for foundational documents
- Each with HIGH impact level
- Complete, production-ready fullContent

Base recommendations on the input summary content.
`;
  }

  return `
NOTE: If NO recommendations are warranted, provide a clear explanation in
'noRecommendationsReason' explaining why the input summary does not require
any corpus changes. Be specific about what was analyzed and why no updates are needed.
`;
}
```

---

## 5. OpenAI API Call

```typescript
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateRecommendations(
  textSummary: string,
  existingDocuments: Document[]
): Promise<RecommendationOutput> {

  const prompt = buildPrompt(textSummary, existingDocuments);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06", // or latest GPT-4o
    messages: [
      {
        role: "system",
        content: "You are an expert knowledge engineer who analyzes text summaries and generates structured recommendations for improving document collections.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "document_recommendations",
        schema: zodResponseFormat(recommendationSchema, "document_recommendations").json_schema.schema,
        strict: true,
      },
    },
    temperature: 0.7, // Balanced creativity vs. consistency
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    return { recommendations: [] };
  }

  return recommendationSchema.parse(JSON.parse(content));
}
```

---

## 6. Confidence Filtering

Apply a minimum confidence threshold before saving recommendations:

```typescript
const MIN_CONFIDENCE_THRESHOLD = 0.4; // 40% minimum

function filterByConfidence(
  recommendations: Recommendation[]
): Recommendation[] {
  const filtered = recommendations.filter(
    rec => rec.confidence >= MIN_CONFIDENCE_THRESHOLD
  );

  // Log filtered-out recommendations for transparency
  const removed = recommendations.filter(
    rec => rec.confidence < MIN_CONFIDENCE_THRESHOLD
  );

  if (removed.length > 0) {
    console.log(
      `[Recommendations] Filtered out ${removed.length} low-confidence items:`,
      removed.map(r => `"${r.title}" (${(r.confidence * 100).toFixed(0)}%)`)
    );
  }

  return filtered;
}
```

---

## 7. Database Storage

```typescript
async function saveRecommendations(
  sourceId: string,
  recommendations: RecommendationOutput
): Promise<void> {

  const filtered = filterByConfidence(recommendations.recommendations);

  if (filtered.length === 0) {
    // Store reason if provided
    if (recommendations.noRecommendationsReason) {
      await prisma.source.update({
        where: { id: sourceId },
        data: {
          metadata: {
            noRecommendationsReason: recommendations.noRecommendationsReason,
          },
        },
      });
    }
    return;
  }

  await prisma.recommendation.createMany({
    data: filtered.map((rec, index) => ({
      sourceId,
      action: rec.action,
      targetType: rec.targetType,
      targetId: rec.action === "ADD" ? null : rec.targetId,
      title: rec.title,
      description: rec.description,
      fullContent: rec.fullContent,
      reasoning: rec.reasoning,
      confidence: rec.confidence,
      impactLevel: rec.impactLevel,
      priority: index,
      status: "PENDING",
    })),
  });
}
```

---

## 8. Approval Workflow

### Status Transitions

```
PENDING → APPROVED (user approves)
PENDING → REJECTED (user rejects)
APPROVED → APPLIED (changes applied to corpus)
```

### Approve Endpoint

```typescript
// POST /api/recommendations/[id]/approve
async function approveRecommendation(id: string): Promise<Recommendation> {
  return prisma.recommendation.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
    },
  });
}
```

### Reject Endpoint

```typescript
// POST /api/recommendations/[id]/reject
async function rejectRecommendation(id: string): Promise<Recommendation> {
  return prisma.recommendation.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
    },
  });
}
```

---

## 9. Applying Recommendations

### Pre-Apply Backup

Always create a backup/snapshot before applying changes:

```typescript
interface CorpusSnapshot {
  id: string;
  name: string;
  description?: string;
  documentsData: JSON; // Full copy of all documents
  createdAt: Date;
}

async function createSnapshot(
  corpusId: string,
  name: string
): Promise<CorpusSnapshot> {
  const documents = await prisma.document.findMany({
    where: { corpusId },
  });

  return prisma.corpusSnapshot.create({
    data: {
      corpusId,
      name,
      documentsData: documents,
    },
  });
}
```

### Apply Logic

```typescript
async function applyRecommendations(
  recommendationIds: string[],
  snapshotName?: string
): Promise<{ snapshotId: string; appliedCount: number }> {

  // 1. Fetch approved recommendations
  const recommendations = await prisma.recommendation.findMany({
    where: {
      id: { in: recommendationIds },
      status: "APPROVED",
    },
    include: { source: true },
  });

  if (recommendations.length === 0) {
    throw new Error("No approved recommendations to apply");
  }

  // 2. Create pre-apply snapshot
  const snapshot = await createSnapshot(
    recommendations[0].source.corpusId,
    snapshotName || `Snapshot ${new Date().toISOString()}`
  );

  // 3. Apply each recommendation in a transaction
  await prisma.$transaction(async (tx) => {
    for (const rec of recommendations) {
      // Log the change for audit trail
      await tx.changeLog.create({
        data: {
          recommendationId: rec.id,
          action: rec.action,
          previousValue: rec.action !== "ADD"
            ? await getDocumentContent(rec.targetId!)
            : null,
          newValue: rec.action !== "DELETE"
            ? rec.fullContent
            : null,
        },
      });

      // Apply the change
      switch (rec.action) {
        case "ADD":
          await tx.document.create({
            data: {
              corpusId: rec.source.corpusId,
              title: rec.title,
              content: rec.fullContent,
            },
          });
          break;

        case "EDIT":
          await tx.document.update({
            where: { id: rec.targetId! },
            data: {
              title: rec.title,
              content: rec.fullContent,
            },
          });
          break;

        case "DELETE":
          await tx.document.delete({
            where: { id: rec.targetId! },
          });
          break;
      }

      // Mark as applied
      await tx.recommendation.update({
        where: { id: rec.id },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
        },
      });
    }
  });

  return {
    snapshotId: snapshot.id,
    appliedCount: recommendations.length,
  };
}
```

---

## 10. API Endpoints

### Generate Recommendations

```typescript
// POST /api/sources/[id]/generate-recommendations
// Triggers recommendation generation from a source (conversation, etc.)

interface GenerateResponse {
  recommendationCount: number;
  noRecommendationsReason?: string;
}
```

### List Recommendations

```typescript
// GET /api/recommendations?sourceId=xxx&status=PENDING

interface ListResponse {
  recommendations: Recommendation[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    applied: number;
    byAction: { add: number; edit: number; delete: number };
    byImpact: { low: number; medium: number; high: number };
  };
}
```

### Approve/Reject

```typescript
// POST /api/recommendations/[id]/approve
// POST /api/recommendations/[id]/reject

interface UpdateResponse {
  recommendation: Recommendation;
}
```

### Apply

```typescript
// POST /api/corpus/[id]/apply-recommendations

interface ApplyRequest {
  recommendationIds: string[];
  snapshotName?: string;
  snapshotDescription?: string;
}

interface ApplyResponse {
  snapshotId: string;
  appliedCount: number;
}
```

---

## 11. Frontend Display

### Recommendation Card Fields

Display each recommendation with:

1. **Action Badge** - Color-coded: ADD (green), EDIT (blue), DELETE (red)
2. **Impact Badge** - LOW (gray), MEDIUM (yellow), HIGH (orange)
3. **Confidence Score** - Percentage display (e.g., "Confidence: 85%")
4. **Title** - Main heading
5. **Description** - Brief summary (always visible)
6. **Full Content** - Expandable/collapsible
7. **Reasoning** - Expandable justification section
8. **Target** - Which document this affects (for EDIT/DELETE)
9. **Approve/Reject Buttons** - Only for PENDING status
10. **Status Badge** - Current workflow status

### Diff View for EDIT Actions

For EDIT recommendations, show a diff view comparing:
- **Original Content**: Fetched from the target document
- **Proposed Content**: From recommendation.fullContent

Use a library like `react-diff-viewer` to highlight:
- Red: Removed lines
- Green: Added lines

---

## 12. Debugging & Logging

### Recommended Log Points

```typescript
// 1. Prompt logging
console.log(`[Recommendations] === PROMPT START ===`);
console.log(prompt);
console.log(`[Recommendations] === PROMPT END ===`);
console.log(`[Recommendations] Prompt length: ${prompt.length} chars`);

// 2. Response logging
console.log(`[Recommendations] === RAW RESPONSE START ===`);
console.log(content);
console.log(`[Recommendations] === RAW RESPONSE END ===`);

// 3. Parsing result
console.log(`[Recommendations] Parsed ${recs.length} recommendations`);
console.log(`[Recommendations] Sample:`, recs.slice(0, 3).map(r => ({
  action: r.action,
  title: r.title,
  confidence: r.confidence,
})));

// 4. Filtering
console.log(`[Recommendations] Filtered to ${filtered.length} (min: ${MIN_CONFIDENCE})`);
console.log(`[Recommendations] Removed:`, removed.map(r => `"${r.title}" (${r.confidence})`));
```

---

## 13. Configuration Constants

```typescript
// Minimum confidence to save recommendation
export const MIN_RECOMMENDATION_CONFIDENCE = 0.4;

// OpenAI model to use
export const RECOMMENDATION_MODEL = "gpt-4o-2024-08-06";

// Temperature for generation (0.0-1.0)
export const GENERATION_TEMPERATURE = 0.7;

// Maximum recommendations per generation
export const MAX_RECOMMENDATIONS = 20;
```

---

## 14. Error Handling

### Graceful Degradation

```typescript
async function generateRecommendations(...): Promise<RecommendationOutput> {
  try {
    // ... generation logic
  } catch (error) {
    console.error("[Recommendations] Generation failed:", error);

    // Return empty array instead of throwing
    // User can retry or system can be investigated
    return { recommendations: [] };
  }
}
```

### Validation Errors

If Zod parsing fails, log the raw response for debugging:

```typescript
try {
  return recommendationSchema.parse(JSON.parse(content));
} catch (parseError) {
  console.error("[Recommendations] Parse failed. Raw content:", content);
  throw parseError;
}
```

---

## 15. Summary

This system provides:

1. **Structured Analysis** - GPT-4o analyzes text summaries against existing documents
2. **Confidence Scoring** - Each recommendation has a 0-1 confidence score
3. **Detailed Justification** - Reasoning field explains why each change is warranted
4. **Production-Ready Content** - fullContent is ready to use, not placeholder text
5. **Approval Workflow** - Human review before changes are applied
6. **Audit Trail** - Snapshots and change logs enable rollback
7. **Filtering** - Low-confidence recommendations are automatically excluded

The key insight is that GPT-4o handles both the **analysis** (what should change) and **generation** (what the new content should be) in a single structured output call, with the human serving as the final approval gate.

---

## Appendix: Example Recommendation

```json
{
  "action": "ADD",
  "targetType": "DOCUMENT",
  "targetId": null,
  "title": "API Authentication Guide",
  "description": "New guide covering OAuth2 authentication flow based on the discussion about security requirements.",
  "fullContent": "# API Authentication Guide\n\n## Overview\n\nThis guide covers the OAuth2 authentication flow used by our API...\n\n## Authentication Flow\n\n1. **Request Authorization Code**...\n\n## Token Management\n\n### Access Tokens\n...\n\n### Refresh Tokens\n...\n\n## Error Handling\n...\n\n## Best Practices\n...",
  "reasoning": "The conversation transcript discussed security requirements and mentioned confusion about the authentication process. This guide directly addresses the discussed pain points by documenting the OAuth2 flow, token management, and common error scenarios. The participants specifically mentioned needing 'clear documentation on auth' which this recommendation fulfills.",
  "confidence": 0.92,
  "impactLevel": "HIGH"
}
```
