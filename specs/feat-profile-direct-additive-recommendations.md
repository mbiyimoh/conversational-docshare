# Profile-Direct Additive Recommendations

## Status
✅ **Implemented** - December 2025

## Authors
- Claude Code
- Date: 2025-12-03

## Overview

Transform the recommendation system from interview-targeted wholesale replacements to profile-direct additive operations. This architectural change ensures recommendations:

1. **Target the correct artifact** - Modify profile sections directly (the runtime AI behavior source) instead of interview answers (which require manual regeneration)
2. **Preserve existing content** - Use surgical add/remove/modify operations instead of destructive full-section replacement
3. **Enable version tracking** - Store profile snapshots per testing session for rollback capability

## Background/Problem Statement

### Current System Flaws

**Flaw 1: Wrong Target**
- Recommendations currently modify interview answers (`audience`, `purpose`, `tone`, `emphasis`, `questions`)
- Users must manually "Regenerate Profile" after applying recommendations
- Creates friction and confusion - the profile is the actual runtime artifact

**Flaw 2: Destructive Replacement**
- LLM suggests wholesale `suggestedAnswer` replacements
- Rich, carefully crafted content gets deleted
- Example: A detailed tiered content structure with 500+ words could be replaced with a generic 2-sentence suggestion

**Root Causes:**
1. Original design assumed interview → profile was one-time flow
2. LLM defaults to full replacement when asked to "suggest improvements"
3. No data structure exists for representing partial edits

### Real User Impact

From actual testing: A user's detailed TradeBlock profile section with:
- Multiple tiers of priorities
- Specific use cases and examples
- Carefully worded talking points

Would be completely replaced with a generic suggestion like:
> "The AI should address stakeholders by name and adopt the perspective of speaking to the ultimate audience of the document."

## Goals

- Recommendations directly modify profile sections with immediate effect
- Support additive operations: ADD (append new content), REMOVE (delete specific conflicting content), MODIFY (change specific phrases)
- Holistic analysis of ALL comments from a testing session produces max 1 recommendation per profile section (prevents conflicts)
- Version snapshots per testing session enable rollback to previous profile states
- Side-by-side diff visualization with quick summary bullets
- Preserve all existing rich content unless directly contradicted by feedback

## Non-Goals

- Concurrent collaborative editing (CRDT/OT patterns)
- AI-powered conflict resolution between recommendations
- Version history UI beyond single-level rollback
- Changes to the initial profile synthesis from interview
- Back-propagation from profile edits to interview data

## Technical Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `fast-json-patch` | ^3.1.1 | RFC 6902 JSON Patch operations (optional, for future expansion) |

**Note:** Initial implementation uses simple string concatenation for ADD operations. JSON Patch reserved for future MODIFY/REMOVE precision.

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `recommendationEngine.ts` | Major rewrite for profile-direct targeting |
| `profileSynthesizer.ts` | Reference for profile section structure |
| `recommendation.controller.ts` | New endpoints for apply-all and rollback |
| `RecommendationPanel.tsx` | New UI for side-by-side diff |

## Detailed Design

### Architecture Changes

```
CURRENT FLOW:
Comment → Recommendation → Interview Update → Manual Profile Regeneration

PROPOSED FLOW:
Comment → Holistic Analysis → Profile Recommendation → Direct Profile Patch → Immediate Effect
                                       ↓
                              Version Snapshot Created
```

### Data Model Changes

#### New: ProfileRecommendation Model

```prisma
model ProfileRecommendation {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Recommendation set metadata
  setId           String      // Groups recommendations from same analysis
  generatedAt     DateTime    @default(now())

  // Target and operation
  type            String      // "add" | "remove" | "modify"
  targetSection   String      // identityRole | communicationStyle | contentPriorities | engagementApproach | keyFramings

  // Content
  addedContent    String?     @db.Text  // For ADD: content to append
  removedContent  String?     @db.Text  // For REMOVE: content to delete
  modifiedFrom    String?     @db.Text  // For MODIFY: original phrase
  modifiedTo      String?     @db.Text  // For MODIFY: replacement phrase

  // Display
  summaryBullets  Json        // String[] - 2-3 bullet summary
  previewBefore   String      @db.Text  // Section content before
  previewAfter    String      @db.Text  // Section content after
  rationale       String      @db.Text

  // Source tracking
  relatedCommentIds Json      // String[] - comment IDs that informed this

  // Status
  status          String      @default("pending")  // pending | applied | dismissed
  appliedAt       DateTime?

  @@index([projectId])
  @@index([setId])
  @@index([status])
  @@map("profile_recommendations")
}
```

