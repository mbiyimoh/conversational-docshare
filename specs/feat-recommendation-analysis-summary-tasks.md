# Task Breakdown: Recommendation Analysis Summary

Generated: 2025-12-03
Source: specs/feat-recommendation-analysis-summary.md

## Overview

Add transparency into the recommendation engine by including an `analysisSummary` field that explains the AI's reasoning. This addresses the user issue where "No recommendations available" appeared without explanation.

## Execution Strategy

**Parallel Opportunities:**
- Tasks 1.1 and 2.1 can run in parallel (backend types + frontend types)
- Task 1.4 (unit tests) can run after 1.1-1.3 complete

**Critical Path:** 1.1 → 1.2 → 1.3 → 2.2 → 2.3 → 3.1

---

## Phase 1: Backend Enhancement

### Task 1.1: Add AnalysisSummary Interface and Update Return Type
**Description**: Add the AnalysisSummary TypeScript interface and update the return type of generateRecommendations()
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.1

**File**: `backend/src/services/recommendationEngine.ts`

**Implementation**:

Add after the existing interfaces (around line 40):

```typescript
// New interface for analysis summary
interface AnalysisSummary {
  overview: string                    // 2-3 sentence summary of analysis
  feedbackThemes: string[]            // Main themes identified (e.g., ["tone formality", "response detail"])
  configAlignment: 'good' | 'needs_update' | 'partial'  // How well current config matches feedback
  noChangeReason?: string             // Required when recommendations array is empty
}
```

Update the return type of `generateRecommendations` function signature:

```typescript
export async function generateRecommendations(projectId: string): Promise<{
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  analysisSummary: AnalysisSummary    // NEW - always present
}>
```

**Acceptance Criteria**:
- [ ] `AnalysisSummary` interface defined with all 4 fields
- [ ] `noChangeReason` is optional (only required when recommendations empty)
- [ ] Function return type includes `analysisSummary`
- [ ] TypeScript compiles without errors

---

### Task 1.2: Update ANALYSIS_PROMPT for New JSON Structure
**Description**: Enhance the LLM prompt to require analysisSummary in the response
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**File**: `backend/src/services/recommendationEngine.ts`

**Implementation**:

Replace the existing `ANALYSIS_PROMPT` (lines 51-86) with:

```typescript
const ANALYSIS_PROMPT = `You are an expert at analyzing user feedback on AI agent behavior and suggesting configuration improvements.

## Current Interview Configuration
{interviewConfig}

## Testing Feedback Comments
The user left these comments while testing their AI agent:

{comments}

## Task
Analyze the feedback and provide:
1. An analysis summary explaining your reasoning
2. Specific recommendations for interview answer updates

IMPORTANT: User comments almost always warrant some profile adjustment. "No recommendations" should be rare and well-justified. If you determine no changes are needed, you MUST explain why clearly.

Valid reasons for no recommendations:
- Current config already addresses the feedback themes
- Feedback is contradictory and needs user clarification
- Feedback relates to document content, not AI agent behavior

