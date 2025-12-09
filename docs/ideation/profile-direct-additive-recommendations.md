# Profile-Direct Additive Recommendations

**Slug:** profile-direct-additive-recommendations
**Author:** Claude Code
**Date:** 2025-12-03
**Related:** `specs/feat-recommendation-analysis-summary.md`, `backend/src/services/recommendationEngine.ts`

---

## 1) Intent & Assumptions

**Task Brief:**
The current recommendation system has two critical flaws:
1. **Wrong Target**: Recommendations modify interview answers, requiring users to regenerate the profile
2. **Destructive Replacement**: Recommendations suggest wholesale replacement of content, deleting valuable unrelated content

**Assumptions:**
- Profile sections are the source of truth for AI agent behavior (not interview answers)
- Users want to preserve existing rich content while adding new instructions
- Changes from recommendations should be traceable and reversible
- JSON Patch (RFC 6902) is an appropriate standard for representing surgical edits

**Out of Scope:**
- Concurrent collaborative editing (CRDT/OT patterns)
- AI-powered conflict resolution between recommendations
- Version history UI beyond basic undo
- Changes to the initial profile synthesis from interview

---

## 2) Pre-reading Log

| File | Key Takeaway |
|------|-------------|
| `backend/src/services/recommendationEngine.ts` | Generates recommendations targeting interview `questionIds` (audience, purpose, tone, emphasis, questions), returns wholesale `suggestedAnswer` replacements |
| `backend/src/services/profileSynthesizer.ts` | Profile has 5 sections: identityRole, communicationStyle, contentPriorities, engagementApproach, keyFramings. Each section has `content`, `isEdited`, `editedAt` |
| `backend/prisma/schema.prisma` | AgentConfig stores both `interviewData` (JSON) and `profile` (JSON) separately. Has `profileSource` field for tracking origin |
| `frontend/src/components/RecommendationPanel.tsx` | Shows recommendations with "Apply to Interview" button. Uses `api.applyRecommendation(projectId, rec.questionId, rec.suggestedAnswer)` |
| `/tmp/research_20251203_additive_surgical_content_modification.md` | Comprehensive research on JSON Patch, prompt engineering for additive edits, UX patterns for diff visualization |

---

## 3) Codebase Map

**Primary Components/Modules:**
- `backend/src/services/recommendationEngine.ts` - Generates recommendations from testing comments
- `backend/src/services/profileSynthesizer.ts` - Creates profile from interview data
- `backend/src/controllers/recommendation.controller.ts` - API endpoints for recommendations
- `frontend/src/components/RecommendationPanel.tsx` - UI for viewing/applying recommendations
- `frontend/src/types/recommendation.ts` - TypeScript types for recommendations

**Shared Dependencies:**
- `prisma` - Database access (AgentConfig model)
- `openai` - LLM for generating recommendations
- `@/lib/api` - Frontend API client

**Data Flow:**
```
Testing Comments → recommendationEngine.ts → ANALYSIS_PROMPT → OpenAI GPT-4
                                                    ↓
                                        Recommendation (targets interview questionId)
                                                    ↓
                                        Frontend RecommendationPanel
                                                    ↓
                                        "Apply to Interview" → Updates interviewData
                                                    ↓
                                        User must manually regenerate profile
```

**Current vs Proposed Flow:**
```
CURRENT:  Comment → Recommendation → Interview Update → Manual Profile Regeneration
PROPOSED: Comment → Recommendation → Direct Profile Patch → Immediate Effect
```

**Potential Blast Radius:**
- `recommendationEngine.ts` - Major rewrite of prompt and response structure
- `recommendation.controller.ts` - New endpoint for applying patches
- `RecommendationPanel.tsx` - New UI for patch preview and diff visualization
- `prisma/schema.prisma` - New Recommendation table (if persisting recommendations)

---

## 4) Root Cause Analysis

**Observed vs Expected:**

| Aspect | Current (Observed) | Desired (Expected) |
|--------|-------------------|-------------------|
| **Target** | Interview answers | Profile sections |
| **Operation** | Full replacement | Surgical add/remove/modify |
| **Workflow** | Modify interview → regenerate profile | Apply patch → immediate effect |
| **Content preservation** | Destroys unrelated content | Preserves everything except what conflicts |

**Root-cause hypotheses:**

1. **Design Decision** (HIGH CONFIDENCE): The original design assumed interview → profile was a one-time flow. Recommendations were meant to refine interview answers, triggering re-synthesis. This made sense when profiles were simple, but breaks down with rich content.

2. **LLM Default Behavior** (HIGH CONFIDENCE): The ANALYSIS_PROMPT doesn't constrain the LLM to surgical edits. LLMs default to full replacement when asked to "suggest improvements."

3. **Missing Data Structure** (MEDIUM): No data structure exists for representing partial edits (patches). Recommendations only store `suggestedAnswer` (full replacement).

**Decision:** All three hypotheses are correct and must be addressed:
- Retarget recommendations from interview → profile
- Constrain LLM to generate additive/surgical edits
- Adopt JSON Patch for representing partial edits

---

## 5) Research Findings

### Potential Solutions

#### Option A: Profile-Direct with JSON Patch (RECOMMENDED)

**Description:** Recommendations target profile sections directly using JSON Patch operations (RFC 6902). LLM generates structured patches that append/modify content.

**Pros:**
- Standardized format (RFC 6902) with library support (`fast-json-patch`)
- Surgical precision - targets exact paths
- Reversible - can generate inverse patches for undo
- Immediate effect - no regeneration needed
- Preserves existing content by design

**Cons:**
- Requires rewriting recommendationEngine prompt
- LLM may struggle with path syntax (can be mitigated with few-shot examples)
- More complex response validation

**Implementation Effort:** Medium (2-3 weeks)

