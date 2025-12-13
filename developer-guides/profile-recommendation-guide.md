# Profile Recommendation System - Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROFILE RECOMMENDATION SYSTEM                            │
│       Analyzes Testing Dojo comments to improve AI agent profiles           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. GENERATE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                Testing Dojo Comments                                 │   │
│  │                                                                       │   │
│  │  TestComment { content, templateId, messageId }                      │   │
│  │  ├── templateId: 'identity'      → identityRole                      │   │
│  │  ├── templateId: 'communication' → communicationStyle                │   │
│  │  ├── templateId: 'content'       → contentPriorities                 │   │
│  │  ├── templateId: 'engagement'    → engagementApproach                │   │
│  │  └── templateId: 'framing'       → keyFramings                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│                                         ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   recommendationEngine.ts                            │   │
│  │                                                                       │   │
│  │  generateRecommendations():                                          │   │
│  │  1. Fetch up to 50 recent comments                                   │   │
│  │  2. Fetch current profile sections                                   │   │
│  │  3. Build LLM prompt with profile + comments                         │   │
│  │  4. Call GPT-4-turbo (temperature 0.7, 30s timeout)                  │   │
│  │  5. Parse JSON response                                              │   │
│  │  6. Enforce max 1 recommendation per section                         │   │
│  │  7. Filter out no-op recommendations (before == after)               │   │
│  │  8. Create ProfileRecommendation records                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│  2. REVIEW                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   RecommendationPanel.tsx                            │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                  Analysis Summary                            │    │   │
│  │  │  overview, feedbackThemes[], configAlignment                 │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │              Per-Section Recommendations                     │    │   │
│  │  │                                                               │    │   │
│  │  │  type: ADD | REMOVE | MODIFY                                 │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐                           │    │   │
│  │  │  │   BEFORE    │  │   AFTER     │  Side-by-side diff        │    │   │
│  │  │  │  (red bg)   │  │  (green bg) │                           │    │   │
│  │  │  └─────────────┘  └─────────────┘                           │    │   │
│  │  │                                                               │    │   │
│  │  │  summaryBullets[], rationale                                 │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │  [ Apply All Recommendations ]                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│  3. APPLY                               ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      applyRecommendations()                          │   │
│  │                                                                       │   │
│  │  1. Create ProfileVersion snapshot (BEFORE changes)                  │   │
│  │  2. For each pending recommendation:                                 │   │
│  │     ├── ADD:    section.content += '\n\n' + addedContent            │   │
│  │     ├── REMOVE: section.content.replace(removedContent, '')         │   │
│  │     └── MODIFY: section.content.replace(modifiedFrom, modifiedTo)   │   │
│  │  3. Update section metadata (isEdited, editedAt, editSource)        │   │
│  │  4. Save profile to AgentConfig                                      │   │
│  │  5. Mark recommendations as 'applied'                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│  4. ROLLBACK (if needed)                ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   AgentProfile.tsx + Version History                 │   │
│  │                                                                       │   │
│  │  ProfileVersion { version, profile (JSON), source, createdAt }       │   │
│  │                                                                       │   │
│  │  Version dropdown: v1, v2, v3... (current)                           │   │
│  │  Rollback = creates NEW version with old content (non-destructive)   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dependencies & Key Functions

### External Dependencies
- `openai` - GPT-4-turbo for recommendation generation
- `diff` - Word-level diff for apply modal preview
- `prisma` - ProfileRecommendation, ProfileVersion models

### Internal Dependencies
- `backend/src/services/profileSynthesizer.ts` - Profile types, section constants
- `frontend/src/lib/tiptapUtils.ts` - Text extraction for diff

### Provided Functions

**recommendationEngine.ts:**
- `generateRecommendations(projectId)` - Analyze comments, create recommendations
- `applyRecommendations(projectId, setId)` - Apply all pending from a set
- `dismissRecommendation(recommendationId)` - Mark as dismissed
- `rollbackToVersion(projectId, targetVersion)` - Restore old profile
- `getVersionHistory(projectId)` - Get last 10 versions

### Configuration
- `LLM_TIMEOUT_MS = 30000` - 30 second timeout
- `MAX_COMMENTS = 50` - Limit comments in prompt
- `RATE_LIMIT = 10` - Requests per hour per project

## User Experience Flow

### Generate → Review → Apply

1. **Creator ends Testing Dojo session** → Clicks "End & Apply Feedback"
2. **Backend fetches comments** → Up to 50 most recent
3. **LLM analyzes comments** → Synthesizes into recommendations
4. **RecommendationPanel opens** → Shows analysis summary
5. **Creator reviews each recommendation** → Before/after diff
6. **Creator clicks "Apply All"** → Profile updated
7. **ProfileVersion created** → Snapshot for rollback
8. **Success screen** → Navigate to profile or share

### Recommendation Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `ADD` | Append new content | `addedContent` |
| `REMOVE` | Delete specific phrase | `removedContent` (exact text) |
| `MODIFY` | Replace phrase | `modifiedFrom`, `modifiedTo` |

