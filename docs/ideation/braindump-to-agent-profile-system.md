# Braindump to Agent Profile System

**Slug:** braindump-to-agent-profile-system
**Author:** Claude Code
**Date:** 2025-12-12
**Branch:** preflight/braindump-to-agent-profile-system
**Related:** `specs/feat-ai-first-profile-creation.md`, `specs/feat-ai-agent-profile-synthesis.md`

---

## 1) Intent & Assumptions

- **Task brief:** Replace the current interview-based agent profile creation with a "braindump to AI profile" system. Users describe their AI agent's desired behavior naturally (via voice or text), and the AI extracts a structured 12-field profile with confidence scoring and light area highlighting. This mirrors the enhanced system the user implemented in another project, with a richer profile structure than the current 5-section model.

- **Assumptions:**
  - Profile structure will be **expanded from 5 sections to 12 fields** (see Section 7)
  - Voice input will use browser-native SpeechRecognition API (already exists as `useSpeechRecognition.ts`)
  - The existing `profileSynthesizer.ts` backend service will be replaced/enhanced with braindump-first synthesis
  - The 5-step interview wizard in `AgentInterview.tsx` will be replaced with a braindump modal flow
  - The existing AI modal pattern from `AudienceProfileAIModal.tsx` serves as a reference implementation
  - Iterative refinement (add context → regenerate) is a core requirement
  - **Light areas will be persisted** in the database and displayed after save to encourage refinement
  - **rawBrainDump will be stored** for future reference/regeneration

- **Out of scope:**
  - Changes to the runtime AI behavior/context layer system (profile → system prompt logic will need updating)
  - Real-time streaming synthesis (full response is acceptable)
  - Custom voice transcription service (browser native is sufficient)

---

## 2) Pre-reading Log

- `backend/src/services/profileSynthesizer.ts`: Core profile synthesis service. Uses interview data to generate 5 sections in parallel batches. Has structure detection (isStructured mode) for preserving user formatting. 60s timeout, gpt-4-turbo, temp 0.3.

- `backend/src/services/profileBrainDumpSynthesizer.ts`: Existing braindump synthesizer for audience/collaborator profiles. Shows the pattern for natural language → structured JSON extraction.

- `frontend/src/components/AgentInterview.tsx`: 5-question structured interview wizard. Stores responses in `interviewData` JSON field. Has review view with tab switching between responses and profile.

- `frontend/src/components/AgentProfile.tsx`: Displays generated profile sections with edit capability. Supports version history and rollback. Shows progress during section-by-section generation.

- `frontend/src/components/AudienceProfileAIModal.tsx`: Reference implementation of braindump-to-profile for audiences. 2-step flow (input → preview) with voice input and iterative refinement.

- `frontend/src/hooks/useSpeechRecognition.ts`: Existing speech recognition hook with proper TypeScript types. Handles continuous listening and transcript accumulation.

- `specs/feat-ai-first-profile-creation.md`: Previous spec for AI-first profile creation for audience/collaborator profiles. Provides architectural patterns.

- `backend/prisma/schema.prisma`: AgentConfig model stores `interviewData` (JSON), `profile` (JSON), `profileSource`, `profileVersion`. No schema changes needed.

---

## 3) Codebase Map

- **Primary components/modules:**
  - `frontend/src/components/AgentInterview.tsx` → TO BE REPLACED with braindump modal
  - `frontend/src/components/AgentProfile.tsx` → KEEP but modify triggering
  - `backend/src/services/profileSynthesizer.ts` → ENHANCE with braindump synthesis
  - `backend/src/controllers/agent.controller.ts` → ADD new synthesis endpoint
  - `frontend/src/hooks/useSpeechRecognition.ts` → REUSE as-is

- **Shared dependencies:**
  - `frontend/src/lib/api.ts` - API client (add new synthesis method)
  - `backend/src/utils/openai.ts` - OpenAI client wrapper
  - `backend/src/utils/errors.ts` - LLMError class
  - Theme system: 33 Strategies design tokens (dark mode, glass effects)

- **Data flow:**
  ```
  User speaks/types braindump
    → SpeechRecognition API → textarea value
    → POST /api/projects/:id/profile/synthesize
    → profileSynthesizer.synthesizeFromBrainDump()
    → GPT-4 extracts 5 sections + confidence + lightAreas
    → Frontend displays preview with light areas highlighted
    → User optionally adds refinement context → regenerate
    → User confirms → POST /api/projects/:id/agent-config (save)
    → AgentProfile.tsx displays final profile
  ```