#### New: ProfileVersion Model

```prisma
model ProfileVersion {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Version metadata
  version         Int         // Sequential version number per project
  profile         Json        // Complete AgentProfile snapshot
  source          String      // "interview" | "manual" | "recommendation"

  // Reference to what created this version
  recommendationSetId String?  // If created from recommendations

  // Timestamps
  createdAt       DateTime    @default(now())

  @@unique([projectId, version])
  @@index([projectId])
  @@index([createdAt])
  @@map("profile_versions")
}
```

#### Updated: AgentConfig

Add field to track current profile version:

```prisma
model AgentConfig {
  // ... existing fields ...

  // Profile version tracking
  profileVersion Int @default(1)

  // ... existing fields ...
}
```

### New TypeScript Interfaces

```typescript
// backend/src/types/recommendation.ts

export interface ProfileRecommendation {
  id: string
  setId: string
  type: 'add' | 'remove' | 'modify'
  targetSection: ProfileSectionKey
  addedContent?: string
  removedContent?: string
  modifiedFrom?: string
  modifiedTo?: string
  summaryBullets: string[]  // 2-3 bullets
  previewBefore: string
  previewAfter: string
  rationale: string
  relatedCommentIds: string[]
  status: 'pending' | 'applied' | 'dismissed'
}

export type ProfileSectionKey =
  | 'identityRole'
  | 'communicationStyle'
  | 'contentPriorities'
  | 'engagementApproach'
  | 'keyFramings'

export interface RecommendationSet {
  setId: string
  recommendations: ProfileRecommendation[]
  analysisSummary: AnalysisSummary
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}

export interface ProfileVersion {
  id: string
  projectId: string
  version: number
  profile: AgentProfile
  source: 'interview' | 'manual' | 'recommendation'
  recommendationSetId?: string
  createdAt: string
}
```

### Updated ANALYSIS_PROMPT

The recommendation engine prompt must be rewritten to:
1. Target profile sections instead of interview questions
2. Generate additive operations
3. Analyze ALL comments holistically (max 1 rec per section)

```typescript
const PROFILE_ANALYSIS_PROMPT = `You analyze AI agent testing feedback and generate profile recommendations.

## Current Profile Sections

### Identity & Role
${profile.sections.identityRole.content}

### Communication Style
${profile.sections.communicationStyle.content}

### Content Priorities
${profile.sections.contentPriorities.content}

### Engagement Approach
${profile.sections.engagementApproach.content}

### Key Framings
${profile.sections.keyFramings.content}

## Testing Feedback Comments (${comments.length} total)

${formattedComments}

## Your Task

Analyze ALL the feedback comments holistically. Generate recommendations for profile sections.

CRITICAL RULES:
1. Generate AT MOST ONE recommendation per section
2. If multiple comments affect the same section, SYNTHESIZE them into ONE recommendation
3. Use ONLY these operation types:
   - ADD: Append new content to existing section (preserves all existing content)
   - REMOVE: Remove specific phrase ONLY if directly contradicted by feedback
   - MODIFY: Change specific phrase (use sparingly, prefer ADD)
4. NEVER suggest deleting content that is unrelated to the feedback
5. NEVER generate full section replacements
6. Always preserve existing rich content

Return JSON:
{
  "analysisSummary": {
    "overview": "2-3 sentence analysis of all feedback",
    "feedbackThemes": ["theme1", "theme2"],
    "configAlignment": "good" | "needs_update" | "partial",
    "noChangeReason": "Required if no recommendations"
  },
  "recommendations": [
    {
      "type": "add",
      "targetSection": "communicationStyle",
      "addedContent": "When addressing stakeholders, use their names and position the messaging from the perspective of their role as the document's ultimate audience.",
      "summaryBullets": [
        "Address stakeholders by name",
        "Adopt audience perspective in framing"
      ],
      "rationale": "Multiple comments (comment-123, comment-456) indicated responses felt impersonal and didn't acknowledge the reader's perspective.",
      "relatedCommentIds": ["comment-123", "comment-456"]
    }
  ]
}

If no changes needed, return empty recommendations array with noChangeReason.
`
```

### Apply Logic