Return a JSON object with this EXACT structure:
{
  "analysisSummary": {
    "overview": "After analyzing X comments across Y sessions, I identified... [2-3 sentences]",
    "feedbackThemes": ["theme1", "theme2"],
    "configAlignment": "good" | "needs_update" | "partial",
    "noChangeReason": null  // or explanation string if recommendations is empty
  },
  "recommendations": [
    {
      "questionId": "tone",
      "suggestedAnswer": "...",
      "rationale": "...",
      "relatedCommentIds": ["id1", "id2"],
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Rules for recommendations:
- Only suggest changes if there's clear feedback supporting it
- Don't suggest changes for questions with no related feedback
- Be specific in suggested answers, incorporating feedback themes
- Keep suggested answers concise (1-3 sentences max)
- Group similar feedback into single recommendations

Rules for analysisSummary:
- overview: Always 2-3 sentences explaining what you found
- feedbackThemes: List the main themes you identified (max 5)
- configAlignment: "good" if current config addresses feedback, "needs_update" if changes needed, "partial" if mixed
- noChangeReason: REQUIRED if recommendations is empty, otherwise null`
```

**Acceptance Criteria**:
- [ ] Prompt requests `analysisSummary` object in response
- [ ] JSON structure example is clear and complete
- [ ] Rules for `analysisSummary` fields are specified
- [ ] Emphasis on explaining empty results

---

### Task 1.3: Update Response Parsing with Fallbacks
**Description**: Parse analysisSummary from LLM response with graceful fallbacks for legacy/malformed responses
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**File**: `backend/src/services/recommendationEngine.ts`

**Implementation**:

In the `generateRecommendations` function, replace the existing parsing logic (after line 186) with:

```typescript
// 5. Parse and validate response
let parsed: {
  analysisSummary?: AnalysisSummary
  recommendations?: unknown[]
} | unknown[]

try {
  parsed = JSON.parse(content)
} catch {
  throw new Error('Failed to parse recommendations response')
}

// Extract analysisSummary with fallback for legacy array format
const analysisSummary: AnalysisSummary = Array.isArray(parsed)
  ? {
      overview: 'Analysis complete.',
      feedbackThemes: [],
      configAlignment: 'partial',
    }
  : {
      overview: parsed.analysisSummary?.overview || 'Analysis complete.',
      feedbackThemes: parsed.analysisSummary?.feedbackThemes || [],
      configAlignment: parsed.analysisSummary?.configAlignment || 'partial',
      noChangeReason: parsed.analysisSummary?.noChangeReason,
    }

// Handle both array and object responses for recommendations
const rawRecs = Array.isArray(parsed)
  ? parsed
  : (parsed as { recommendations?: unknown[] }).recommendations || []

// 6. Build and validate recommendation objects
const recommendations: Recommendation[] = rawRecs
  .map((rec: unknown, index: number) => {
    // ... existing mapping logic ...
  })
  .filter((r): r is Recommendation => r !== null)

// Validate: if no recommendations, ensure noChangeReason exists
if (recommendations.length === 0 && !analysisSummary.noChangeReason) {
  analysisSummary.noChangeReason = 'Unable to generate specific recommendations from the provided feedback.'
}

return {
  recommendations,
  totalComments: comments.length,
  sessionsAnalyzed: sessionIds.size,
  analysisSummary,
}
```

**Acceptance Criteria**:
- [ ] Parses `analysisSummary` from new JSON structure
- [ ] Falls back gracefully for legacy array-only responses
- [ ] Provides default values for missing fields
- [ ] Auto-generates `noChangeReason` if recommendations empty but reason missing
- [ ] `configAlignment` defaults to `'partial'` if invalid

---

### Task 1.4: Add Unit Tests for AnalysisSummary
**Description**: Add comprehensive unit tests for the new analysisSummary functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.3
**Can run parallel with**: Task 2.2, Task 2.3

**File**: `backend/src/services/__tests__/recommendationEngine.test.ts`

**Implementation**:

Add these tests after the existing tests:

```typescript
// Test: Should return analysisSummary with recommendations
it('should return analysisSummary when recommendations generated', async () => {
  const mockResponse = {
    analysisSummary: {
      overview: 'Analyzed 2 comments. Main theme: tone formality.',
      feedbackThemes: ['tone formality'],
      configAlignment: 'needs_update',
      noChangeReason: null,
    },
    recommendations: [{
      questionId: 'tone',
      suggestedAnswer: 'Professional but approachable',
      rationale: 'Feedback indicated formal tone',
      relatedCommentIds: ['comment-1'],
      confidence: 'high',
    }],
  }

  mockOpenAIInstance.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(mockResponse) } }],
  } as never)

  ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
  ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
    interviewData: mockInterviewData,
  } as never)

  const result = await generateRecommendations('project-1')

  expect(result.analysisSummary).toBeDefined()
  expect(result.analysisSummary.overview).toContain('Analyzed')
  expect(result.analysisSummary.feedbackThemes).toContain('tone formality')
  expect(result.analysisSummary.configAlignment).toBe('needs_update')
})

// Test: Should have noChangeReason when no recommendations
it('should have noChangeReason when recommendations is empty', async () => {
  const mockResponse = {
    analysisSummary: {
      overview: 'Current config is well-aligned.',
      feedbackThemes: ['tone'],
      configAlignment: 'good',
      noChangeReason: 'Current config already addresses feedback.',
    },
    recommendations: [],
  }

  mockOpenAIInstance.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(mockResponse) } }],
  } as never)

  ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
  ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
    interviewData: mockInterviewData,
  } as never)

  const result = await generateRecommendations('project-1')

  expect(result.recommendations).toHaveLength(0)
  expect(result.analysisSummary.noChangeReason).toBeDefined()
  expect(result.analysisSummary.configAlignment).toBe('good')
})

// Test: Should provide fallback noChangeReason if LLM omits it
it('should provide fallback noChangeReason if LLM omits it', async () => {
  const mockResponse = {
    analysisSummary: {
      overview: 'Analysis complete.',
      feedbackThemes: [],
      configAlignment: 'partial',
      // noChangeReason intentionally omitted
    },
    recommendations: [],
  }

  mockOpenAIInstance.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(mockResponse) } }],
  } as never)

  ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
  ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
    interviewData: mockInterviewData,
  } as never)

  const result = await generateRecommendations('project-1')

  expect(result.recommendations).toHaveLength(0)
  expect(result.analysisSummary.noChangeReason).toBeDefined()
  expect(result.analysisSummary.noChangeReason).toContain('Unable to generate')
})

// Test: Should handle legacy array response format
it('should handle legacy array response with fallback summary', async () => {
  // Old format: just array of recommendations
  const mockResponse = [{
    questionId: 'tone',
    suggestedAnswer: 'More approachable',
    rationale: 'Based on feedback',
    confidence: 'medium',
  }]

  mockOpenAIInstance.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(mockResponse) } }],
  } as never)

  ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
  ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
    interviewData: mockInterviewData,
  } as never)

  const result = await generateRecommendations('project-1')

  expect(result.analysisSummary).toBeDefined()
  expect(result.analysisSummary.overview).toBe('Analysis complete.')
  expect(result.analysisSummary.configAlignment).toBe('partial')
})
```

**Acceptance Criteria**:
- [ ] Test for normal flow with analysisSummary
- [ ] Test for empty recommendations with noChangeReason
- [ ] Test for fallback when LLM omits noChangeReason
- [ ] Test for legacy array response format
- [ ] All tests pass

---

## Phase 2: Frontend Display

### Task 2.1: Add AnalysisSummary Type to Frontend
**Description**: Add the AnalysisSummary interface to frontend types
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**File**: `frontend/src/types/recommendation.ts`

**Implementation**:

Add at the top of the file, before `Recommendation` interface:

```typescript
export interface AnalysisSummary {
  overview: string
  feedbackThemes: string[]
  configAlignment: 'good' | 'needs_update' | 'partial'
  noChangeReason?: string
}
```

Update `RecommendationResponse` interface:

```typescript
export interface RecommendationResponse {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
  analysisSummary: AnalysisSummary    // NEW
}
```

**Acceptance Criteria**:
- [ ] `AnalysisSummary` interface exported
- [ ] `RecommendationResponse` includes `analysisSummary` field
- [ ] TypeScript compiles without errors

---

### Task 2.2: Update RecommendationPanel State and Data Loading
**Description**: Update component state to include analysisSummary and load it from API response
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1, Task 1.3
**Can run parallel with**: None

**File**: `frontend/src/components/RecommendationPanel.tsx`

**Implementation**:

1. Add import for AnalysisSummary:
```typescript
import type { Recommendation, AnalysisSummary } from '../types/recommendation'
```

2. Update state definition (around line 19):
```typescript
const [stats, setStats] = useState<{
  totalComments: number
  sessionsAnalyzed: number
  analysisSummary?: AnalysisSummary
}>({ totalComments: 0, sessionsAnalyzed: 0 })
```

3. Update loadRecommendations setter (around line 32-35):
```typescript
setStats({
  totalComments: response.totalComments,
  sessionsAnalyzed: response.sessionsAnalyzed,
  analysisSummary: response.analysisSummary,
})
```

**Acceptance Criteria**:
- [ ] State type includes `analysisSummary`
- [ ] `analysisSummary` loaded from API response
- [ ] No TypeScript errors

---

### Task 2.3: Add Analysis Summary UI Section
**Description**: Add the always-visible analysis summary section at the top of the panel
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: None

**File**: `frontend/src/components/RecommendationPanel.tsx`

**Implementation**:

Add after the error section (around line 117), before the Content section:

```tsx
{/* Analysis Summary - Always visible at top */}
{!loading && stats.analysisSummary && (
  <div className="px-6 py-4">
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
      <div className="text-sm text-blue-900">
        {stats.analysisSummary.overview}
      </div>
      {stats.analysisSummary.feedbackThemes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {stats.analysisSummary.feedbackThemes.map((theme) => (
            <span
              key={theme}
              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
            >
              {theme}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Summary box appears at top of panel (after header)
- [ ] Overview text displays in blue box
- [ ] Theme tags display as pills/badges
- [ ] Only shows when not loading and analysisSummary exists

---

### Task 2.4: Update Empty State with Reasoning
**Description**: Replace generic empty state with reasoning-aware messages
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.3
**Can run parallel with**: None

**File**: `frontend/src/components/RecommendationPanel.tsx`

**Implementation**:

Replace the existing empty state (around lines 120-127):

```tsx
{pendingRecs.length === 0 ? (
  <div className="text-center py-8">
    {recommendations.length === 0 && stats.analysisSummary?.configAlignment === 'good' ? (
      // Good news - current config is sufficient
      <div className="bg-green-50 rounded-lg p-6 border border-green-100">
        <div className="text-green-800 font-medium mb-2">
          Good news - no changes needed!
        </div>
        <div className="text-sm text-green-700">
          {stats.analysisSummary.noChangeReason ||
            'Your current configuration already addresses the feedback themes.'}
        </div>
      </div>
    ) : recommendations.length === 0 ? (
      // Explanation for why no recommendations
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="text-gray-700 font-medium mb-2">
          No specific recommendations
        </div>
        <div className="text-sm text-gray-600">
          {stats.analysisSummary?.noChangeReason ||
            'Unable to generate specific recommendations from the provided feedback.'}
        </div>
      </div>
    ) : (
      // All processed
      <p className="text-gray-500">
        All recommendations have been processed.
      </p>
    )}
  </div>
) : (
  // ... existing recommendation cards (keep this unchanged)
  <div className="space-y-4">
    {pendingRecs.map((rec) => (
      // ... existing card JSX
    ))}
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Green "Good news" box when configAlignment is 'good'
- [ ] Gray explanation box for other empty cases
- [ ] Shows noChangeReason text when available
- [ ] Falls back to generic message when reason missing
- [ ] "All processed" message when recommendations exist but all handled

---

## Phase 3: Testing & Verification

### Task 3.1: Run Existing Tests and Verify No Regressions
**Description**: Run all existing unit and E2E tests to ensure backward compatibility
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.4, Task 2.4
**Can run parallel with**: None

**Commands**:
```bash
# Run backend unit tests
cd backend && npm test

# Run E2E tests
cd backend && npx playwright test --config=.quick-checks/playwright.config.ts
```

**Acceptance Criteria**:
- [ ] All existing unit tests pass
- [ ] All existing E2E tests pass
- [ ] No TypeScript compilation errors
- [ ] Backend starts without errors
- [ ] Frontend builds without errors

---

### Task 3.2: Manual Testing Scenarios
**Description**: Manually test all user flows to verify the feature works correctly
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: None

**Test Scenarios**:

1. **Normal flow with recommendations**:
   - Create test session, add comment like "tone is too formal"
   - Click "Get Recommendations"
   - Verify: Blue summary box appears with overview text
   - Verify: Theme tags display
   - Verify: Recommendation cards appear below

2. **Empty flow - config is good** (may need to engineer scenario):
   - Leave comment that aligns with current config
   - Click "Get Recommendations"
   - Verify: Blue summary appears
   - Verify: Green "Good news" box appears

3. **Legacy response handling**:
   - No direct test needed - covered by unit tests

**Acceptance Criteria**:
- [ ] Summary box appears in all cases
- [ ] Theme tags render correctly
- [ ] Empty states show appropriate messaging
- [ ] No console errors

---

## Summary

| Phase | Tasks | Can Parallelize |
|-------|-------|-----------------|
| Phase 1: Backend | 4 tasks | 1.1 can run with 2.1 |
| Phase 2: Frontend | 4 tasks | After 1.1-1.3 |
| Phase 3: Testing | 2 tasks | Sequential |

**Total Tasks**: 10
**Critical Path**: 1.1 → 1.2 → 1.3 → 2.2 → 2.3 → 2.4 → 3.1
**Parallel Opportunity**: Tasks 1.1 and 2.1 (types) can run simultaneously