- **Feature flags/config:**
  - `preferredModel` in AgentConfig (default: gpt-4-turbo)
  - `temperature` in AgentConfig (default: 0.7 for chat, 0.3 for synthesis)

- **Potential blast radius:**
  - `AgentInterview.tsx` - Major rewrite
  - `profileSynthesizer.ts` - Add new function
  - `AgentProfile.tsx` - Minor changes (remove interview dependency)
  - Dashboard project creation flow - Route changes
  - E2E tests in `e2e/ai-profile-creation.spec.ts`

---

## 4) Root Cause Analysis

This is a feature enhancement, not a bug fix. However, identifying limitations of the current system:

- **Current UX Friction Points:**
  1. 5-step interview requires decomposing holistic understanding into discrete fields
  2. Users must navigate question-by-question even when they have complete mental model
  3. No voice input for interview (only for audience/collaborator profiles)
  4. No confidence indicators on generated profile sections
  5. Regeneration requires re-running entire interview

- **Observed vs Expected:**
  - **Observed:** Users complete interview → profile generated → edit sections manually
  - **Expected:** Users brain dump → AI extracts with confidence → highlight uncertain areas → iterative refinement → save

- **Evidence:**
  - User feedback from other project: braindump approach was "dramatically faster"
  - Existing `AudienceProfileAIModal.tsx` already implements this pattern for audiences
  - Research shows voice-first UX reduces friction for conversational input

---

## 5) Research

### Potential Solutions

**Option A: Replace Interview with Braindump Modal (Recommended)**

Replace `AgentInterview.tsx` with a new `AgentProfileBrainDumpModal.tsx` following the 5-step wizard pattern:

1. Input Mode Selection (voice/text)
2. Brain Dump Collection (textarea + speech-to-text)
3. Processing (loading with section progress)
4. Preview (read-only fields + light areas highlighted + refinement input)
5. Confirmation

**Pros:**
- Matches user's successful implementation in other project
- Consistent with existing `AudienceProfileAIModal.tsx` pattern
- Preserves existing profile structure (no schema changes)
- Voice-first aligns with mobile/quick-capture use cases

**Cons:**
- Loses structured interview for users who prefer guided Q&A
- Requires new synthesis logic on backend

---

**Option B: Hybrid Approach - Keep Interview as Fallback**

Add braindump modal as primary, but keep interview wizard accessible via "Switch to guided interview" link.

**Pros:**
- Flexibility for different user preferences
- Lower risk - existing flow still works
- Can A/B test which approach users prefer

**Cons:**
- More code to maintain
- Potential UX confusion with two paths

---

**Option C: Braindump Per-Section**

Instead of one braindump → 5 sections, allow braindump for each section individually.

**Pros:**
- More granular control
- Easier to refine specific sections

**Cons:**
- Loses the "holistic synthesis" benefit
- More friction than single braindump
- Doesn't match user's successful other-project pattern

---

### Recommendation

**Option B (Hybrid)** - Implement braindump as primary with interview as fallback.

This provides the new streamlined experience while maintaining backward compatibility. Users who prefer structured guidance can still use the interview flow.

### Key Implementation Details from Research

1. **Confidence Signals (Not Scores):** Instruct LLM to return qualitative confidence (`EXPLICIT`, `INFERRED`, `ASSUMED`) rather than numeric scores. LLMs hallucinate numbers but can reliably identify uncertainty reasons.

2. **Light Areas UX:** Use subtle visual differentiation (amber border, "Inferred" badge) rather than red warnings. Fields should feel like they're being refined, not broken.

3. **Iterative Refinement Architecture:** Store original braindump immutably, accumulate refinements in separate context, re-synthesize with full context rather than from scratch.

4. **Schema Validation with Self-Healing:** Use Zod validation with retry logic - if LLM JSON fails validation, send error back to LLM with fix instructions.

5. **Stepper UX:** 3-5 steps optimal, always show progress, implement auto-save at each step, allow point-and-click refinement without re-entering stepper.

---

## 6) Clarification (RESOLVED)

1. **Profile Structure:** ~~Keep existing 5 sections or adopt richer structure?~~
   - **DECISION:** Expand to a **richer 12-field structure** (see Section 7). Not necessarily 15 fields, but more comprehensive than current 5 sections.

2. **Interview Fallback:** Should the guided interview wizard be preserved as a fallback option?
   - **DECISION:** Yes, preserve as fallback with "Switch to guided interview" link.

