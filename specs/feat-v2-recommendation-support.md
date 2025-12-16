# V2 Profile Recommendation System Support

## Status
Implemented

## Authors
Claude | December 16, 2025

## Overview
Extend the Testing Dojo recommendation system to support V2 braindump profiles (12 fields) in addition to V1 interview profiles (5 sections). This enables users who created profiles via braindump to receive AI-driven improvement recommendations from Testing Dojo feedback.

## Problem Statement
The Testing Dojo recommendation system currently only works with V1 interview-based profiles. Users who create profiles via braindump (V2 profiles with 12 fields) cannot receive recommendations because:
1. `ProfileSectionKey` type is hardcoded to 5 V1 section names
2. `SECTION_DISPLAY_NAMES` only maps V1 sections
3. Backend validation rejects V2 field IDs
4. LLM prompt only references V1 sections

This creates an inconsistent experience where braindump users miss out on the feedback-driven improvement loop.

## Goals
- V2 profiles receive recommendations targeting their 12 fields
- V1 profiles continue to work exactly as before
- Recommendations display correct field names in UI for both profile types
- Apply/dismiss/rollback functionality works for both profile types

## Non-Goals
- Profile migration (V1 → V2 or vice versa)
- Changes to braindump synthesis flow
- Changes to interview synthesis flow
- UI redesign of RecommendationPanel
- Changes to Testing Dojo comment system
- Performance optimizations
- New recommendation types beyond ADD/REMOVE/MODIFY

## Technical Approach

### High-Level Strategy
1. Extend type definitions to include V2 field keys
2. Add version detection at recommendation generation start
3. Build version-aware LLM prompts
4. Update validation to accept V2 field IDs
5. Frontend uses version-aware display name lookup

### Key Files to Modify

**Backend:**
- `backend/src/types/recommendation.ts` - Extend `ProfileSectionKey` union type
- `backend/src/services/recommendationEngine.ts` - Version detection, prompt building, validation

**Frontend:**
- `frontend/src/types/recommendation.ts` - Mirror backend type changes
- `frontend/src/components/RecommendationPanel.tsx` - Version-aware display names

### No Changes Required
- Prisma schema (`targetSection` is already a string field)
- API routes (same endpoints work for both)
- RecommendationCard.tsx (receives display name from parent)
- Database queries (already flexible)

## Implementation Details

### 1. Type Definition Updates

**backend/src/types/recommendation.ts:**

```typescript
// V1 sections (existing)
export type ProfileSectionKeyV1 =
  | 'identityRole'
  | 'communicationStyle'
  | 'contentPriorities'
  | 'engagementApproach'
  | 'keyFramings'

// V2 fields (new)
export type ProfileSectionKeyV2 =
  | 'agentIdentity'
  | 'domainExpertise'
  | 'targetAudience'
  | 'toneAndVoice'
  | 'languagePatterns'
  | 'adaptationRules'
  | 'keyTopics'
  | 'avoidanceAreas'
  | 'examplePreferences'
  | 'proactiveGuidance'
  | 'framingStrategies'
  | 'successCriteria'

// Union type for both
export type ProfileSectionKey = ProfileSectionKeyV1 | ProfileSectionKeyV2

// V1 display names (existing)
export const V1_SECTION_DISPLAY_NAMES: Record<ProfileSectionKeyV1, string> = {
  identityRole: 'Identity & Role',
  communicationStyle: 'Communication Style',
  contentPriorities: 'Content Priorities',
  engagementApproach: 'Engagement Approach',
  keyFramings: 'Key Framings',
}

// V2 display names (new)
export const V2_FIELD_DISPLAY_NAMES: Record<ProfileSectionKeyV2, string> = {
  agentIdentity: 'Agent Identity',
  domainExpertise: 'Domain Expertise',
  targetAudience: 'Target Audience',
  toneAndVoice: 'Tone & Voice',
  languagePatterns: 'Language Patterns',
  adaptationRules: 'Adaptation Rules',
  keyTopics: 'Key Topics',
  avoidanceAreas: 'Avoidance Areas',
  examplePreferences: 'Example Preferences',
  proactiveGuidance: 'Proactive Guidance',
  framingStrategies: 'Framing Strategies',
  successCriteria: 'Success Criteria',
}

// Combined lookup (for backward compatibility)
export const SECTION_DISPLAY_NAMES: Record<ProfileSectionKey, string> = {
  ...V1_SECTION_DISPLAY_NAMES,
  ...V2_FIELD_DISPLAY_NAMES,
}
```

### 2. Backend Version Detection

**backend/src/services/recommendationEngine.ts:**

```typescript
// Helper to detect V2 profile
function isV2Profile(profile: unknown): boolean {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    'version' in profile &&
    (profile as { version: unknown }).version === 2 &&
    'fields' in profile
  )
}

// Get valid section IDs based on profile version
function getValidSectionIds(profile: unknown): string[] {
  if (isV2Profile(profile)) {
    return Object.keys(V2_FIELD_DISPLAY_NAMES)
  }
  return Object.keys(V1_SECTION_DISPLAY_NAMES)
}
```

### 3. Version-Aware LLM Prompt

