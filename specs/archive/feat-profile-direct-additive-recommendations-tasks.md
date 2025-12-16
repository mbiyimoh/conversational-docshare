# Task Breakdown: Profile-Direct Additive Recommendations

**Generated:** 2025-12-04
**Source:** specs/feat-profile-direct-additive-recommendations.md

## Overview

Transform the recommendation system to target profile sections directly with additive operations instead of targeting interview answers with wholesale replacements. Includes version tracking for rollback capability.

---

## Phase 1: Database & Types Foundation

### Task 1.1: Add Prisma Models for ProfileRecommendation and ProfileVersion

**Description:** Add new database models to support profile-direct recommendations and version history
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2

**Technical Requirements:**

Add to `backend/prisma/schema.prisma`:

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

Also add to AgentConfig model:
```prisma
  profileVersion Int @default(1)
```

Also add relations to Project model:
```prisma
  profileRecommendations ProfileRecommendation[]
  profileVersions        ProfileVersion[]
```

**Implementation Steps:**
1. Edit `backend/prisma/schema.prisma`
2. Add ProfileRecommendation model
3. Add ProfileVersion model
4. Add profileVersion field to AgentConfig
5. Add relations to Project model
6. Run `npx prisma migrate dev --name add_profile_recommendations_and_versions`
7. Verify migration succeeds

**Acceptance Criteria:**
- [ ] ProfileRecommendation model created with all fields
- [ ] ProfileVersion model created with all fields
- [ ] AgentConfig has profileVersion field
- [ ] Project has relations to both new models
- [ ] Migration runs successfully
- [ ] `npx prisma generate` produces updated client

---

### Task 1.2: Add TypeScript Types for Profile Recommendations

**Description:** Create TypeScript interfaces for the new recommendation system
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1

**Technical Requirements:**

Update `backend/src/types/recommendation.ts` with new types:

```typescript
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

export interface GenerateRecommendationsResponse {
  setId: string
  recommendations: ProfileRecommendation[]
  analysisSummary: AnalysisSummary
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}

export interface ApplyAllRequest {
  setId: string
}

export interface ApplyAllResponse {
  success: true
  appliedCount: number
  profile: AgentProfile
  version: {
    number: number
    createdAt: string
  }
  rollbackAvailable: true
}

export interface RollbackRequest {
  toVersion: number
}

export interface RollbackResponse {
  success: true
  profile: AgentProfile
  restoredVersion: number
}

export interface VersionHistoryResponse {
  versions: {
    version: number
    source: string
    createdAt: string
    recommendationSetId?: string
  }[]
  currentVersion: number
}
```

Also add `editSource` field to ProfileSection type in profileSynthesizer:
```typescript
interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
  editedAt?: string
  editSource?: 'manual' | 'recommendation'  // NEW
}
```

**Acceptance Criteria:**
- [ ] All interfaces exported from recommendation.ts
- [ ] ProfileSectionKey type matches the 5 profile sections
- [ ] ProfileSection has editSource field
- [ ] Types compile without errors

---

### Task 1.3: Quick Wins - Button Text and Prompt Constraint

**Description:** Implement immediate improvements that don't require major changes
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2

**Technical Requirements:**

1. Change button text in `frontend/src/components/RecommendationPanel.tsx`:
   - Find: `Apply to Interview`
   - Replace: `Apply Change`

2. Add prompt constraint to `backend/src/services/recommendationEngine.ts`:
   - Find the ANALYSIS_PROMPT constant
   - Add to the rules: `"NEVER suggest deleting content that is unrelated to the feedback"`

**Implementation Steps:**
1. Edit RecommendationPanel.tsx, change button text on line ~263
2. Edit recommendationEngine.ts, add constraint to ANALYSIS_PROMPT

**Acceptance Criteria:**
- [ ] Button shows "Apply Change" instead of "Apply to Interview"
- [ ] ANALYSIS_PROMPT includes the new constraint
- [ ] Frontend builds successfully
- [ ] Backend compiles successfully

