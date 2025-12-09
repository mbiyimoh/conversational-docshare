# Feature: Audience Synthesis & Versioning

**Spec ID:** feat-audience-synthesis
**Status:** Validated
**Priority:** Medium
**Depends On:** feat-post-conversation-recommendations (Spec 3) - COMPLETED

---

## 1. Problem Statement

Currently, project owners can view individual conversation analytics but have no aggregate view of patterns across all conversations. They can't see:
- What questions are commonly asked
- Where audiences consistently struggle
- How sentiment trends over time
- Document improvement suggestions based on collective feedback

### Business Need
- Senders need aggregate insights across all conversations
- Patterns emerge only after multiple conversations
- Versioned synthesis allows tracking how audience understanding evolves
- Actionable suggestions for document improvements based on collective data

---

## 2. Solution Overview

Create an `AudienceSynthesis` model that stores aggregate analysis of all conversations for a project. The synthesis is:
- **Incrementally updated** after each conversation ends (not full re-analysis)
- **Versioned** so senders can flip through historical snapshots
- **Displayed** in the Analytics tab with common questions, knowledge gaps, and document suggestions

### Key Components
1. **AudienceSynthesis model** with versioned snapshots
2. **audienceSynthesis.service.ts** for incremental LLM-based synthesis
3. **AudienceSynthesisPanel.tsx** component for display
4. **Version history** with flip-through UI
5. **Auto-trigger** on conversation end

---

## 3. Database Schema

### New Model: AudienceSynthesis
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

### Add Relation to Project
```prisma
model Project {
  // ... existing fields
  audienceSyntheses  AudienceSynthesis[]
}
```

---

## 4. API Endpoints

### 4.1 Get Current Synthesis

**GET /api/projects/:projectId/audience-synthesis**

Returns the latest synthesis version for a project.

Response:
```typescript
{
  synthesis: {
    id: string
    version: number
    overview: string
    commonQuestions: Array<{
      pattern: string
      frequency: number
      documents: string[]
    }>
    knowledgeGaps: Array<{
      topic: string
      severity: 'low' | 'medium' | 'high'
      suggestion: string
    }>
    documentSuggestions: Array<{
      documentId: string
      documentName: string
      section: string
      suggestion: string
    }>
    sentimentTrend: 'improving' | 'stable' | 'declining'
    insights: string[]
    conversationCount: number
    totalMessages: number
    dateRangeFrom: string
    dateRangeTo: string
    createdAt: string
  } | null
}
```

Authorization: Project owner

### 4.2 Get Synthesis Version History

**GET /api/projects/:projectId/audience-synthesis/versions**

Returns all synthesis versions (metadata only, no full content).

Response:
```typescript
{
  versions: Array<{
    id: string
    version: number
    conversationCount: number
    createdAt: string
  }>
}
```

### 4.3 Get Specific Version

**GET /api/projects/:projectId/audience-synthesis/versions/:version**

Returns a specific synthesis version.

Response: Same as 4.1 but for specific version.

### 4.4 Regenerate Synthesis (Manual)

**POST /api/projects/:projectId/audience-synthesis/regenerate**

Force full regeneration from all conversations (not incremental).

Response:
```typescript
{
  synthesis: { ... }
  regenerated: true
}
```

---

## 5. Backend Service: audienceSynthesis.service.ts

### Core Functions

```typescript
/**
 * Update synthesis incrementally after a conversation ends
 * Called automatically from conversation.controller.ts endConversation
 */
export async function updateAudienceSynthesis(
  projectId: string,
  conversationId: string
): Promise<AudienceSynthesis>

/**
 * Regenerate synthesis from all conversations (full analysis)
 * Used for manual refresh or initial creation
 */
export async function regenerateAudienceSynthesis(
  projectId: string
): Promise<AudienceSynthesis>

/**
 * Get the latest synthesis version
 */
export async function getLatestSynthesis(
  projectId: string
): Promise<AudienceSynthesis | null>
```

### Incremental Update Logic

```typescript
async function updateAudienceSynthesis(projectId: string, conversationId: string) {
  // 1. Load previous synthesis (if exists)
  const previousSynthesis = await getLatestSynthesis(projectId)

  // 2. Load the new conversation's summary and recommendations
  const newConversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      recommendations: true
    }
  })

  // 3. If no previous synthesis, do full regeneration
  if (!previousSynthesis) {
    return regenerateAudienceSynthesis(projectId)
  }

  // 4. Build incremental update prompt
  const prompt = buildIncrementalSynthesisPrompt(previousSynthesis, newConversation)

  // 5. Call LLM for updated synthesis
  const updatedSynthesis = await generateSynthesisUpdate(prompt)

  // 6. Store as new version
  return prisma.audienceSynthesis.create({
    data: {
      projectId,
      version: previousSynthesis.version + 1,
      ...updatedSynthesis,
      conversationCount: previousSynthesis.conversationCount + 1,
      totalMessages: previousSynthesis.totalMessages + newConversation.messageCount,
      dateRangeFrom: previousSynthesis.dateRangeFrom,
      dateRangeTo: new Date()
    }
  })
}
```

### LLM Prompt for Incremental Update

```typescript
const incrementalSynthesisPrompt = `
You are updating an audience synthesis based on a new conversation.

## Previous Synthesis (Version ${previousVersion})
${JSON.stringify(previousSynthesis, null, 2)}

## New Conversation Summary
Summary: ${conversationSummary}
Topics: ${topics.join(', ')}
Sentiment: ${sentiment}
Message Count: ${messageCount}

## Recommendations Generated
${recommendations.map(r => `- ${r.type}: ${r.content}`).join('\n')}