## File & Code Mapping

### Key Files

| File | Responsibility | Lines |
|------|----------------|-------|
| `backend/src/services/recommendationEngine.ts` | Core recommendation logic | 550 |
| `backend/src/controllers/recommendation.controller.ts` | HTTP handlers, rate limiting | 398 |
| `backend/src/types/recommendation.ts` | TypeScript types | 290 |
| `frontend/src/components/RecommendationPanel.tsx` | Main review UI | 333 |
| `frontend/src/components/RecommendationCard.tsx` | Individual rec card | 229 |
| `frontend/src/components/RecommendationApplyModal.tsx` | Diff preview modal | 181 |
| `frontend/src/components/AgentProfile.tsx` | Version history dropdown | 503 |

### Entry Points

- **Generate:** `POST /api/projects/:projectId/recommendations`
- **Apply All:** `POST /api/projects/:projectId/recommendations/apply-all`
- **Dismiss:** `POST /api/projects/:projectId/recommendations/:id/dismiss`
- **Rollback:** `POST /api/projects/:projectId/profile/rollback`
- **Versions:** `GET /api/projects/:projectId/profile/versions`

### Database Models

```prisma
ProfileRecommendation {
  id, projectId, setId (groups batch)
  type: 'add' | 'remove' | 'modify'
  targetSection: 'identityRole' | 'communicationStyle' | ...

  addedContent, removedContent, modifiedFrom, modifiedTo

  summaryBullets (JSON), previewBefore, previewAfter
  rationale, relatedCommentIds (JSON)

  status: 'pending' | 'applied' | 'dismissed'
  appliedAt
}

ProfileVersion {
  id, projectId, version (sequential)
  profile (JSON snapshot)
  source: 'interview' | 'recommendation' | 'manual'
  recommendationSetId
  createdAt
}
```

## Connections to Other Parts

### Integration Points

| System | Connection |
|--------|------------|
| Testing Dojo | Comments feed into `generateRecommendations()` |
| Profile Synthesizer | Recommendations modify synthesized profile |
| Context Layers | Updated profile → updated AI behavior |
| Chat System | Changes reflected in next chat session |

### Data Flow

```
TestComment records (from Testing Dojo)
    ↓
generateRecommendations() fetches comments
    ↓
LLM analyzes comments + current profile
    ↓
ProfileRecommendation records created
    ↓
RecommendationPanel shows for review
    ↓
applyRecommendations() updates profile
    ↓
ProfileVersion created (snapshot)
    ↓
AgentConfig.profile updated
    ↓
Next chat uses updated profile
```

## Critical Notes & Pitfalls

### CRITICAL: LLM Prompt Field Requirements

**The Problem:**
LLMs often omit required fields when generating structured JSON output.

**The Solution:**
Explicit field requirements in the prompt:

```typescript
// recommendationEngine.ts:95-98
`CRITICAL FIELD REQUIREMENTS:
- For "add" type: "addedContent" is REQUIRED and must contain NEW text to append
- For "remove" type: "removedContent" is REQUIRED and must be EXACT text that exists
- For "modify" type: "modifiedFrom" (EXACT existing text) and "modifiedTo" are BOTH REQUIRED`
```

**Without this instruction, LLM might return:**
```json
{
  "type": "add",
  "targetSection": "communicationStyle",
  "summaryBullets": ["Add guidance about tone"]
  // ❌ Missing addedContent field!
}
```

**With explicit requirements:**
```json
{
  "type": "add",
  "targetSection": "communicationStyle",
  "addedContent": "When discussing technical details, use analogies.",
  "summaryBullets": ["Add guidance about using analogies"]
  // ✅ All required fields present
}
```

### Diff Validation

**Pattern:** Always validate before/after differ before showing recommendation.

```typescript
// recommendationEngine.ts:274-288
const normalizedBefore = section.content.trim().replace(/\s+/g, ' ')
const normalizedAfter = previewAfter.trim().replace(/\s+/g, ' ')

if (normalizedBefore === normalizedAfter) {
  console.warn(`Skipping: before and after are identical`)
  return false  // Filter out no-op
}
```

**Why:** LLM might suggest "changes" that result in identical content after whitespace normalization.

### Rate Limiting

```typescript
// recommendation.controller.ts:14-36
const RATE_LIMIT = 10  // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000

function checkRateLimit(projectId: string): void {
  const record = requestCounts.get(projectId)
  if (record && record.count >= RATE_LIMIT) {
    throw new RateLimitError(`Rate limit exceeded. Try again in ${minutesRemaining} minutes.`)
  }
}
```

### Concurrent Apply Protection

```typescript
// recommendationEngine.ts:386-391
const alreadyApplied = await prisma.profileRecommendation.findFirst({
  where: { setId, status: 'applied' }
})
if (alreadyApplied) {
  throw new ConflictError('This recommendation set has already been applied')
}
```

