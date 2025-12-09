# Recommendation Engine Analysis Summary

## 1. Title
**Feature:** Recommendation Analysis Summary & Transparency

## 2. Status
**Approved** | Created: 2025-12-03 | Validated: 2025-12-03

## 3. Authors
- Claude Code (Spec Author)
- User (Product Owner)

## 4. Overview
Add an `analysisSummary` field to the recommendation engine response that provides transparency into the AI's reasoning process. This explains why recommendations were made, identifies feedback themes, and most importantly explains WHY when no recommendations are generated (which should be rare since user comments almost always warrant profile updates).

## 5. Background/Problem Statement

### The Problem
When users click "Get Recommendations" after leaving comments during testing, they sometimes receive "No recommendations available. Add more comments during testing." This message is:
1. **Unhelpful** - Doesn't explain why no recommendations were generated
2. **Confusing** - User left comments, so why no recommendations?
3. **Trust-eroding** - Users can't understand if the system is working correctly

### Root Cause Analysis
The current implementation in `recommendationEngine.ts`:
- Returns an empty `recommendations` array when LLM decides no changes are needed
- Provides NO explanation for the decision
- The current prompt doesn't require LLM to justify empty results

### User Expectation
User comments during testing **almost always** warrant some profile adjustment. Empty results should be rare and well-justified. Users need visibility into:
1. What themes the AI identified in their feedback
2. How well their current config aligns with the feedback
3. Why no changes are needed (when that's the case)

## 6. Goals
- Provide transparency into recommendation engine reasoning
- Explain when/why no recommendations are generated
- Display an always-visible analysis summary in the UI
- Maintain backward compatibility with existing API consumers
- Keep implementation simple (no over-engineering)

## 7. Non-Goals
- Learning from acceptance/rejection patterns (future ML enhancement)
- Suggested actions when no recommendations (user confirmed not needed)
- Progressive disclosure with collapsible full analysis (keep it simple)
- Real-time recommendation updates
- Cross-project recommendation patterns
- Major UI redesign

## 8. Technical Dependencies

### External Libraries
- **OpenAI GPT-4-turbo** (existing) - LLM for analysis
  - Already uses `response_format: { type: 'json_object' }`
  - Version: Latest via `openai` npm package

### Internal Dependencies
- `backend/src/services/recommendationEngine.ts` - Core engine
- `backend/src/controllers/recommendation.controller.ts` - API endpoint
- `frontend/src/types/recommendation.ts` - TypeScript types
- `frontend/src/components/RecommendationPanel.tsx` - UI component

## 9. Detailed Design

### 9.1 Type Changes

#### Backend Types (`recommendationEngine.ts`)
```typescript
// New interface for analysis summary
interface AnalysisSummary {
  overview: string                    // 2-3 sentence summary of analysis
  feedbackThemes: string[]            // Main themes identified (e.g., ["tone formality", "response detail"])
  configAlignment: 'good' | 'needs_update' | 'partial'  // How well current config matches feedback
  noChangeReason?: string             // Required when recommendations array is empty
}

// Updated return type
interface RecommendationResult {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  analysisSummary: AnalysisSummary    // NEW - always present
}
```

#### Frontend Types (`recommendation.ts`)
```typescript
export interface AnalysisSummary {
  overview: string
  feedbackThemes: string[]
  configAlignment: 'good' | 'needs_update' | 'partial'
  noChangeReason?: string
}

export interface RecommendationResponse {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
  analysisSummary: AnalysisSummary    // NEW
}
```

### 9.2 LLM Prompt Enhancement

Update `ANALYSIS_PROMPT` in `recommendationEngine.ts`:

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

### 9.3 Controller Pass-Through

The controller (`recommendation.controller.ts`) requires no logic changes - it simply passes through the `analysisSummary` field from the engine response:

```typescript
// recommendation.controller.ts - getRecommendations()
// No changes needed - just passes through the full response
res.json({
  ...result,  // includes analysisSummary automatically
  generatedAt: new Date().toISOString(),
})
```

### 9.4 Response Parsing Update

Update parsing logic in `generateRecommendations()`:

```typescript
// Parse response
let parsed: {
  analysisSummary?: AnalysisSummary
  recommendations?: unknown[]
} | unknown[]

try {
  parsed = JSON.parse(content)
} catch {
  throw new Error('Failed to parse recommendations response')
}

// Extract analysisSummary with fallback
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

// Validate: if no recommendations, require noChangeReason
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

### 9.5 UI Changes

#### RecommendationPanel.tsx - State Update

Update the component state to include `analysisSummary`:

```typescript
// Current state
const [stats, setStats] = useState({ totalComments: 0, sessionsAnalyzed: 0 })

// Updated state type
const [stats, setStats] = useState<{
  totalComments: number
  sessionsAnalyzed: number
  analysisSummary?: AnalysisSummary  // NEW
}>({ totalComments: 0, sessionsAnalyzed: 0 })

// In loadRecommendations(), update setter:
setStats({
  totalComments: response.totalComments,
  sessionsAnalyzed: response.sessionsAnalyzed,
  analysisSummary: response.analysisSummary,  // NEW
})
```

#### RecommendationPanel.tsx - Analysis Summary Section

Add analysis summary display at top of panel (always visible):

```tsx
{/* Analysis Summary - Always visible at top */}
{stats.analysisSummary && (
  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
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
)}
```

#### Empty State Enhancement

Replace current empty state with reasoning-aware version:

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
  // ... existing recommendation cards
)}
```

### 9.6 Data Flow

```
User clicks "Get Recommendations"
    |
    v
RecommendationPanel → api.getRecommendations(projectId)
    |
    v
Backend: recommendationEngine.generateRecommendations()
    |
    v
GPT-4-turbo with enhanced ANALYSIS_PROMPT
    |
    v
Parse response → Extract analysisSummary + recommendations[]
    |
    v
Validate: Ensure noChangeReason if recommendations empty
    |
    v
Return {recommendations, totalComments, sessionsAnalyzed, analysisSummary}
    |
    v
Frontend displays:
  - Analysis summary (always visible, blue box)
  - Feedback theme tags
  - Recommendation cards OR "Good news - no changes needed!" OR explanation
```

## 10. User Experience

### Normal Flow (Recommendations Generated)
1. User clicks "Get Recommendations"
2. Loading state: "Analyzing your testing feedback..."
3. Panel shows:
   - Blue summary box: "Analyzed 5 comments across 2 sessions. Main themes identified: tone formality, response detail. Your current config partially addresses these areas."
   - Theme tags: `tone formality` `response detail`
   - Recommendation cards below

### Empty Flow (No Recommendations - Config is Good)
1. User clicks "Get Recommendations"
2. Loading state
3. Panel shows:
   - Blue summary box with analysis
   - Green success box: "Good news - no changes needed! Your current configuration already addresses the feedback themes."

### Empty Flow (No Recommendations - Other Reason)
1. User clicks "Get Recommendations"
2. Loading state
3. Panel shows:
   - Blue summary box with analysis
   - Gray explanation box: "No specific recommendations. [Reason: e.g., 'Feedback relates to document content rather than AI agent behavior.']"

## 11. Testing Strategy

### Unit Tests (`recommendationEngine.test.ts`)

```typescript
// New test: Should return analysisSummary with recommendations
it('should return analysisSummary when recommendations generated', async () => {
  const mockResponse = {
    analysisSummary: {
      overview: 'Analyzed 2 comments. Main theme: tone formality.',
      feedbackThemes: ['tone formality'],
      configAlignment: 'needs_update',
      noChangeReason: null,
    },
    recommendations: [{ /* ... */ }],
  }

  mockOpenAIInstance.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(mockResponse) } }],
  })

  const result = await generateRecommendations('project-1')

  expect(result.analysisSummary).toBeDefined()
  expect(result.analysisSummary.overview).toContain('Analyzed')
  expect(result.analysisSummary.feedbackThemes).toContain('tone formality')
  expect(result.analysisSummary.configAlignment).toBe('needs_update')
})

// New test: Should require noChangeReason when no recommendations
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
  })

  const result = await generateRecommendations('project-1')

  expect(result.recommendations).toHaveLength(0)
  expect(result.analysisSummary.noChangeReason).toBeDefined()
  expect(result.analysisSummary.configAlignment).toBe('good')
})

// New test: Should provide fallback noChangeReason if LLM omits it
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
  })

  const result = await generateRecommendations('project-1')

  expect(result.recommendations).toHaveLength(0)
  expect(result.analysisSummary.noChangeReason).toBeDefined()
  expect(result.analysisSummary.noChangeReason).toContain('Unable to generate')
})

// New test: Should handle legacy array response format
it('should handle legacy array response with fallback summary', async () => {
  // Old format: just array of recommendations
  const mockResponse = [{ questionId: 'tone', /* ... */ }]

  mockOpenAIInstance.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(mockResponse) } }],
  })

  const result = await generateRecommendations('project-1')

  expect(result.analysisSummary).toBeDefined()
  expect(result.analysisSummary.overview).toBe('Analysis complete.')
})
```

### Controller Tests (`recommendation.controller.test.ts`)

```typescript
// Update existing test to include analysisSummary
it('should return recommendations with analysisSummary on success', async () => {
  const mockAnalysisSummary = {
    overview: 'Analyzed feedback.',
    feedbackThemes: ['tone'],
    configAlignment: 'needs_update',
  }

  ;(generateRecommendations as jest.Mock).mockResolvedValue({
    recommendations: mockRecommendations,
    totalComments: 5,
    sessionsAnalyzed: 2,
    analysisSummary: mockAnalysisSummary,
  })

  await getRecommendations(mockReq, mockRes)

  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      recommendations: mockRecommendations,
      analysisSummary: mockAnalysisSummary,
    })
  )
})
```

### Integration Test (Recommended)

Add a single integration test with mocked LLM response to verify the full flow without flakiness:

```typescript
// backend/src/services/__tests__/recommendationEngine.integration.test.ts
// Purpose: Verify analysisSummary flows correctly from engine → controller → response

it('should include analysisSummary in full API response', async () => {
  // Mock LLM to return predictable response with analysisSummary
  const mockResponse = {
    analysisSummary: {
      overview: 'Test overview.',
      feedbackThemes: ['test theme'],
      configAlignment: 'needs_update',
    },
    recommendations: [{ questionId: 'tone', suggestedAnswer: 'Test', rationale: 'Test', confidence: 'high' }],
  }

  // ... mock setup ...

  // Call controller endpoint
  const response = await request(app)
    .get(`/api/recommendations/${projectId}`)
    .set('Authorization', `Bearer ${token}`)

  // Verify analysisSummary is present in response
  expect(response.body.analysisSummary).toBeDefined()
  expect(response.body.analysisSummary.overview).toBe('Test overview.')
})
```

### E2E Tests (`.quick-checks/test-recommendations.spec.ts`)

```typescript
test('should display analysis summary when recommendations generated', async ({ page }) => {
  // Setup: Navigate to test project with comments

  const getRecsBtn = page.getByRole('button', { name: /get recommendations/i })
  await getRecsBtn.click()
  await page.waitForTimeout(30000)

  // Analysis summary should be visible
  const summaryBox = page.locator('.bg-blue-50')
  await expect(summaryBox).toBeVisible()

  // Should contain analysis text
  const summaryText = await summaryBox.textContent()
  expect(summaryText).toContain('Analyzed')
})

test.skip('should show "Good news" message when config is good', async ({ page }) => {
  // Skipped: LLM-dependent behavior - use integration test with mocked response instead
})

test.skip('should show explanation when no recommendations', async ({ page }) => {
  // Skipped: LLM-dependent behavior - use integration test with mocked response instead
})
```

## 12. Performance Considerations

### Token Usage
- **Current**: ~2000 max_tokens response
- **Proposed**: ~2500 max_tokens (adds analysisSummary object)
- **Cost Impact**: +$0.01-0.02 per request at GPT-4-turbo rates
- **Mitigation**: None needed - marginal cost increase for significant UX improvement

### Response Time
- No significant change expected
- `analysisSummary` is generated alongside recommendations, not sequentially

### Caching
- No changes to caching strategy
- Response is not cached (fresh analysis each time)

## 13. Security Considerations

### Input Validation
- `configAlignment` is validated against enum values
- `feedbackThemes` array is sanitized (no user-generated HTML)
- `noChangeReason` is plain text, escaped in UI

### XSS Prevention
- All text from `analysisSummary` displayed via React (auto-escaped)
- No `dangerouslySetInnerHTML` usage

## 14. Documentation

### Code Documentation
- Add JSDoc comments to new interfaces
- Update inline comments in `generateRecommendations()`

### User-Facing
- No new documentation needed
- Feature is self-explanatory in UI

### Developer Guide
- Update any internal API docs to include `analysisSummary` field

## 15. Implementation Phases

### Phase 1: Backend Enhancement
1. Add `AnalysisSummary` interface to `recommendationEngine.ts`
2. Update `ANALYSIS_PROMPT` with new JSON structure
3. Update response parsing to extract `analysisSummary`
4. Add fallback for missing `noChangeReason`
5. Update return type to include `analysisSummary`
6. Add unit tests for new functionality

### Phase 2: Frontend Display
1. Add `AnalysisSummary` interface to `recommendation.ts`
2. Update `RecommendationPanel` state to include `analysisSummary`
3. Add analysis summary section (blue box at top)
4. Add feedback theme tags
5. Update empty state with reasoning-aware logic
6. Style the new UI elements

### Phase 3: Testing & Polish
1. Run existing E2E tests to verify no regressions
2. Add new E2E tests for summary display
3. Manual testing with various comment scenarios
4. Verify backward compatibility (old responses still work)

## 16. Open Questions

1. **Theme limit**: Should we cap `feedbackThemes` to 5 items in the prompt? (Currently specified as max 5)
   - **Decision**: Yes, keep max 5 to prevent UI overflow

2. **Fallback behavior**: If LLM returns invalid `configAlignment`, default to `'partial'`?
   - **Decision**: Yes, `'partial'` is safest fallback

## 17. References

### Related Files
- `docs/ideation/recommendation-system-reasoning.md` - Ideation document
- `backend/src/services/recommendationEngine.ts:51-86` - Current ANALYSIS_PROMPT
- `frontend/src/components/RecommendationPanel.tsx:120-127` - Current empty state

### Design Patterns
- Progressive Disclosure (research showed this is industry standard for AI transparency)
- Graceful Degradation (fallback values for missing LLM response fields)

### User Decisions (from ideation clarification)
1. Summary always visible by default (no collapse needed)
2. No suggested actions in empty state - analysis summary explains enough
3. Simple "Good news - no changes needed!" message, not over-engineered