## Instructions
Update the synthesis to incorporate insights from this new conversation.

Return JSON with this structure:
{
  "overview": "Updated overall pattern description (1-2 paragraphs)",
  "commonQuestions": [
    { "pattern": "Question pattern", "frequency": 5, "documents": ["doc1.pdf"] }
  ],
  "knowledgeGaps": [
    { "topic": "Area of confusion", "severity": "high|medium|low", "suggestion": "How to address" }
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
`
```

---

## 6. Frontend Components

### 6.1 AudienceSynthesisPanel.tsx (New)

Main component for displaying synthesis in Analytics tab:

```tsx
interface AudienceSynthesisPanelProps {
  projectId: string
}

export function AudienceSynthesisPanel({ projectId }: AudienceSynthesisPanelProps) {
  const [synthesis, setSynthesis] = useState<AudienceSynthesis | null>(null)
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  // Load synthesis and version history on mount
  useEffect(() => {
    loadSynthesis()
    loadVersions()
  }, [projectId])

  // ... render synthesis data
}
```

### 6.2 SynthesisVersionSelector.tsx (New)

Dropdown for selecting synthesis version:

```tsx
interface SynthesisVersionSelectorProps {
  versions: VersionMeta[]
  currentVersion: number
  onSelect: (version: number) => void
}
```

### 6.3 CommonQuestionsCard.tsx (New)

Card displaying common question patterns:

```tsx
interface CommonQuestionsCardProps {
  questions: Array<{
    pattern: string
    frequency: number
    documents: string[]
  }>
}
```

### 6.4 KnowledgeGapsCard.tsx (New)

Card displaying knowledge gaps:

```tsx
interface KnowledgeGapsCardProps {
  gaps: Array<{
    topic: string
    severity: 'low' | 'medium' | 'high'
    suggestion: string
  }>
}
```

### 6.5 DocumentSuggestionsCard.tsx (New)

Card displaying document improvement suggestions:

```tsx
interface DocumentSuggestionsCardProps {
  suggestions: Array<{
    documentId: string
    documentName: string
    section: string
    suggestion: string
  }>
  onViewDocument: (documentId: string, section: string) => void
}
```

---

## 7. Integration Points

### 7.1 Auto-trigger on Conversation End

Modify `conversation.controller.ts` endConversation to trigger synthesis update:

```typescript
// In endConversation, after generating recommendations:
if (conversation.messages.length >= 5) {
  try {
    // Generate recommendations (existing)
    const { generateConversationRecommendations } = await import(
      '../services/conversationRecommendationGenerator'
    )
    await generateConversationRecommendations(id)

    // NEW: Update audience synthesis
    const { updateAudienceSynthesis } = await import(
      '../services/audienceSynthesis'
    )
    await updateAudienceSynthesis(conversation.projectId, id)
  } catch (error) {
    console.warn('Failed to update synthesis:', error)
  }
}
```

### 7.2 Analytics Tab Integration

Add AudienceSynthesisPanel to AnalyticsDashboard.tsx as a new section.

---

## 8. Implementation Plan

### Phase 1: Database & Service (Backend)
1. Add AudienceSynthesis model to schema
2. Run `npm run db:push`
3. Create `audienceSynthesis.service.ts`
4. Implement `updateAudienceSynthesis` with incremental logic
5. Implement `regenerateAudienceSynthesis` for full analysis
6. Create `audienceSynthesis.controller.ts`
7. Create `audienceSynthesis.routes.ts`

### Phase 2: Auto-trigger Integration (Backend)
1. Modify `endConversation` to call synthesis update
2. Handle errors gracefully (synthesis is optional)
3. Test with existing conversations

### Phase 3: Frontend Display
1. Create `AudienceSynthesisPanel.tsx`
2. Create sub-components (CommonQuestionsCard, etc.)
3. Create `SynthesisVersionSelector.tsx`
4. Add to `AnalyticsDashboard.tsx`
5. Add API methods to `api.ts`

### Phase 4: Testing & Polish
1. Test incremental updates work correctly
2. Test version history navigation
3. Test manual regeneration
4. Handle empty state (no conversations yet)

---

## 9. Success Criteria

- [ ] AudienceSynthesis model created and pushed to database
- [ ] Synthesis auto-updates after each conversation ends (5+ messages)
- [ ] Synthesis shows common questions with frequency counts
- [ ] Synthesis shows knowledge gaps with severity levels
- [ ] Synthesis shows document improvement suggestions
- [ ] Sentiment trend calculated and displayed
- [ ] Version history accessible with flip-through UI
- [ ] Manual regeneration option works
- [ ] TypeScript compiles without errors
- [ ] ESLint passes

---

## 10. Performance Considerations

1. **Incremental updates** avoid re-processing all conversations
2. **Async execution** - synthesis update doesn't block conversation end
3. **Version cleanup** - consider archiving old versions after N versions
4. **Caching** - cache current synthesis in frontend to avoid repeated fetches

---

## 11. Testing Approach

1. **Unit Tests:**
   - Test synthesis generation logic
   - Test version incrementing
   - Test JSON structure validation

2. **Integration Tests:**
   - End conversation → verify synthesis updated
   - Multiple conversations → verify incremental accumulation
   - Version history → verify all versions accessible

3. **Manual Testing:**
   - Create project, have 5+ conversations
   - Verify synthesis appears in Analytics
   - Navigate version history
   - Test manual regeneration

---

## 12. Rollback Plan

If issues arise:
1. Disable auto-trigger in endConversation (comment out)
2. Hide synthesis panel in Analytics (conditional render)
3. Synthesis data remains in database but unused
