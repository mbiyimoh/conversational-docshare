# Recommendation Engine - Task Breakdown

## Overview

Decomposition of `specs/feat-recommendation-engine.md` into actionable implementation tasks.

**Feature**: AI-powered recommendation engine that analyzes testing comments and suggests interview answer updates.

## Dependency Graph

```
[R1.1] TypeScript Types
    ↓
[R1.2] Recommendation Engine Service
    ↓
[R1.3] Recommendation Controller
    ↓
[R1.4] Routes Registration ─────────────────────┐
    ↓                                           │
[R1.5] Backend Tests                            │
                                                ↓
                              [R2.1] Frontend API Methods
                                    ↓
                              [R2.2] RecommendationPanel Component
                                    ↓
                              [R2.3] TestingDojo Integration
                                    ↓
                              [R3.1] Session Storage for Pre-fill
                                    ↓
                              [R3.2] AgentInterview Integration
                                    ↓
                              [R3.3] E2E Tests
```

## Phase 1: Backend Engine

### Task R1.1: Create TypeScript Types for Recommendations
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: None

Create shared TypeScript type definitions for recommendation feature.

**Files to create**:
- `frontend/src/types/recommendation.ts`

**Implementation**:
```typescript
export interface Recommendation {
  id: string
  questionId: 'audience' | 'purpose' | 'tone' | 'emphasis' | 'questions'
  questionLabel: string
  currentAnswer: string
  suggestedAnswer: string
  rationale: string
  relatedComments: RelatedComment[]
  confidence: 'high' | 'medium' | 'low'
  status: 'pending' | 'applied' | 'dismissed'
}

export interface RelatedComment {
  id: string
  content: string
  messagePreview: string
}

export interface RecommendationResponse {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
}

export interface ApplyRecommendationResponse {
  prefilledData: Record<string, string>
  changedField: string
  previousValue: string
  newValue: string
}
```

**Also add to** `backend/src/utils/errors.ts`:
```typescript
export class RateLimitError extends Error {
  statusCode = 429
  constructor(message: string = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitError'
  }
}
```

**Validation**:
- [ ] Types file created at frontend/src/types/recommendation.ts
- [ ] All 4 interfaces exported
- [ ] RateLimitError added to errors.ts
- [ ] Types compile without errors

---

### Task R1.2: Implement Recommendation Engine Service
**Priority**: P0 (blocking)
**Estimated Complexity**: High
**Dependencies**: R1.1

Create the core recommendation engine service with LLM-powered analysis.

**Files to create**:
- `backend/src/services/recommendationEngine.ts`

**Key features**:
- `generateRecommendations(projectId)` function
- Fetches comments across all testing sessions (max 50 most recent)
- Builds analysis prompt with interview config and comments
- Calls GPT-4-turbo with 30-second timeout (AbortController)
- Parses and validates LLM response
- Returns structured recommendations with confidence levels

**Constants**:
```typescript
const MAX_COMMENTS = 50
const LLM_TIMEOUT_MS = 30000
const VALID_QUESTION_IDS = ['audience', 'purpose', 'tone', 'emphasis', 'questions']
```

**Validation requirements**:
- Skip recommendations with invalid questionId
- Skip recommendations with empty suggestedAnswer
- Default confidence to 'medium' if not valid
- Graceful timeout handling

See full implementation in specs/feat-recommendation-engine.md

**Validation**:
- [ ] File created at backend/src/services/recommendationEngine.ts
- [ ] generateRecommendations function exported
- [ ] Comments limited to MAX_COMMENTS (50)
- [ ] 30-second timeout implemented with AbortController
- [ ] Invalid questionIds filtered out
- [ ] Empty projects return empty array

---

### Task R1.3: Create Recommendation Controller
**Priority**: P0 (blocking)
**Estimated Complexity**: Medium
**Dependencies**: R1.2

Create controller with endpoints for generating and applying recommendations.

**Files to create**:
- `backend/src/controllers/recommendation.controller.ts`

**Endpoints**:
1. `getRecommendations` - POST /projects/:projectId/recommendations
   - Verify project ownership
   - Check rate limit (10/hour/project)
   - Call generateRecommendations service
   - Return recommendations with generatedAt

2. `applyRecommendation` - POST /projects/:projectId/recommendations/apply
   - Verify project ownership
   - Accept questionId and suggestedAnswer in body
   - Return pre-filled interview data

**Rate limiting**:
```typescript
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10  // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000  // 1 hour
```