3. **Light Areas Persistence:** Store in database or display-only during creation?
   - **DECISION:** **Store in database** for future reference and recommendation engine integration.

4. **Confidence Display After Save:** Show confidence badges on saved profile sections?
   - **DECISION:** **Yes, show after save** to encourage users to add more detail to inferred fields later.

5. **rawBrainDump Storage:** Store original braindump text for future regeneration?
   - **DECISION:** **Yes**, store in `AgentConfig.rawBrainDump` field (new field).

---

## 7) Proposed Profile Structure (12 Fields)

Expanding from current 5 sections to 12 fields organized in 4 categories:

### Category 1: Identity & Context

| Field | Description | Example |
|-------|-------------|---------|
| `agentIdentity` | Who the agent represents - organization, team, role, mission | "You are the AI assistant for Acme Corp's investor relations team, representing the CFO's perspective on financial matters." |
| `domainExpertise` | Areas of knowledge, expertise depth, credentials to claim | "Expert in SaaS metrics, financial modeling, and market analysis. Can speak authoritatively on ARR, churn, and unit economics." |
| `targetAudience` | Who the agent serves, their characteristics, what they care about | "Board members and investors - senior executives with finance backgrounds who care about ROI, risk mitigation, and strategic alignment." |

### Category 2: Communication & Style

| Field | Description | Example |
|-------|-------------|---------|
| `toneAndVoice` | Personality, formality level, character traits | "Professional but approachable. Confident without being arrogant. Use 'we' language to emphasize partnership." |
| `languagePatterns` | Specific phrases, terminology, level of detail, formatting preferences | "Use precise financial terminology. Lead with headlines, then details. Bullet points for lists. Avoid jargon without explanation." |
| `adaptationRules` | How to adjust for different contexts, question types, or audience signals | "For technical questions, provide data first. For strategic questions, start with implications. If asked for opinions, qualify with 'based on the data...'" |

### Category 3: Content & Priorities

| Field | Description | Example |
|-------|-------------|---------|
| `keyTopics` | Primary topics to emphasize, tiered by importance | "**Tier 1:** Revenue growth, customer retention, market expansion. **Tier 2:** Product roadmap, competitive positioning. **Tier 3:** Operational efficiency." |
| `avoidanceAreas` | Topics to avoid, handle carefully, or redirect | "Avoid speculation about competitors. Don't discuss unannounced features. Redirect M&A questions to 'we're always evaluating opportunities.'" |
| `examplePreferences` | Use of examples, analogies, data citations, document references | "Always cite specific document sections when possible. Use analogies from well-known companies. Reference metrics with exact figures." |

### Category 4: Engagement & Behavior

| Field | Description | Example |
|-------|-------------|---------|
| `proactiveGuidance` | Questions to ask, conversation steering, follow-up prompts | "After answering about financials, ask 'Would you like me to break down the quarterly trends?' Proactively suggest related documents." |
| `framingStrategies` | How to position key messages, reframes for common objections | "Frame challenges as 'opportunities for optimization.' Position churn as 'natural market refinement.' Always end concerning topics with forward-looking actions." |
| `successCriteria` | What constitutes a good interaction, goals for each conversation | "Success = user finds specific information quickly, feels confident in the data, knows where to go for more detail." |

### Mapping from Current 5 Sections

| Current Section | Maps To |
|-----------------|---------|
| `identityRole` | `agentIdentity` + `targetAudience` |
| `communicationStyle` | `toneAndVoice` + `languagePatterns` |
| `contentPriorities` | `keyTopics` + `avoidanceAreas` |
| `engagementApproach` | `proactiveGuidance` + `adaptationRules` |
| `keyFramings` | `framingStrategies` + `successCriteria` |

New additions: `domainExpertise`, `examplePreferences`

---

## 8) Architecture Proposal

### Database Schema Changes

```prisma
model AgentConfig {
  // ... existing fields ...

  // NEW: Braindump storage
  rawBrainDump       String?   @db.Text  // Original user input
  synthesisMode      String?   // "voice" | "text" | "interview"

  // UPDATED: Profile structure
  profile            Json?     // Now uses 12-field structure
  lightAreas         String[]  // Field IDs with low confidence

  // Existing (keep)
  profileVersion     Int       @default(1)
  profileGeneratedAt DateTime?
  profileSource      String?   // "braindump" | "interview" | "manual"
}
```

### Backend Changes