```typescript
// backend/src/services/recommendationEngine.ts

export async function applyRecommendations(
  projectId: string,
  setId: string
): Promise<{ profile: AgentProfile; version: ProfileVersion }> {
  // 1. Get current profile and pending recommendations
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
    select: { profile: true, profileVersion: true }
  })

  const recommendations = await prisma.profileRecommendation.findMany({
    where: { setId, status: 'pending' }
  })

  if (!agentConfig?.profile || recommendations.length === 0) {
    throw new NotFoundError('No profile or pending recommendations')
  }

  // 1b. Concurrent apply protection - check if already applied
  const alreadyApplied = await prisma.profileRecommendation.findFirst({
    where: { setId, status: 'applied' }
  })
  if (alreadyApplied) {
    throw new ConflictError('This recommendation set has already been applied')
  }

  const profile = agentConfig.profile as AgentProfile

  // 2. Create version snapshot BEFORE changes
  const newVersion = agentConfig.profileVersion + 1
  await prisma.profileVersion.create({
    data: {
      projectId,
      version: newVersion,
      profile: JSON.parse(JSON.stringify(profile)),
      source: 'recommendation',
      recommendationSetId: setId
    }
  })

  // 3. Apply each recommendation
  for (const rec of recommendations) {
    const section = profile.sections[rec.targetSection as ProfileSectionKey]

    switch (rec.type) {
      case 'add':
        // Append with newline separator
        section.content = section.content.trim() + '\n\n' + rec.addedContent
        break

      case 'remove':
        // Remove specific content
        section.content = section.content.replace(rec.removedContent!, '').trim()
        break

      case 'modify':
        // Replace specific phrase
        section.content = section.content.replace(rec.modifiedFrom!, rec.modifiedTo!)
        break
    }

    // Mark section as edited
    section.isEdited = true
    section.editedAt = new Date().toISOString()
    section.editSource = 'recommendation'  // NEW FIELD
  }

  // 4. Update profile and mark recommendations as applied
  await prisma.$transaction([
    prisma.agentConfig.update({
      where: { projectId },
      data: {
        profile: JSON.parse(JSON.stringify(profile)),
        profileVersion: newVersion,
        profileSource: 'feedback'
      }
    }),
    prisma.profileRecommendation.updateMany({
      where: { setId },
      data: { status: 'applied', appliedAt: new Date() }
    })
  ])

  return { profile, version: await getLatestVersion(projectId) }
}
```

### Rollback Logic

```typescript
export async function rollbackToVersion(
  projectId: string,
  targetVersion: number
): Promise<AgentProfile> {
  // 1. Get target version
  const version = await prisma.profileVersion.findUnique({
    where: { projectId_version: { projectId, version: targetVersion } }
  })

  if (!version) {
    throw new NotFoundError(`Version ${targetVersion} not found`)
  }

  // 2. Restore profile
  await prisma.agentConfig.update({
    where: { projectId },
    data: {
      profile: version.profile,
      profileVersion: targetVersion,
      profileSource: version.source
    }
  })

  return version.profile as AgentProfile
}
```

### API Changes

#### Updated Endpoint: Generate Recommendations

```
POST /api/projects/:projectId/recommendations
```

**Response Changes:**
```typescript
interface GenerateRecommendationsResponse {
  setId: string  // NEW: Groups this set
  recommendations: ProfileRecommendation[]  // NEW: Profile-direct structure
  analysisSummary: AnalysisSummary
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}
```

#### New Endpoint: Apply All Recommendations

```
POST /api/projects/:projectId/recommendations/apply-all
```

**Request:**
```typescript
interface ApplyAllRequest {
  setId: string
}
```

**Response:**
```typescript
interface ApplyAllResponse {
  success: true
  appliedCount: number
  profile: AgentProfile
  version: {
    number: number
    createdAt: string
  }
  rollbackAvailable: true
}
```

#### New Endpoint: Rollback Profile

```
POST /api/projects/:projectId/profile/rollback
```

**Request:**
```typescript
interface RollbackRequest {
  toVersion: number
}
```

**Response:**
```typescript
interface RollbackResponse {
  success: true
  profile: AgentProfile
  restoredVersion: number
}
```

#### New Endpoint: Get Version History

```
GET /api/projects/:projectId/profile/versions
```

**Response:**
```typescript
interface VersionHistoryResponse {
  versions: {
    version: number
    source: string
    createdAt: string
    recommendationSetId?: string
  }[]
  currentVersion: number
}
```

### File Organization