**Validation**:
- [ ] Both endpoints created
- [ ] 401 returned if not authenticated
- [ ] 403 returned if not project owner
- [ ] 429 returned when rate limited
- [ ] Rate limit tracks per project
- [ ] Apply returns pre-filled data correctly

---

### Task R1.4: Register Recommendation Routes
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: R1.3

Create route definitions and register in Express app.

**Files to create**:
- `backend/src/routes/recommendation.routes.ts`

**Files to modify**:
- `backend/src/index.ts`

**Implementation**:
```typescript
// recommendation.routes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getRecommendations, applyRecommendation } from '../controllers/recommendation.controller'

const router = Router()

router.post('/projects/:projectId/recommendations', authenticate, getRecommendations)
router.post('/projects/:projectId/recommendations/apply', authenticate, applyRecommendation)

export default router
```

Register in index.ts:
```typescript
import recommendationRoutes from './routes/recommendation.routes'
app.use('/api', recommendationRoutes)
```

**Validation**:
- [ ] Routes file created
- [ ] Both routes defined with authenticate middleware
- [ ] Routes registered in Express app
- [ ] Both endpoints accessible

---

### Task R1.5: Backend Unit and Integration Tests
**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: R1.4

Write tests for recommendation engine and controller.

**Files to create**:
- `backend/src/__tests__/recommendationEngine.test.ts`
- `backend/src/__tests__/recommendation.controller.test.ts`

**Test coverage**:

Engine tests:
- Comment aggregation across sessions
- Empty project returns empty recommendations
- LLM response parsing
- Invalid questionId filtering
- Timeout handling

Controller tests:
- Authorization checks
- Rate limiting behavior
- Apply returns correct pre-filled data

**Validation**:
- [ ] Engine tests pass
- [ ] Controller tests pass
- [ ] Rate limiting tested
- [ ] Authorization tested

---

## Phase 2: Frontend Panel

### Task R2.1: Add Recommendation API Methods
**Priority**: P0 (blocking)
**Estimated Complexity**: Low
**Dependencies**: R1.4

Add API client methods for recommendation endpoints.

**Files to modify**:
- `frontend/src/lib/api.ts`

**Implementation**:
```typescript
// Recommendation endpoints
async getRecommendations(projectId: string) {
  return this.request<RecommendationResponse>(
    `/api/projects/${projectId}/recommendations`,
    { method: 'POST' }
  )
}

async applyRecommendation(projectId: string, questionId: string, suggestedAnswer: string) {
  return this.request<ApplyRecommendationResponse>(
    `/api/projects/${projectId}/recommendations/apply`,
    {
      method: 'POST',
      body: JSON.stringify({ questionId, suggestedAnswer }),
    }
  )
}
```

Add import:
```typescript
import type { RecommendationResponse, ApplyRecommendationResponse } from '../types/recommendation'
```

**Validation**:
- [ ] Both methods added to ApiClient
- [ ] Types imported correctly
- [ ] Methods compile without errors

---

### Task R2.2: Create RecommendationPanel Component
**Priority**: P0 (blocking)
**Estimated Complexity**: High
**Dependencies**: R2.1

Create the main recommendation panel UI component.

**Files to create**:
- `frontend/src/components/RecommendationPanel.tsx`

**Key features**:
- Loading state with spinner ("Analyzing your testing feedback...")
- Header with stats (total comments, sessions analyzed)
- Regenerate button
- Recommendation cards with:
  - Question label and confidence badge
  - Diff view (current vs suggested, red/green styling)
  - Rationale text
  - Expandable related comments
  - Apply/Dismiss buttons
- Empty state handling
- Error display

**Confidence badge colors**:
```typescript
const confidenceColors = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-800',
}
```

See full implementation (~240 lines) in specs/feat-recommendation-engine.md

**Validation**:
- [ ] Component renders without errors
- [ ] Loading state displays
- [ ] Recommendations display with diff view
- [ ] Expandable comments work
- [ ] Apply/Dismiss buttons function
- [ ] Regenerate fetches fresh data
- [ ] Error states handled

---

### Task R2.3: Integrate RecommendationPanel with TestingDojo
**Priority**: P0 (blocking)
**Estimated Complexity**: Medium
**Dependencies**: R2.2, Dojo tasks complete

Add "Get Recommendations" button and panel to TestingDojo.

**Files to modify**:
- `frontend/src/components/TestingDojo/TestingDojo.tsx`

**Implementation**:
- Add `showRecommendations` state
- Add "Get Recommendations" button in CommentSidebar footer
  - Disabled when no comments exist
- Show RecommendationPanel as modal/overlay when triggered
- Wire up onApply to store in sessionStorage and navigate