Update `buildProfileAnalysisPrompt()` to:
1. Detect profile version
2. Include appropriate section/field names in prompt
3. Reference correct structure (`.sections` vs `.fields`)

```typescript
function buildProfileAnalysisPrompt(
  profile: AgentProfile | AgentProfileV2,
  formattedComments: string,
  totalComments: number
): string {
  const isV2 = isV2Profile(profile)

  // Build section list for LLM
  const sectionsList = isV2
    ? Object.entries(V2_FIELD_DISPLAY_NAMES)
        .map(([key, name]) => `- ${key}: "${name}"`)
        .join('\n')
    : Object.entries(V1_SECTION_DISPLAY_NAMES)
        .map(([key, name]) => `- ${key}: "${name}"`)
        .join('\n')

  // Build current profile content for LLM
  const profileContent = isV2
    ? Object.entries((profile as AgentProfileV2).fields)
        .map(([key, field]) => `### ${V2_FIELD_DISPLAY_NAMES[key as ProfileSectionKeyV2]}\n${field.content}`)
        .join('\n\n')
    : Object.entries((profile as AgentProfile).sections)
        .map(([key, section]) => `### ${V1_SECTION_DISPLAY_NAMES[key as ProfileSectionKeyV1]}\n${section.content}`)
        .join('\n\n')

  return `...prompt with ${sectionsList} and ${profileContent}...`
}
```

### 4. Validation Update

Update `VALID_SECTION_IDS` to be dynamic:

```typescript
// In generateRecommendations():
const validSectionIds = getValidSectionIds(profile)

// When validating LLM response:
if (!validSectionIds.includes(rec.targetSection)) {
  console.warn(`Invalid section ${rec.targetSection}, skipping`)
  continue
}
```

### 5. Apply Recommendations Update

Update `applyRecommendations()` to handle both structures:

```typescript
// When applying a recommendation:
if (isV2Profile(profile)) {
  const v2Profile = profile as AgentProfileV2
  const field = v2Profile.fields[sectionId]
  // Apply ADD/REMOVE/MODIFY to field.content
} else {
  const v1Profile = profile as AgentProfile
  const section = v1Profile.sections[sectionId]
  // Apply ADD/REMOVE/MODIFY to section.content (existing logic)
}
```

### 6. Frontend Type Mirror

**frontend/src/types/recommendation.ts:**
- Copy the same type changes from backend
- Export `SECTION_DISPLAY_NAMES` with both V1 and V2 mappings

### 7. RecommendationPanel Display Names

**frontend/src/components/RecommendationPanel.tsx:**

```typescript
// Change from:
SECTION_DISPLAY_NAMES[rec.targetSection]

// To (already works if SECTION_DISPLAY_NAMES has both):
SECTION_DISPLAY_NAMES[rec.targetSection as ProfileSectionKey] || rec.targetSection
```

## Testing Approach

### Essential Tests
1. **V2 profile generates recommendations** - Create V2 profile, add test comments, verify recommendations target V2 fields
2. **V1 profile still works** - Existing V1 recommendation flow unchanged
3. **Apply works for V2** - Recommendations apply to V2 profile fields correctly
4. **Display names correct** - V2 field names display properly in RecommendationPanel

### Test Scenarios
- Generate recommendations for V2 profile → targets 12 fields
- Generate recommendations for V1 profile → targets 5 sections
- Apply single V2 recommendation → field content updated
- Apply all V2 recommendations → all targeted fields updated
- Dismiss V2 recommendation → status updated to 'dismissed'
- Version history works for V2 → can rollback V2 profile changes

## Open Questions

1. **Max recommendations per profile** - Should V2 profiles have max 12 (one per field) instead of current max 5? Leaning toward keeping max 5 for LLM quality.

2. **Field grouping in prompts** - Should we group V2's 12 fields by category in the LLM prompt to improve recommendation quality? Deferred to Future Improvements.

## Future Improvements and Enhancements

**OUT OF SCOPE for initial implementation:**

### LLM Prompt Optimization
- Group V2 fields by category (Identity, Communication, Content, Engagement) in prompts
- Test different prompt structures for 12-field quality
- Add field-specific guidance hints to LLM

### UI Enhancements
- Show field category badges in RecommendationPanel for V2
- Visual grouping of V2 recommendations by category
- Field confidence indicators in recommendation cards

### Field Mapping
- Intelligent mapping between V1 sections and V2 fields for users who switch
- Suggestion to migrate V1 profile to V2 format

### Testing Depth
- E2E tests for full V2 recommendation flow
- Load testing with large V2 profiles
- LLM response quality metrics for V2 recommendations

### Shared Constants
- Extract V2 field metadata to shared constants file (currently duplicated in AgentProfile.tsx)
- Single source of truth for field display names

## References

- Task context discovery (this session)
- Code review of V2 profile fix (this session)
- `CLAUDE.md` - Profile Recommendation System section
- `backend/src/types/recommendation.ts` - Current type definitions
- `backend/src/services/recommendationEngine.ts` - Current implementation
- `frontend/src/components/AgentProfile.tsx` - V2 field metadata reference