```
backend/src/
├── services/
│   └── recommendationEngine.ts     # Major rewrite
├── controllers/
│   ├── recommendation.controller.ts # Updated + new endpoints
│   └── profile.controller.ts        # NEW: version management
├── routes/
│   ├── recommendation.routes.ts     # Updated routes
│   └── profile.routes.ts            # NEW: version routes
└── types/
    └── recommendation.ts            # Updated types

frontend/src/
├── components/
│   ├── RecommendationPanel.tsx      # Major rewrite for new UI
│   └── ProfileVersionHistory.tsx    # NEW: version dropdown
├── types/
│   └── recommendation.ts            # Updated types
└── lib/
    └── api.ts                       # New API methods
```

## User Experience

### Recommendation Card (New Design)

```
┌─────────────────────────────────────────────────────────────┐
│ Communication Style                          [high confidence]│
├─────────────────────────────────────────────────────────────┤
│ QUICK SUMMARY                                                │
│ • Address stakeholders by name                               │
│ • Adopt audience perspective in framing                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌─────────────────────┐            │
│ │ CURRENT             │  │ WITH CHANGES        │            │
│ │                     │  │                     │            │
│ │ Use a professional  │  │ Use a professional  │            │
│ │ but approachable    │  │ but approachable    │            │
│ │ tone. Be concise.   │  │ tone. Be concise.   │            │
│ │                     │  │                     │            │
│ │                     │  │ [ADDED:]            │            │
│ │                     │  │ When addressing     │            │
│ │                     │  │ stakeholders, use   │            │
│ │                     │  │ their names...      │            │
│ └─────────────────────┘  └─────────────────────┘            │
├─────────────────────────────────────────────────────────────┤
│ WHY: Multiple comments indicated responses felt impersonal   │
│ and didn't acknowledge the reader's perspective.             │
├─────────────────────────────────────────────────────────────┤
│ ▶ 2 related comments                                        │
├─────────────────────────────────────────────────────────────┤
│                                    [Dismiss]  [Include ✓]   │
└─────────────────────────────────────────────────────────────┘
```

### Apply Flow

1. User reviews all recommendations in set
2. Can dismiss individual recommendations
3. Clicks "Apply Changes" (single action for all)
4. System creates version snapshot
5. All pending recommendations applied
6. Success toast: "Changes applied. Rollback available."

### Rollback Flow

1. User clicks version dropdown (shows: "v3 (current)", "v2 (before recs)", "v1 (initial)")
2. Selects previous version
3. Confirmation: "Restore to v2? This will undo the last set of recommendations."
4. Profile restored immediately

## Testing Strategy

### Unit Tests

```typescript
// Purpose: Verify recommendation engine generates profile-direct recommendations
describe('ProfileRecommendationEngine', () => {
  describe('generateProfileRecommendations', () => {
    it('should generate max 1 recommendation per section when multiple comments affect same section', async () => {
      // Validates holistic analysis consolidates comments into single rec per section
    })

    it('should generate ADD operation for new content suggestions', async () => {
      // Validates type: "add" with addedContent populated
    })

    it('should preserve existing content in previewAfter', async () => {
      // Critical: ensures additive behavior - previewAfter contains original + new
    })

    it('should include 2-3 summary bullets', async () => {
      // Validates summaryBullets array length
    })

    it('should link related comment IDs', async () => {
      // Validates relatedCommentIds maps to source comments
    })
  })
})

// Purpose: Verify apply logic correctly modifies profile
describe('applyRecommendations', () => {
  it('should create version snapshot before applying', async () => {
    // Validates ProfileVersion created with pre-change profile
  })

  it('should append addedContent with newline separator for ADD', async () => {
    // Validates section.content = original + '\n\n' + addedContent
  })

  it('should remove exact content for REMOVE operations', async () => {
    // Validates string replacement for removals
  })

  it('should mark sections as edited with recommendation source', async () => {
    // Validates isEdited=true, editSource='recommendation'
  })

  it('should update all recommendations to applied status', async () => {
    // Validates status change in transaction
  })
})

// Purpose: Verify rollback restores correct profile state
describe('rollbackToVersion', () => {
  it('should restore profile from specified version', async () => {
    // Validates profile content matches version snapshot
  })

  it('should throw NotFoundError for invalid version', async () => {
    // Validates error handling
  })
})
```

### Integration Tests

```typescript
// Purpose: Verify full flow from comments to applied recommendations
describe('Recommendation Flow Integration', () => {
  it('should flow: comments → generate → apply → profile updated', async () => {
    // 1. Create test session with comments
    // 2. Call generate recommendations
    // 3. Verify profile-direct recommendations returned
    // 4. Call apply-all
    // 5. Verify profile sections contain added content
  })

  it('should preserve profile content when recommendations are dismissed', async () => {
    // Validates dismiss doesn't modify profile
  })

  it('should allow rollback after apply', async () => {
    // 1. Apply recommendations
    // 2. Rollback to previous version
    // 3. Verify profile restored
  })
})
```