---

#### Option B: Enhanced Interview with Merge Strategy

**Description:** Keep targeting interview but change LLM to generate "additions" that get merged with existing content rather than replacing it.

**Pros:**
- Smaller change to existing architecture
- Interview remains source of truth
- Simpler prompt engineering

**Cons:**
- Still requires profile regeneration (friction)
- Harder to make truly surgical edits
- Interview answers become bloated over time
- Doesn't leverage existing profile sections

**Implementation Effort:** Low (1 week)

---

#### Option C: Two-Step Architecture (Cursor-Inspired)

**Description:** Separate "what to change" (analysis LLM) from "how to integrate" (patch builder). First LLM identifies behavioral changes needed, second step converts to JSON Patch.

**Pros:**
- Cleaner separation of concerns
- Easier debugging (can inspect intermediate step)
- Can use different models for each step
- Higher quality patches

**Cons:**
- Two LLM calls (cost, latency)
- More complex pipeline
- Overkill for simple recommendations

**Implementation Effort:** High (3-4 weeks)

---

### Recommendation

**Adopt Option A (Profile-Direct with JSON Patch)** for these reasons:

1. **Profile is the actual runtime artifact** - The AI agent uses the profile, not interview answers
2. **JSON Patch is a proven standard** - Well-supported with `fast-json-patch` library
3. **Prompt engineering can enforce additive behavior** - Research shows explicit operation types + few-shot examples work
4. **UX is clearer** - Users see exactly what will change in the profile

**Key Implementation Details:**

1. **New Recommendation Structure:**
```typescript
interface Recommendation {
  id: string
  type: 'add' | 'remove' | 'modify'
  targetSection: 'identityRole' | 'communicationStyle' | 'contentPriorities' | 'engagementApproach' | 'keyFramings'
  operations: JsonPatchOperation[]  // RFC 6902
  rationale: string
  preview: {
    before: string
    after: string
  }
}
```

2. **Updated ANALYSIS_PROMPT:**
```
CRITICAL: Generate recommendations using ONLY these operation types:
1. ADD - Insert new content to existing section (preserve all existing content)
2. REMOVE - Remove specific clause ONLY if directly contradicted by feedback
3. MODIFY - Change specific phrase (use sparingly, prefer ADD)

NEVER generate full section replacements. Always preserve existing content.

Return JSON:
{
  "type": "add",
  "targetSection": "communicationStyle",
  "addedContent": "New instruction to append...",
  "rationale": "Why this addresses the feedback"
}
```

3. **Apply Logic:**
```typescript
import { applyPatch } from 'fast-json-patch'

// For ADD operations, append to existing content
if (rec.type === 'add') {
  const section = profile.sections[rec.targetSection]
  section.content += ' ' + rec.addedContent
  section.isEdited = true
  section.editedAt = new Date().toISOString()
}
```

---

## 6) Clarifications Needed

1. **Undo Granularity:** Should users be able to undo individual recommendations after accepting multiple? (Affects whether we need a recommendation history per section)
>> I'm thinking that each SET of recommendations applied (or not) after a dojo testing session is what we store as the "version history" so that you can "roll back" to previous versions of the agent in terms of before vs after applying a set of recommendations derived from a testing session

2. **Conflict Handling:** What happens if two recommendations target the same section?
   - Option A: Warn and require sequential application
   - Option B: Allow both and let user resolve
   - Option C: AI-powered merge (future enhancement)
>> rather than considering each comment individually (ie. one comment generates one recommendation specific to that comment), the system should be taking the TOTALITY of the comments from a testing session and then asking itself what all recommendations should be made to the profile given ALL of that feedback. so if there were two separate comments that are both relevant to / would require changes to the same section of the AI profile structure, the system should determining how best to incorporate both of them BEFORE it generates its reommendation. and thus there can never be more than one recommendation per section of the agent profile in a single set of recommendations from a testing session

3. **Profile vs Interview Sync:** After applying profile recommendations, should interview data be updated to reflect the changes? Or do profile and interview diverge?
   - Option A: Keep them separate (profile can evolve independently)
   - Option B: Back-propagate to interview (maintain sync)
>> option A. we can even call it "Initial Interview" to make it clear that this is really just a record of your first / initial answers to the core questions posed in the interview

4. **UI Presentation:** Preference for diff visualization?
   - Option A: Side-by-side (Google Docs style)
   - Option B: Inline additions (GitHub style - green highlighting)
   - Option C: Unified overlay (Word track changes style)
>> option A. let's also a "quick summary" section with 2-3 bullets summarizing the changes (which you can read while viewing the side by side diff) on every recommendation, above / before the "Why" section we already have

5. **Recommendation Persistence:** Should pending recommendations be stored in database or generated on-demand?
   - Option A: Store in `recommendation` table (enables queue, bulk actions)
   - Option B: Generate fresh each time (simpler, but loses history)
>> option A

---

## 7) Quick Wins (Immediate)

Even before full implementation, these changes would improve the current system:

1. **Update button text:** "Apply to Interview" → "Apply Change" (stops implying interview-only)

2. **Add prompt constraint:** Add "NEVER suggest deleting content that is unrelated to the feedback" to ANALYSIS_PROMPT

3. **Show current content in diff view:** Display what will be lost if user applies current replacement recommendation

4. **Track recommendation source in profile:** Add `editSource: 'recommendation'` to ProfileSection when modified via recommendations

---

## 8) Next Steps

1. **User clarification:** Get answers to the 5 clarification questions above
2. **Spec creation:** Convert this ideation into a detailed implementation spec
3. **Phase 1:** Update recommendationEngine to target profile sections and generate additive recommendations
4. **Phase 2:** Implement JSON Patch application logic
5. **Phase 3:** Build enhanced UI with diff visualization and undo capability