```typescript
const [showRecommendations, setShowRecommendations] = useState(false)

// Button in sidebar footer
<button
  onClick={() => setShowRecommendations(true)}
  disabled={!hasComments}
  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
>
  Get Recommendations
</button>

// Panel
{showRecommendations && (
  <RecommendationPanel
    projectId={projectId}
    onApply={(questionId, suggestedAnswer) => {
      sessionStorage.setItem(
        'prefilled_interview',
        JSON.stringify({ questionId, value: suggestedAnswer })
      )
      onNavigateAway?.('interview')
    }}
    onClose={() => setShowRecommendations(false)}
  />
)}
```

**Validation**:
- [ ] Button appears in sidebar footer
- [ ] Button disabled when no comments
- [ ] Panel opens on click
- [ ] Apply stores in sessionStorage
- [ ] Apply triggers navigation to interview

---

## Phase 3: Apply Flow

### Task R3.1: Implement Session Storage for Pre-fill
**Priority**: P1
**Estimated Complexity**: Low
**Dependencies**: R2.3

Session storage utility functions for recommendation pre-fill.

**Implementation pattern** (inline in components, no separate file needed):

Storage key: `'prefilled_interview'`

Write (in RecommendationPanel):
```typescript
sessionStorage.setItem(
  'prefilled_interview',
  JSON.stringify({ questionId, value: suggestedAnswer })
)
```

Read (in AgentInterview):
```typescript
const prefilled = sessionStorage.getItem('prefilled_interview')
if (prefilled) {
  const { questionId, value } = JSON.parse(prefilled)
  // ... apply
  sessionStorage.removeItem('prefilled_interview')
}
```

**Validation**:
- [ ] Data persists across navigation
- [ ] Data cleared after read
- [ ] JSON parsing handles errors

---

### Task R3.2: Integrate Pre-fill with AgentInterview
**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: R3.1

Update AgentInterview component to read and apply pre-filled recommendations.

**Files to modify**:
- `frontend/src/components/AgentInterview.tsx`

**Implementation**:
```typescript
useEffect(() => {
  // Check for pre-filled recommendation
  const prefilled = sessionStorage.getItem('prefilled_interview')
  if (prefilled) {
    try {
      const { questionId, value } = JSON.parse(prefilled)
      setInterviewData((prev) => ({ ...prev, [questionId]: value }))

      // Find the question index to navigate to
      const questionIndex = questions.findIndex((q) => q.id === questionId)
      if (questionIndex >= 0) {
        setCurrentStep(questionIndex)
      }

      // Clear the prefill data
      sessionStorage.removeItem('prefilled_interview')

      // Show notification
      setNotification('Recommendation applied. Review and save when ready.')
    } catch (e) {
      console.error('Failed to parse prefilled interview data')
    }
  }
}, [])
```

**Validation**:
- [ ] Pre-filled value applied to form
- [ ] Form navigates to correct question
- [ ] SessionStorage cleared after read
- [ ] Notification shown to user
- [ ] User can modify before saving

---

### Task R3.3: E2E Tests for Recommendation Flow
**Priority**: P2
**Estimated Complexity**: Medium
**Dependencies**: R3.2

Write comprehensive E2E tests for the full recommendation workflow.

**Files to create**:
- `frontend/e2e/recommendations.spec.ts`

**Test scenarios**:

1. Generate recommendations
   - Create project with test sessions and comments
   - Click "Get Recommendations"
   - Verify recommendations display

2. Recommendation UI interactions
   - Expand related comments
   - Dismiss recommendation
   - Verify dismissed recommendation hidden

3. Apply recommendation flow
   - Click "Apply to Interview"
   - Verify redirect to interview page
   - Verify pre-filled value in form
   - Verify notification displayed

4. Empty state
   - Project with no comments
   - Verify empty state message

5. Error handling
   - Verify rate limit error displays
   - Verify timeout error displays

**Validation**:
- [ ] All test scenarios covered
- [ ] Tests pass in CI
- [ ] Critical flows tested

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Backend | R1.1-R1.5 | P0-P1 |
| Phase 2: Frontend | R2.1-R2.3 | P0 |
| Phase 3: Apply Flow | R3.1-R3.3 | P1-P2 |

**Total Tasks**: 11
**Critical Path**: R1.1 → R1.2 → R1.3 → R1.4 → R2.1 → R2.2 → R2.3 → R3.2

## References

- Spec: `specs/feat-recommendation-engine.md`
- Testing Dojo Spec: `specs/feat-testing-dojo-sessions-comments.md`
- Profile Spec: `specs/feat-ai-agent-profile-synthesis.md`
