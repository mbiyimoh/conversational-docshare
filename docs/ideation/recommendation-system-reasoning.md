# Recommendation System Reasoning & Transparency

**Slug:** recommendation-system-reasoning
**Author:** Claude Code
**Date:** 2025-12-03
**Branch:** preflight/recommendation-system-reasoning
**Related:** `specs/feat-recommendation-engine.md`, `specs/feat-recommendation-engine-tasks.md`

---

## 1) Intent & Assumptions

**Task brief:** Add a "system reasoning" explanation field to the recommendation engine that shows the AI's thinking and justification for its recommendations. This should explain why each recommendation was made, critically explain when/why the system decides NOT to recommend changes (which should be rare since user comments almost always warrant agent profile updates), provide visibility into the overall analysis summary, and handle the edge case where no recommendations are generated.

**Assumptions:**
- The recommendation engine currently works but may return empty results without explanation
- User comments during testing almost always warrant some profile adjustment (empty results are suspicious)
- Users want transparency into AI decision-making without being overwhelmed
- The current `rationale` field per recommendation is insufficient for explaining overall analysis
- LLM prompt changes can capture reasoning without major architectural changes

**Out of scope:**
- Learning from acceptance/rejection patterns (future ML enhancement)
- Real-time recommendation updates
- Cross-project recommendation patterns
- Major UI redesign beyond adding reasoning display

---

## 2) Pre-reading Log

- `backend/src/services/recommendationEngine.ts`: Core engine uses GPT-4-turbo with ANALYSIS_PROMPT. Returns `{recommendations, totalComments, sessionsAnalyzed}`. **Issue**: No overall reasoning/summary field returned. When LLM returns empty array, no explanation provided.

- `frontend/src/types/recommendation.ts`: TypeScript interfaces for `Recommendation`, `RecommendationResponse`. **Gap**: No `analysisSummary` or `reasoning` field in response type.

- `frontend/src/components/RecommendationPanel.tsx`: Displays recommendations with rationale per card. Empty state just says "No recommendations available. Add more comments during testing." **Issue**: Doesn't explain WHY no recommendations.

- `specs/feat-recommendation-engine.md`: Full spec for recommendation feature. Non-goals include learning from patterns. **Opportunity**: Add transparency as enhancement.

---

## 3) Codebase Map

**Primary components/modules:**
- `backend/src/services/recommendationEngine.ts` - LLM analysis engine (needs prompt update + response parsing)
- `backend/src/controllers/recommendation.controller.ts` - API endpoint (pass-through, minimal changes)
- `frontend/src/types/recommendation.ts` - TypeScript types (add new fields)
- `frontend/src/components/RecommendationPanel.tsx` - UI display (add reasoning section)

**Shared dependencies:**
- `backend/src/utils/openai.ts` - OpenAI client wrapper
- `backend/src/utils/prisma.ts` - Database access
- `frontend/src/lib/api.ts` - API client methods

**Data flow:**
```
User clicks "Get Recommendations"
    ↓
RecommendationPanel → api.getRecommendations()
    ↓
Backend: recommendationEngine.generateRecommendations()
    ↓
GPT-4-turbo analysis with ANALYSIS_PROMPT
    ↓
Parse response → Build Recommendation[]
    ↓
Return {recommendations, totalComments, sessionsAnalyzed, [NEW: analysisSummary]}
    ↓
Frontend displays with reasoning visibility
```

**Feature flags/config:**
- `MAX_COMMENTS = 50` - Comment limit
- `LLM_TIMEOUT_MS = 30000` - 30s timeout
- `RATE_LIMIT = 10` - Requests per hour per project

**Potential blast radius:**
- Backend: `recommendationEngine.ts` (prompt + response parsing)
- Frontend: `recommendation.ts` (types), `RecommendationPanel.tsx` (UI)
- Tests: `recommendationEngine.test.ts`, `recommendation.controller.test.ts`
- No database changes required

---

## 4) Root Cause Analysis

**Not applicable** - This is a feature enhancement, not a bug fix.

However, the user reported an issue: "No recommendations available" when they expected recommendations. Potential causes:

1. **LLM decided current config is sufficient** - But didn't explain why
2. **Comment wasn't properly linked to session** - Database relationship issue
3. **LLM returned invalid JSON** - Parsing silently returned empty array
4. **Comment content was too vague** - LLM couldn't map to interview question

The feature addresses cause #1 by requiring LLM to always explain its reasoning.

---

## 5) Research

### Potential Solutions

**Approach 1: Inline Full Reasoning**
Always show complete analysis summary at top of panel.

| Pros | Cons |
|------|------|
| Maximum transparency | High cognitive load |
| Simple implementation | Can overwhelm users |
| No user action needed | Takes up screen space |

**Approach 2: Progressive Disclosure (Recommended)**
Show collapsed summary by default, expandable for full reasoning.

| Pros | Cons |
|------|------|
| Balanced transparency/UX | Slightly more complex UI |
| Scalable to many recommendations | Requires extra click for detail |
| Proven pattern (Claude, Grammarly) | May hide important info |

**Approach 3: Confidence-Based Display**
Show detail level based on certainty - more detail for uncertain decisions.

| Pros | Cons |
|------|------|
| Efficient use of attention | Inconsistent UI |
| Highlights uncertain areas | Complex logic |
| Adaptive to context | May confuse users |

**Approach 4: "No Action" Explanation Card**
Only show reasoning when no recommendations (special empty state).

| Pros | Cons |
|------|------|
| Minimal changes | Only addresses empty case |
| Focused on problem case | Doesn't add value to normal flow |
| Simple implementation | Misses opportunity for transparency |