```typescript
// NEW: backend/src/services/profileSynthesizer.ts (add function)

interface ProfileField {
  id: string
  title: string
  content: string
  confidence: 'EXPLICIT' | 'INFERRED' | 'ASSUMED'
  isEdited: boolean
  editedAt?: string
}

interface AgentProfile {
  fields: {
    agentIdentity: ProfileField
    domainExpertise: ProfileField
    targetAudience: ProfileField
    toneAndVoice: ProfileField
    languagePatterns: ProfileField
    adaptationRules: ProfileField
    keyTopics: ProfileField
    avoidanceAreas: ProfileField
    examplePreferences: ProfileField
    proactiveGuidance: ProfileField
    framingStrategies: ProfileField
    successCriteria: ProfileField
  }
  generatedAt: string
  source: 'braindump' | 'interview' | 'manual'
}

interface BrainDumpSynthesisResult {
  profile: AgentProfile
  lightAreas: string[]  // Field IDs where confidence != 'EXPLICIT'
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
}

export async function synthesizeFromBrainDump(
  rawInput: string,
  additionalContext?: string
): Promise<BrainDumpSynthesisResult> {
  // LLM prompt instructs extraction of 12 fields with confidence signals
  // Returns qualitative confidence per field, not numeric scores
}
```

### Frontend Changes

```
NEW: frontend/src/components/AgentProfileBrainDumpModal.tsx
  - 5-step wizard: input-mode → brain-dump → processing → preview → confirm
  - Uses useSpeechRecognition hook
  - Groups fields by category (4 collapsible sections)
  - Shows light areas with amber highlighting + "Inferred" badge
  - Supports iterative refinement with context accumulation

MODIFY: frontend/src/components/AgentProfile.tsx
  - Update to display 12 fields grouped by category
  - Show confidence badges on inferred fields (amber "Needs detail" indicator)
  - Click on inferred field → opens refinement modal for that field
  - Keep version history and rollback functionality

MODIFY: frontend/src/components/AgentInterview.tsx
  - Keep as fallback, accessed via "Switch to guided interview"
  - Update to map interview responses → 12-field structure
```

### API Endpoints

```
POST /api/projects/:projectId/profile/synthesize
  Body: { rawInput: string, additionalContext?: string, synthesisMode: 'voice' | 'text' }
  Response: {
    profile: AgentProfile,
    lightAreas: string[],
    overallConfidence: string,
    rawInput: string
  }

POST /api/projects/:projectId/profile/refine-field
  Body: { fieldId: string, additionalContext: string }
  Response: { field: ProfileField, confidence: string }
```

---

## 9) UX Flow

### Primary Flow: Braindump Creation

```
1. User clicks "Create AI Profile" on dashboard
   ↓
2. Modal Step 1: Input Mode Selection
   - "Type it out" button
   - "Speak it" button (if voice supported)
   ↓
3. Modal Step 2: Brain Dump Collection
   - Large textarea with placeholder examples
   - Mic button for voice input (if selected)
   - Character count, minimum 50 chars
   - "Generate Profile →" button
   ↓
4. Modal Step 3: Processing
   - Spinner with "Analyzing your expertise..."
   - Progress indicator showing field extraction
   ↓
5. Modal Step 4: Preview
   - 4 collapsible category sections
   - 12 fields displayed with content
   - Inferred fields highlighted with amber border + "Inferred" badge
   - Refinement textarea: "Want to add more detail?"
   - "Regenerate" button (if refinement added)
   - "Continue →" button
   ↓
6. Modal Step 5: Confirmation
   - "Profile Ready!" message
   - Summary of explicit vs inferred fields
   - "Save Profile" button
   ↓
7. Profile saved → AgentProfile.tsx displays with:
   - All 12 fields in 4 categories
   - Inferred fields show subtle "Add detail" prompt
   - Click → inline refinement for that field
```

### Secondary Flow: Interview Fallback

- "Switch to guided interview" link in Step 2
- Opens existing 5-question interview flow
- On completion, maps to 12-field structure (some fields will be inferred)

---

## 10) Next Steps

1. ~~User clarifies questions in Section 6~~ **DONE**
2. Create detailed spec from this ideation document (`/spec:create`)
3. Implement Phase 1: Database migration + backend synthesis function
4. Implement Phase 2: Frontend braindump modal (5-step wizard)
5. Implement Phase 3: AgentProfile.tsx updates (12 fields + confidence display)
6. Implement Phase 4: Integration, testing, and interview→12-field mapping