---

## Phase 2: Backend - Recommendation Generation

### Task 2.1: Rewrite generateRecommendations for Profile-Direct Targeting

**Description:** Update the recommendation engine to generate profile-direct recommendations with holistic analysis
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** None (core logic)

**Technical Requirements:**

Rewrite `backend/src/services/recommendationEngine.ts`:

1. **New PROFILE_ANALYSIS_PROMPT:**
```typescript
const PROFILE_ANALYSIS_PROMPT = `You analyze AI agent testing feedback and generate profile recommendations.

## Current Profile Sections

### Identity & Role
\${profile.sections.identityRole.content}

### Communication Style
\${profile.sections.communicationStyle.content}

### Content Priorities
\${profile.sections.contentPriorities.content}

### Engagement Approach
\${profile.sections.engagementApproach.content}

### Key Framings
\${profile.sections.keyFramings.content}

## Testing Feedback Comments (\${comments.length} total)

\${formattedComments}

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
      "addedContent": "Content to append...",
      "summaryBullets": ["Bullet 1", "Bullet 2"],
      "rationale": "Why this change is needed...",
      "relatedCommentIds": ["comment-123", "comment-456"]
    }
  ]
}

If no changes needed, return empty recommendations array with noChangeReason.
`
```

2. **Update generateRecommendations function:**
- Fetch profile from AgentConfig (not just interview data)
- Build prompt with profile sections
- Parse response and validate
- Generate setId (UUID)
- Compute previewBefore (current section content) and previewAfter (with addition)
- Store recommendations in ProfileRecommendation table
- Return RecommendationSet

3. **Key implementation changes:**
```typescript
import { v4 as uuidv4 } from 'uuid'

export async function generateRecommendations(projectId: string): Promise<RecommendationSet> {
  // Get profile (not interview data)
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
    select: { profile: true }
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Profile not found - complete interview first')
  }

  const profile = agentConfig.profile as AgentProfile

  // Get comments (existing logic)
  const comments = await getTestComments(projectId)

  // Build prompt with profile sections
  const prompt = buildProfileAnalysisPrompt(profile, comments)

  // Call LLM
  const response = await callLLM(prompt)

  // Parse and validate
  const parsed = parseProfileRecommendations(response)

  // Generate setId
  const setId = uuidv4()

  // Compute previews and store
  const recommendations = await Promise.all(
    parsed.recommendations.map(async (rec) => {
      const section = profile.sections[rec.targetSection]
      const previewBefore = section.content
      const previewAfter = computePreviewAfter(section.content, rec)

      return prisma.profileRecommendation.create({
        data: {
          projectId,
          setId,
          type: rec.type,
          targetSection: rec.targetSection,
          addedContent: rec.addedContent,
          summaryBullets: rec.summaryBullets,
          previewBefore,
          previewAfter,
          rationale: rec.rationale,
          relatedCommentIds: rec.relatedCommentIds,
          status: 'pending'
        }
      })
    })
  )

  return {
    setId,
    recommendations,
    analysisSummary: parsed.analysisSummary,
    totalComments: comments.length,
    sessionsAnalyzed: countUniqueSessions(comments),
    generatedAt: new Date().toISOString()
  }
}

function computePreviewAfter(currentContent: string, rec: ParsedRecommendation): string {
  switch (rec.type) {
    case 'add':
      return currentContent.trim() + '\n\n' + rec.addedContent
    case 'remove':
      return currentContent.replace(rec.removedContent!, '').trim()
    case 'modify':
      return currentContent.replace(rec.modifiedFrom!, rec.modifiedTo!)
    default:
      return currentContent
  }
}
```

**Acceptance Criteria:**
- [ ] Function fetches profile (not interview data)
- [ ] Prompt includes all 5 profile sections
- [ ] LLM response parsed correctly
- [ ] setId generated as UUID
- [ ] previewBefore and previewAfter computed correctly
- [ ] Recommendations stored in database
- [ ] Returns RecommendationSet with all fields
- [ ] Max 1 recommendation per section enforced