### Recommendation

**Use Progressive Disclosure (Approach 2) with enhanced empty state handling.**

This provides:
1. **Analysis Summary** - Always visible at top, 2-3 sentences explaining overall analysis
2. **Per-Recommendation Rationale** - Already exists, keep as-is
3. **Empty State Explanation** - When no recommendations, explain WHY in detail
4. **Expandable Reasoning** - "Show analysis details" expander for full LLM thinking

**Why this approach:**
- Matches user profile (technical but not engineers - want clarity without noise)
- Proven by Claude's extended thinking, Grammarly's suggestions
- Can ship Phase 1 (summary + empty state) quickly, add expandable detail later
- Minimal UI disruption to existing panel design

---

## 6) Clarification

1. **Summary visibility**: Should the analysis summary always be visible, or collapsed by default?
   - Recommended: Always visible (2-3 sentences is short enough)

2. **Empty state behavior**: When no recommendations, should we suggest actions?
   - Options: Just explain why / Suggest "try adding more specific comments" / Suggest retrying
   - Recommended: Explain why + suggest actions

3. **"No change needed" scenario**: If LLM determines current config already addresses feedback, how should this be presented?
   - Options: As a success message / As a special recommendation card / In the summary
   - Recommended: As a success message with explanation

4. **Token budget**: The enhanced prompt will use more tokens. Is there a cost concern?
   - Current: ~2000 max_tokens response
   - Proposed: ~2500 max_tokens (adds ~$0.01-0.02 per request at GPT-4-turbo rates)

---

## 7) Proposed Implementation

### Type Changes

```typescript
// frontend/src/types/recommendation.ts
export interface AnalysisSummary {
  overview: string                    // 2-3 sentence summary
  feedbackThemes: string[]            // Main themes identified
  configAlignment: 'good' | 'needs_update' | 'partial'  // How well current config matches feedback
  noChangeReason?: string             // If no recommendations, why not
}

export interface RecommendationResponse {
  recommendations: Recommendation[]
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
  analysisSummary: AnalysisSummary    // NEW
}
```

### Prompt Enhancement

```typescript
const ANALYSIS_PROMPT = `You are an expert at analyzing user feedback...

## Task
Analyze the feedback and provide:
1. An analysis summary explaining your reasoning
2. Specific recommendations for interview answer updates

IMPORTANT: If you determine no changes are needed, you MUST explain why.
User comments almost always warrant some profile adjustment, so "no recommendations"
should be rare and well-justified. Possible valid reasons:
- Current config already addresses the feedback themes
- Feedback is contradictory and needs user clarification
- Feedback relates to document content, not AI agent behavior

Return a JSON object with this structure:
{
  "analysisSummary": {
    "overview": "After analyzing 5 comments across 2 sessions, I identified...",
    "feedbackThemes": ["tone formality", "response length"],
    "configAlignment": "needs_update",
    "noChangeReason": null  // or explanation if no recommendations
  },
  "recommendations": [...]
}
`
```

### UI Changes

```
┌─────────────────────────────────────────────────────────────┐
│ Recommendations                          [Regenerate] [X]   │
├─────────────────────────────────────────────────────────────┤
│ Analysis Summary                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Analyzed 5 comments across 2 sessions. Main themes:     │ │
│ │ tone formality (3 comments), response detail (2).       │ │
│ │ Your current config partially addresses these areas.    │ │
│ │                                    [Show full analysis] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 2 Recommendations                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Communication Style                        HIGH         │ │
│ │ Current: "Professional"                                 │ │
│ │ Suggested: "Professional but approachable..."          │ │
│ │ Why: 3 comments mentioned formal tone...                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Empty State:**
```
┌─────────────────────────────────────────────────────────────┐
│ Analysis Summary                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✓ Your Current Config Looks Good                        │ │
│ │                                                         │ │
│ │ After analyzing 2 comments, I found your current        │ │
│ │ interview answers already address the feedback themes:  │ │
│ │                                                         │ │
│ │ • Your tone setting ("professional but friendly")       │ │
│ │   aligns with the comment about approachability        │ │
│ │ • Content emphasis already includes the requested      │ │
│ │   focus on practical examples                          │ │
│ │                                                         │ │
│ │ If you expected changes, try:                          │ │
│ │ • Adding more specific comments about what to change   │ │
│ │ • Testing different conversation scenarios             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 8) Implementation Phases

### Phase 1: Backend Reasoning (2-3 hours)
- Update ANALYSIS_PROMPT to require analysisSummary
- Update response parsing to extract summary
- Add AnalysisSummary to return type
- Update tests

### Phase 2: Frontend Display (2-3 hours)
- Add AnalysisSummary type
- Add summary section to RecommendationPanel
- Update empty state with explanation
- Style the new UI elements

### Phase 3: Polish & Testing (1-2 hours)
- E2E tests for reasoning display
- Handle edge cases (timeout, parse errors)
- Verify all states render correctly

**Total estimate: 5-8 hours**

---

## 9) Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM doesn't follow new format | Add fallback parsing, validate structure |
| Increased token cost | Monitor costs, adjust prompt if needed |
| Reasoning too verbose | Limit overview to 3 sentences in prompt |
| Breaking existing clients | analysisSummary is additive, backwards compatible |

---

## 10) Success Criteria

1. Every recommendation response includes analysisSummary
2. Empty results always explain why (no more "No recommendations available")
3. Users can understand AI reasoning without reading full analysis
4. No increase in error rate from prompt changes
5. Tests pass for all new scenarios