### Transactional Updates

```typescript
// recommendationEngine.ts:436-449
await prisma.$transaction([
  prisma.agentConfig.update({
    where: { projectId },
    data: { profile, profileVersion: newVersion, profileSource: 'feedback' }
  }),
  prisma.profileRecommendation.updateMany({
    where: { setId },
    data: { status: 'applied', appliedAt: new Date() }
  })
])
```

### Non-Destructive Versioning

```typescript
// Rollback creates NEW version, doesn't delete history
const result = await createDocumentVersion(
  documentId,
  targetVersionRecord.content,
  userId,
  `Rollback to version ${targetVersion}`
)
```

## Common Development Scenarios

### 1. Adding a New Profile Section

**Files to modify:**
1. `backend/src/services/profileSynthesizer.ts`:
   - Add to `SECTION_ORDER`, `SECTION_NAMES`, `SECTION_DESCRIPTIONS`
2. `backend/src/services/recommendationEngine.ts`:
   - Add to `VALID_SECTION_IDS` array
3. `frontend/src/components/AgentProfile.tsx`:
   - Add section display

### 2. Modifying Recommendation Generation Prompt

**File:** `backend/src/services/recommendationEngine.ts:31-103`

**Key sections of prompt:**
- Current profile sections (line 35-55)
- Comments list (line 60-70)
- Operation types (line 75-85)
- Field requirements (line 95-98)
- JSON output format (line 100-120)

### 3. Debugging "No Recommendations Generated"

**Steps:**
1. Check if there are comments: Query `TestComment` table
2. Check rate limiting: Is projectId rate-limited?
3. Check LLM response: Add logging to `generateRecommendations()`
4. Check validation: Are recommendations being filtered as no-ops?

**Add logging:**
```typescript
console.log('[Recommendations] Raw LLM response:', content)
console.log('[Recommendations] Parsed recommendations:', parsed.recommendations?.length)
console.log('[Recommendations] After validation:', effectiveRecs.length)
```

### 4. Adding Recommendation Status

**If you need more statuses (e.g., 'review_later'):**

1. Update schema:
   ```prisma
   status String @default("pending") // pending | applied | dismissed | review_later
   ```
2. Add controller endpoint for new status transition
3. Update frontend UI to show/handle new status

## Testing Strategy

### Manual Testing Checklist
- [ ] Create test session with comments
- [ ] End session with "Apply Feedback"
- [ ] Verify recommendations generated (≤ 1 per section)
- [ ] Review before/after diff
- [ ] Apply all recommendations
- [ ] Verify profile updated
- [ ] Check version history shows new version
- [ ] Test rollback to previous version

### Smoke Tests
```bash
# Generate recommendations
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/projects/$PROJECT_ID/recommendations

# Get version history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/projects/$PROJECT_ID/profile/versions
```

### Debugging Tips
- Check `ProfileRecommendation` table for generated recs
- Look for `[Recommendations]` logs in backend
- Verify `setId` groups related recommendations
- Test LLM prompt directly in OpenAI Playground

## Quick Reference

### Recommendation Types

| Type | Required Fields | Operation |
|------|-----------------|-----------|
| `add` | `addedContent` | `content += '\n\n' + addedContent` |
| `remove` | `removedContent` | `content.replace(removedContent, '')` |
| `modify` | `modifiedFrom`, `modifiedTo` | `content.replace(modifiedFrom, modifiedTo)` |

### Profile Sections

| ID | Display Name |
|----|--------------|
| `identityRole` | Identity & Role |
| `communicationStyle` | Communication Style |
| `contentPriorities` | Content Priorities |
| `engagementApproach` | Engagement Approach |
| `keyFramings` | Key Framings |

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/projects/:id/recommendations` | Generate |
| POST | `/api/projects/:id/recommendations/apply-all` | Apply all |
| POST | `/api/projects/:id/recommendations/:rid/dismiss` | Dismiss |
| POST | `/api/projects/:id/profile/rollback` | Rollback |
| GET | `/api/projects/:id/profile/versions` | History |

### Configuration Summary

| Setting | Value | Location |
|---------|-------|----------|
| LLM Timeout | 30s | recommendationEngine.ts |
| Max Comments | 50 | recommendationEngine.ts |
| Rate Limit | 10/hour | recommendation.controller.ts |
| Model | gpt-4-turbo | recommendationEngine.ts |
| Temperature | 0.7 | recommendationEngine.ts |
| Version History | 10 max | recommendationEngine.ts |

### Critical Files Checklist
1. `backend/src/services/recommendationEngine.ts` - Core logic
2. `backend/src/controllers/recommendation.controller.ts` - API handlers
3. `frontend/src/components/RecommendationPanel.tsx` - Review UI
4. `frontend/src/components/AgentProfile.tsx` - Version dropdown
5. `backend/prisma/schema.prisma` - ProfileRecommendation, ProfileVersion