---

### Task 2.2: Implement applyRecommendations Function

**Description:** Create function to apply pending recommendations with version snapshot
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.3

**Technical Requirements:**

Add to `backend/src/services/recommendationEngine.ts`:

```typescript
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
  const newVersion = (agentConfig.profileVersion || 1) + 1
  const versionRecord = await prisma.profileVersion.create({
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
        section.content = section.content.trim() + '\n\n' + rec.addedContent
        break
      case 'remove':
        section.content = section.content.replace(rec.removedContent!, '').trim()
        break
      case 'modify':
        section.content = section.content.replace(rec.modifiedFrom!, rec.modifiedTo!)
        break
    }

    section.isEdited = true
    section.editedAt = new Date().toISOString()
    section.editSource = 'recommendation'
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

  return {
    profile,
    version: {
      id: versionRecord.id,
      projectId,
      version: newVersion,
      profile,
      source: 'recommendation',
      recommendationSetId: setId,
      createdAt: versionRecord.createdAt.toISOString()
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Creates version snapshot before applying
- [ ] Concurrent apply protection works (ConflictError if already applied)
- [ ] ADD appends with '\n\n' separator
- [ ] REMOVE removes exact content
- [ ] MODIFY replaces exact phrase
- [ ] Marks sections with isEdited, editedAt, editSource
- [ ] Updates profileVersion in AgentConfig
- [ ] Marks recommendations as applied with timestamp
- [ ] Uses transaction for atomicity

---

### Task 2.3: Implement rollbackToVersion Function

**Description:** Create function to rollback profile to a previous version
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.2

**Technical Requirements:**

Add to `backend/src/services/recommendationEngine.ts`:

```typescript
export async function rollbackToVersion(
  projectId: string,
  targetVersion: number
): Promise<AgentProfile> {
  // 1. Get target version
  const version = await prisma.profileVersion.findUnique({
    where: {
      projectId_version: { projectId, version: targetVersion }
    }
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

export async function getVersionHistory(projectId: string): Promise<VersionHistoryResponse> {
  const versions = await prisma.profileVersion.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    take: 10,  // Limit to last 10 versions
    select: {
      version: true,
      source: true,
      createdAt: true,
      recommendationSetId: true
    }
  })

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
    select: { profileVersion: true }
  })

  return {
    versions: versions.map(v => ({
      version: v.version,
      source: v.source,
      createdAt: v.createdAt.toISOString(),
      recommendationSetId: v.recommendationSetId || undefined
    })),
    currentVersion: agentConfig?.profileVersion || 1
  }
}
```

**Acceptance Criteria:**
- [ ] Finds version by composite key (projectId + version)
- [ ] Throws NotFoundError for invalid version
- [ ] Restores profile JSON to AgentConfig
- [ ] Updates profileVersion and profileSource
- [ ] getVersionHistory returns last 10 versions
- [ ] Versions ordered by version descending

---

### Task 2.4: Add Controller Endpoints for Apply-All and Rollback

**Description:** Create API endpoints for applying recommendations and rollback
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2, Task 2.3
**Can run parallel with:** None

**Technical Requirements:**

Update `backend/src/controllers/recommendation.controller.ts`:

```typescript
import { applyRecommendations, rollbackToVersion, getVersionHistory } from '../services/recommendationEngine'

export async function applyAllRecommendations(req: Request, res: Response) {
  const { userId } = req.user as { userId: string }
  const { projectId } = req.params
  const { setId } = req.body as ApplyAllRequest

  // Verify ownership
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('Project not found')
  if (project.ownerId !== userId) throw new AuthorizationError('You do not own this project')

  // Apply recommendations
  const { profile, version } = await applyRecommendations(projectId, setId)

  res.json({
    success: true,
    appliedCount: await prisma.profileRecommendation.count({
      where: { setId, status: 'applied' }
    }),
    profile,
    version: {
      number: version.version,
      createdAt: version.createdAt
    },
    rollbackAvailable: true
  } as ApplyAllResponse)
}