### E2E Tests

```typescript
// Purpose: Verify user can complete recommendation workflow
describe('Recommendation Panel E2E', () => {
  it('should display side-by-side diff with added content highlighted', async () => {
    // Visual verification of diff UI
  })

  it('should show quick summary bullets above rationale', async () => {
    // Verify bullet list renders
  })

  it('should apply all recommendations on single click', async () => {
    // Click "Apply Changes", verify success
  })

  it('should allow rollback from version dropdown', async () => {
    // Select previous version, confirm, verify restoration
  })
})
```

## Performance Considerations

### LLM Analysis

- **Current:** Single LLM call for all recommendations
- **No Change:** Holistic analysis maintains single call
- **Prompt Size:** Profile sections (~20KB max) + comments (~10KB max) stays within context window

### Database Operations

- **Version Snapshots:** Profile JSON stored per version (~5-10KB)
- **Mitigation:** Limit to last 10 versions per project
- **Future:** Cleanup job deferred - not needed for MVP

### Frontend

- **Diff Rendering:** Simple string comparison for side-by-side
- **No Libraries:** Avoid heavy diff libraries for MVP; highlight added content with CSS

## Security Considerations

### Authorization

- All endpoints require authentication
- Project ownership verified before any operation
- Version rollback restricted to project owner

### Input Validation

- `targetSection` validated against enum
- `type` validated against allowed operations
- Content sanitized before storage

### Rate Limiting

- Existing 10 req/hour limit maintained
- Apply-all counts as 1 request (not per-recommendation)

## Documentation

### Updates Required

1. **API Reference:** New endpoints documented
2. **CLAUDE.md:** Update recommendation section to reflect profile-direct targeting
3. **User Guide:** Explain new recommendation workflow with screenshots

## Implementation Phases

### Phase 1: Core Infrastructure (Quick Wins Included)

**Database:**
- Add `ProfileRecommendation` model
- Add `ProfileVersion` model
- Add `profileVersion` field to AgentConfig
- Run migrations

**Quick Wins (Immediate):**
- Change button text: "Apply to Interview" → "Apply Change"
- Add to ANALYSIS_PROMPT: "NEVER suggest deleting content that is unrelated to the feedback"
- Add `editSource` field to ProfileSection type

**Backend:**
- New types in `recommendation.ts`
- Update `generateRecommendations` to target profile sections
- Implement holistic analysis (max 1 rec per section)
- Generate `summaryBullets` and `previewBefore`/`previewAfter`

### Phase 2: Apply & Rollback

**Backend:**
- Implement `applyRecommendations` with version snapshot
- Implement `rollbackToVersion`
- New controller endpoints
- Transaction handling for atomic apply

**Frontend:**
- Update API client with new methods
- Update RecommendationPanel state management

### Phase 3: UI Enhancement

**Frontend:**
- Side-by-side diff component
- Quick Summary bullets section
- "Apply Changes" bulk action button
- Version dropdown with rollback
- Success/rollback toast notifications

## Open Questions

1. **Version Limit:** Should we limit versions to last 10? Or allow unlimited with storage warning?
   - **Proposed:** Limit to 10, auto-cleanup older

2. **Partial Apply:** Should users be able to apply recommendations individually, or always bulk?
   - **Proposed:** Bulk only for MVP, individual in v2

3. **Undo Individual:** If bulk applied, can user undo just one recommendation?
   - **Proposed:** No, rollback is all-or-nothing for MVP

## References

### Related Documents

- `/docs/ideation/profile-direct-additive-recommendations.md` - Original ideation
- `/tmp/research_20251203_additive_surgical_content_modification.md` - Research on JSON Patch and UX patterns
- `specs/feat-recommendation-engine.md` - Original recommendation engine spec
- `specs/feat-recommendation-analysis-summary.md` - Recent AnalysisSummary addition

### External Resources

- [RFC 6902: JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) - Future reference for MODIFY operations
- [fast-json-patch npm](https://www.npmjs.com/package/fast-json-patch) - Potential library for complex patches

### Architectural Decisions

- **Profile as Runtime Artifact:** Profile sections directly control AI behavior; interview is historical record
- **Holistic Analysis:** Max 1 recommendation per section prevents conflicts by design
- **Version Snapshots:** Per-testing-session versioning (not per-recommendation) balances granularity with storage