export async function rollbackProfile(req: Request, res: Response) {
  const { userId } = req.user as { userId: string }
  const { projectId } = req.params
  const { toVersion } = req.body as RollbackRequest

  // Verify ownership
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('Project not found')
  if (project.ownerId !== userId) throw new AuthorizationError('You do not own this project')

  const profile = await rollbackToVersion(projectId, toVersion)

  res.json({
    success: true,
    profile,
    restoredVersion: toVersion
  } as RollbackResponse)
}

export async function getProfileVersions(req: Request, res: Response) {
  const { userId } = req.user as { userId: string }
  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('Project not found')
  if (project.ownerId !== userId) throw new AuthorizationError('You do not own this project')

  const history = await getVersionHistory(projectId)
  res.json(history)
}
```

Update `backend/src/routes/recommendation.routes.ts`:

```typescript
router.post('/:projectId/recommendations/apply-all', asyncHandler(applyAllRecommendations))
router.post('/:projectId/profile/rollback', asyncHandler(rollbackProfile))
router.get('/:projectId/profile/versions', asyncHandler(getProfileVersions))
```

**Acceptance Criteria:**
- [ ] POST /api/projects/:projectId/recommendations/apply-all works
- [ ] POST /api/projects/:projectId/profile/rollback works
- [ ] GET /api/projects/:projectId/profile/versions works
- [ ] All endpoints verify project ownership
- [ ] Returns correct response shapes
- [ ] Handles errors appropriately

---

### Task 2.5: Update getRecommendations to Return Profile-Direct Structure

**Description:** Update the existing getRecommendations controller to return the new structure
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.4

**Technical Requirements:**

Update the response format in `recommendation.controller.ts`:

```typescript
export async function getRecommendations(req: Request, res: Response) {
  // ... existing auth/ownership checks ...

  const result = await generateRecommendations(projectId)

  res.json({
    setId: result.setId,
    recommendations: result.recommendations,
    analysisSummary: result.analysisSummary,
    totalComments: result.totalComments,
    sessionsAnalyzed: result.sessionsAnalyzed,
    generatedAt: result.generatedAt
  } as GenerateRecommendationsResponse)
}
```

**Acceptance Criteria:**
- [ ] Response includes setId
- [ ] Recommendations are ProfileRecommendation[] not legacy format
- [ ] All fields present in response
- [ ] Existing rate limiting still works

---

## Phase 3: Frontend - UI Updates

### Task 3.1: Update Frontend Types

**Description:** Add new TypeScript types to frontend
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 3.2

**Technical Requirements:**

Update `frontend/src/types/recommendation.ts`:

```typescript
export interface ProfileRecommendation {
  id: string
  setId: string
  type: 'add' | 'remove' | 'modify'
  targetSection: ProfileSectionKey
  addedContent?: string
  removedContent?: string
  modifiedFrom?: string
  modifiedTo?: string
  summaryBullets: string[]
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

export interface RecommendationResponse {
  setId: string
  recommendations: ProfileRecommendation[]
  analysisSummary: AnalysisSummary
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}

export interface ApplyAllResponse {
  success: true
  appliedCount: number
  version: {
    number: number
    createdAt: string
  }
  rollbackAvailable: true
}

export interface VersionHistoryResponse {
  versions: {
    version: number
    source: string
    createdAt: string
    recommendationSetId?: string
  }[]
  currentVersion: number
}
```

**Acceptance Criteria:**
- [ ] All types match backend types
- [ ] Frontend compiles without errors

---

### Task 3.2: Update API Client with New Methods

**Description:** Add new API methods for apply-all and rollback
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.4
**Can run parallel with:** Task 3.1

**Technical Requirements:**

Update `frontend/src/lib/api.ts`:

```typescript
async applyAllRecommendations(projectId: string, setId: string): Promise<ApplyAllResponse> {
  return this.request<ApplyAllResponse>(
    `/api/projects/${projectId}/recommendations/apply-all`,
    {
      method: 'POST',
      body: JSON.stringify({ setId }),
    }
  )
}

async rollbackProfile(projectId: string, toVersion: number): Promise<{ success: true; restoredVersion: number }> {
  return this.request(
    `/api/projects/${projectId}/profile/rollback`,
    {
      method: 'POST',
      body: JSON.stringify({ toVersion }),
    }
  )
}

async getProfileVersions(projectId: string): Promise<VersionHistoryResponse> {
  return this.request<VersionHistoryResponse>(
    `/api/projects/${projectId}/profile/versions`
  )
}
```

**Acceptance Criteria:**
- [ ] applyAllRecommendations method works
- [ ] rollbackProfile method works
- [ ] getProfileVersions method works
- [ ] All methods use correct HTTP methods and paths

---

### Task 3.3: Rewrite RecommendationPanel for Side-by-Side Diff

**Description:** Update RecommendationPanel to show side-by-side diff with quick summary
**Size:** Large
**Priority:** High
**Dependencies:** Task 3.1, Task 3.2
**Can run parallel with:** None

**Technical Requirements:**

Rewrite `frontend/src/components/RecommendationPanel.tsx`:

1. **Update state to handle new structure:**
```typescript
const [recommendations, setRecommendations] = useState<ProfileRecommendation[]>([])
const [setId, setSetId] = useState<string | null>(null)
const [applyingAll, setApplyingAll] = useState(false)
```

2. **Update loadRecommendations:**
```typescript
const loadRecommendations = async () => {
  const response = await api.getRecommendations(projectId)
  setRecommendations(response.recommendations)
  setSetId(response.setId)
  setStats({
    totalComments: response.totalComments,
    sessionsAnalyzed: response.sessionsAnalyzed,
    analysisSummary: response.analysisSummary,
  })
}
```

3. **New recommendation card design:**
```tsx
{pendingRecs.map((rec) => (
  <div key={rec.id} className="border rounded-lg p-4">
    {/* Section name with confidence */}
    <div className="flex justify-between mb-3">
      <span className="font-medium capitalize">
        {rec.targetSection.replace(/([A-Z])/g, ' $1').trim()}
      </span>
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
        {rec.type.toUpperCase()}
      </span>
    </div>

    {/* Quick Summary */}
    <div className="mb-3 bg-gray-50 rounded p-3">
      <div className="text-xs font-medium text-gray-500 mb-1">QUICK SUMMARY</div>
      <ul className="list-disc list-inside text-sm">
        {rec.summaryBullets.map((bullet, i) => (
          <li key={i}>{bullet}</li>
        ))}
      </ul>
    </div>

    {/* Side-by-side diff */}
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-gray-50 rounded p-3">
        <div className="text-xs font-medium text-gray-500 mb-1">CURRENT</div>
        <div className="text-sm whitespace-pre-wrap">{rec.previewBefore}</div>
      </div>
      <div className="bg-green-50 rounded p-3">
        <div className="text-xs font-medium text-green-600 mb-1">WITH CHANGES</div>
        <div className="text-sm whitespace-pre-wrap">{rec.previewAfter}</div>
      </div>
    </div>

    {/* Rationale */}
    <div className="text-sm text-gray-600 mb-3">
      <strong>WHY:</strong> {rec.rationale}
    </div>

    {/* Related comments */}
    {rec.relatedCommentIds.length > 0 && (
      <button className="text-sm text-blue-600">
        ▶ {rec.relatedCommentIds.length} related comments
      </button>
    )}

    {/* Actions */}
    <div className="flex justify-end gap-2 mt-3">
      <button onClick={() => handleDismiss(rec.id)} className="px-3 py-1 text-gray-600">
        Dismiss
      </button>
      <button
        onClick={() => handleInclude(rec.id)}
        className="px-3 py-1 bg-green-100 text-green-700 rounded"
      >
        Include ✓
      </button>
    </div>
  </div>
))}
```

4. **Add Apply Changes button:**
```tsx
{pendingRecs.length > 0 && (
  <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
    <button
      onClick={handleApplyAll}
      disabled={applyingAll}
      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {applyingAll ? 'Applying...' : `Apply Changes (${pendingRecs.length})`}
    </button>
  </div>
)}
```

5. **handleApplyAll function:**
```typescript
const handleApplyAll = async () => {
  if (!setId) return
  setApplyingAll(true)
  try {
    const result = await api.applyAllRecommendations(projectId, setId)
    // Show success toast
    toast.success(`${result.appliedCount} changes applied. Rollback available.`)
    // Mark all as applied
    setRecommendations(prev => prev.map(r => ({ ...r, status: 'applied' })))
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to apply')
  } finally {
    setApplyingAll(false)
  }
}
```

**Acceptance Criteria:**
- [ ] Side-by-side diff shows previewBefore and previewAfter
- [ ] Quick Summary bullets displayed above diff
- [ ] Section name shown (human-readable, not camelCase)
- [ ] Type badge shows ADD/REMOVE/MODIFY
- [ ] Rationale displayed
- [ ] "Apply Changes" button applies all pending at once
- [ ] Success toast shows after apply
- [ ] Loading state during apply

---

### Task 3.4: Add Version Dropdown for Rollback

**Description:** Add version history dropdown with rollback capability
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.3
**Can run parallel with:** None

**Technical Requirements:**

Create `frontend/src/components/ProfileVersionHistory.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { VersionHistoryResponse } from '../types/recommendation'

interface ProfileVersionHistoryProps {
  projectId: string
  onRollback: () => void
}

export function ProfileVersionHistory({ projectId, onRollback }: ProfileVersionHistoryProps) {
  const [versions, setVersions] = useState<VersionHistoryResponse['versions']>([])
  const [currentVersion, setCurrentVersion] = useState(1)
  const [isOpen, setIsOpen] = useState(false)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    loadVersions()
  }, [projectId])

  const loadVersions = async () => {
    const data = await api.getProfileVersions(projectId)
    setVersions(data.versions)
    setCurrentVersion(data.currentVersion)
  }

  const handleRollback = async (version: number) => {
    if (!confirm(`Restore to v${version}? This will undo changes since then.`)) return

    setRolling(true)
    try {
      await api.rollbackProfile(projectId, version)
      setCurrentVersion(version)
      setIsOpen(false)
      onRollback()
    } catch (err) {
      alert('Failed to rollback')
    } finally {
      setRolling(false)
    }
  }

  const formatSource = (source: string) => {
    switch (source) {
      case 'interview': return 'Initial'
      case 'manual': return 'Manual edit'
      case 'recommendation': return 'Recommendations'
      default: return source
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        v{currentVersion} ▼
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-10">
          {versions.map((v) => (
            <button
              key={v.version}
              onClick={() => v.version !== currentVersion && handleRollback(v.version)}
              disabled={v.version === currentVersion || rolling}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                v.version === currentVersion ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              <div className="font-medium">
                v{v.version} {v.version === currentVersion && '(current)'}
              </div>
              <div className="text-xs text-gray-500">
                {formatSource(v.source)} • {new Date(v.createdAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

Integrate into RecommendationPanel header.

**Acceptance Criteria:**
- [ ] Version dropdown shows last 10 versions
- [ ] Current version highlighted
- [ ] Shows source type (Initial/Manual/Recommendations)
- [ ] Confirmation dialog before rollback
- [ ] Rollback updates profile
- [ ] Dropdown closes after action

---

## Phase 4: Testing

### Task 4.1: Add Unit Tests for Recommendation Engine

**Description:** Write unit tests for the new recommendation engine functions
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1, Task 2.2, Task 2.3
**Can run parallel with:** Task 4.2

**Technical Requirements:**

Create/update `backend/src/services/__tests__/recommendationEngine.test.ts`:

```typescript
describe('ProfileRecommendationEngine', () => {
  describe('generateProfileRecommendations', () => {
    it('should generate max 1 recommendation per section when multiple comments affect same section', async () => {
      // Setup: Multiple comments about communication style
      // Assert: Only 1 recommendation for communicationStyle
    })

    it('should generate ADD operation for new content suggestions', async () => {
      // Verify type: "add" and addedContent populated
    })

    it('should preserve existing content in previewAfter', async () => {
      // Critical: previewAfter = original + '\n\n' + addedContent
    })

    it('should include 2-3 summary bullets', async () => {
      // Verify summaryBullets.length >= 2 && <= 3
    })

    it('should link related comment IDs', async () => {
      // Verify relatedCommentIds match source comments
    })

    it('should store recommendations in database', async () => {
      // Verify ProfileRecommendation records created
    })
  })

  describe('applyRecommendations', () => {
    it('should create version snapshot before applying', async () => {
      // Verify ProfileVersion created with original profile
    })

    it('should throw ConflictError if already applied', async () => {
      // Apply once, try again, expect ConflictError
    })

    it('should append addedContent with newline separator for ADD', async () => {
      // Verify: original + '\n\n' + added
    })

    it('should mark sections as edited with recommendation source', async () => {
      // Verify isEdited=true, editSource='recommendation'
    })

    it('should update all recommendations to applied status', async () => {
      // Verify status='applied', appliedAt set
    })
  })

  describe('rollbackToVersion', () => {
    it('should restore profile from specified version', async () => {
      // Create version, modify profile, rollback, verify restored
    })

    it('should throw NotFoundError for invalid version', async () => {
      // Verify error for non-existent version
    })
  })
})
```

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Tests cover happy path and error cases
- [ ] Tests use real database (not mocks) where appropriate
- [ ] Tests clean up after themselves

---

### Task 4.2: Add Integration Tests

**Description:** Write integration tests for the full recommendation flow
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.4, Task 2.5
**Can run parallel with:** Task 4.1

**Technical Requirements:**

Create `backend/src/controllers/__tests__/recommendation.integration.test.ts`:

```typescript
describe('Recommendation Flow Integration', () => {
  it('should flow: comments → generate → apply → profile updated', async () => {
    // 1. Create project with profile
    // 2. Create test session with comments
    // 3. POST /recommendations
    // 4. Verify response has setId and ProfileRecommendation[]
    // 5. POST /recommendations/apply-all
    // 6. GET profile, verify content added
  })

  it('should preserve profile content when recommendations are dismissed', async () => {
    // 1. Generate recommendations
    // 2. Don't apply (dismiss)
    // 3. Verify profile unchanged
  })

  it('should allow rollback after apply', async () => {
    // 1. Record original profile
    // 2. Apply recommendations
    // 3. POST /profile/rollback
    // 4. Verify profile matches original
  })
})
```

**Acceptance Criteria:**
- [ ] Full flow tested end-to-end
- [ ] Tests use API endpoints (not direct function calls)
- [ ] Tests verify database state changes

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Foundation | 1.1, 1.2, 1.3 | High |
| Phase 2: Backend | 2.1, 2.2, 2.3, 2.4, 2.5 | High |
| Phase 3: Frontend | 3.1, 3.2, 3.3, 3.4 | High/Medium |
| Phase 4: Testing | 4.1, 4.2 | High/Medium |

**Total Tasks:** 13
**Critical Path:** 1.1 → 2.1 → 2.2 → 2.4 → 3.3

**Parallel Execution Opportunities:**
- Task 1.1 + 1.2 + 1.3 (all foundation)
- Task 2.2 + 2.3 (both depend on 2.1)
- Task 3.1 + 3.2 (frontend types + API client)
- Task 4.1 + 4.2 (unit + integration tests)
