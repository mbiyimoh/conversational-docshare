# AI-First Profile Creation: Voice-Friendly Brain Dump to Structured Profiles

**Slug:** ai-first-profile-creation
**Author:** Claude Code
**Date:** 2025-12-09
**Branch:** preflight/ai-first-profile-creation
**Related:** `specs/feat-saved-audience-collaborator-profiles.md`, `backend/src/services/profileSynthesizer.ts`

---

## 1) Intent & Assumptions

- **Task brief:** Transform the audience/collaborator profile creation experience from form-based input to an AI-first approach where users can brain dump (voice or text) their thoughts about an audience or collaborator, and AI synthesizes it into the structured profile format. Users should be able to iteratively refine with additional context before saving.

- **Assumptions:**
  - Users often have rich mental models of their audiences/collaborators that don't fit neatly into form fields
  - Voice input (via browser speech-to-text or device mic) is the primary expected input method
  - The existing `profileSynthesizer.ts` pattern for "raw input → structured data" can be adapted
  - The existing profile data models (AudienceProfile, CollaboratorProfile) remain unchanged
  - Users want to review/approve synthesized profiles before saving
  - Iterative refinement ("add more context" → regenerate) is essential

- **Out of scope:**
  - Custom voice transcription service (browser native API is sufficient)
  - Changes to the underlying AudienceProfile/CollaboratorProfile database models
  - Editing individual synthesized fields manually in the AI flow (form fallback available)
  - Real-time streaming synthesis (full response is acceptable)
  - Saving draft/incomplete profiles

- **Pattern distinction (important):**
  - **"AI-assisted manual editing"** (this feature): User brain dumps → AI synthesizes → user refines → save
  - **Dojo recommendation system** (existing): AI analyzes test comments → generates profile change recommendations → user approves
  - Both use LLM synthesis but serve different workflows. Reference Dojo patterns for technical consistency.

---

## 2) Pre-reading Log

- `frontend/src/components/SavedProfilesSection.tsx`: Current modal implementation with form fields. Modals are `max-w-lg` (512px). Handles CRUD for both profile types. **Key takeaway**: Replace `AudienceProfileModal` and `CollaboratorProfileModal` with new AI-first versions.

- `backend/src/services/profileSynthesizer.ts`: Core pattern for "raw input → structured output". Uses `analyzeInputStructure()` to detect tiers/lists. Generates JSON via OpenAI with structured prompts. **Key takeaway**: Adapt this pattern for audience/collaborator profile synthesis.

- `backend/src/services/audienceSynthesis.ts`: Incremental synthesis pattern. Versioning with regeneration. **Key takeaway**: Follow this pattern for iterative refinement.

- `specs/feat-saved-audience-collaborator-profiles.md`: Original spec. Defines data models and API endpoints. **Key takeaway**: Keep same API contract, add new synthesis endpoint.

- `frontend/src/components/AudienceSynthesisPanel.tsx`: UI for regeneration with versions. **Key takeaway**: Borrow UX patterns for review/regenerate flow.

---

## 3) Codebase Map

**Primary components/modules:**

| File | Role |
|------|------|
| `frontend/src/components/SavedProfilesSection.tsx` | Current UI - needs new AI-first modals |
| `frontend/src/pages/DashboardPage.tsx` | Parent page containing SavedProfilesSection |
| `backend/src/controllers/audienceProfile.controller.ts` | API - needs new synthesize endpoint |
| `backend/src/controllers/collaboratorProfile.controller.ts` | API - needs new synthesize endpoint |
| `backend/src/services/profileSynthesizer.ts` | Pattern reference for synthesis logic |
| `frontend/src/lib/api.ts` | API client - needs new synthesis methods |

**Shared dependencies:**
- OpenAI client (`backend/src/utils/openai.ts`)
- Prisma models (AudienceProfile, CollaboratorProfile)
- shadcn/ui components for modal/form elements

**Data flow:**
```
User brain dump (text/voice)
  → POST /api/audience-profiles/synthesize
  → LLM extracts structured fields
  → Return preview JSON (not saved)
  → User reviews, optionally adds context
  → POST /api/audience-profiles/synthesize (with additionalContext)
  → Return updated preview
  → User confirms
  → POST /api/audience-profiles (existing create endpoint)
  → Profile saved
```

**Potential blast radius:**
- SavedProfilesSection.tsx (major changes to modals)
- DashboardPage.tsx (imports stay same)
- audienceProfile.controller.ts (new endpoint)
- collaboratorProfile.controller.ts (new endpoint)
- api.ts (new methods)
- New service file for profile synthesis

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research

### Existing Patterns in Codebase

**Pattern 1: ProfileSynthesizer (backend/src/services/profileSynthesizer.ts)**
- Takes raw interview data → produces structured AgentProfile
- Uses `analyzeInputStructure()` for input detection
- JSON response format with OpenAI
- Handles structured vs unstructured input differently

**Pattern 2: AudienceSynthesis incremental update**
- `updateAudienceSynthesis()` takes previous + new data
- Builds prompt that includes previous state + new input
- Perfect for "add more context" flow

### Potential Solutions

**1. New ProfileBrainDumpSynthesizer service (Recommended)**

Pros:
- Follows existing profileSynthesizer pattern exactly
- Reuses prompt engineering techniques
- Separate from main profile synthesizer (single responsibility)
- Can handle both audience and collaborator profiles

Cons:
- New service file to maintain
- Some code overlap with profileSynthesizer

**2. Extend existing profileSynthesizer**

Pros:
- Less code duplication
- Single source of synthesis logic

Cons:
- ProfileSynthesizer is for AgentProfile (5 sections), not AudienceProfile/CollaboratorProfile
- Different output structure would complicate the code
- Risk of breaking existing interview flow

**3. Inline synthesis in controllers**

Pros:
- Simple, direct implementation

Cons:
- Not reusable
- Hard to test
- Violates separation of concerns

### Recommendation

**Create `backend/src/services/profileBrainDumpSynthesizer.ts`** that:
1. Follows the profileSynthesizer pattern
2. Has `synthesizeAudienceProfile(rawInput: string, additionalContext?: string)`
3. Has `synthesizeCollaboratorProfile(rawInput: string, additionalContext?: string)`
4. Uses JSON response format
5. Returns preview data (not saved to DB)

**Frontend flow (3-step wizard in larger modal):**
1. **Step 1: Input** - Large textarea + mic button, "Generate Profile" button
2. **Step 2: Review** - Display synthesized profile fields, "Add More Context" textarea, "Regenerate" and "Save" buttons
3. **Step 3: Saved** - Success state, close modal

---

## 6) Clarification (RESOLVED)

**Decisions confirmed:**

1. **Modal size**: `max-w-2xl` (672px) ✅

2. **Voice input**: Include browser native `SpeechRecognition` API ✅

3. **Preview format**: Read-only display with regenerate option ✅
   - Encourage AI-driven approach by default
   - Manual form entry only if user explicitly opts out

4. **Error handling**: "Switch to manual entry" fallback link ✅

5. **Edit flow**: YES - include AI-assisted editing for existing profiles ✅
   - Create standardization around "AI-assisted manual editing" pattern
   - This is distinct from Dojo mode recommendation system (which auto-generates profile updates from comments)
   - Reference Dojo recommendation technical patterns where relevant, but acknowledge different use case

---

## 7) Proposed Implementation Structure

### Backend

**New service: `backend/src/services/profileBrainDumpSynthesizer.ts`**
```typescript
interface SynthesizedAudienceProfile {
  name: string
  description: string
  audienceDescription: string
  communicationStyle: string
  topicsEmphasis: string
  accessType: 'open' | 'email' | 'password' | 'domain'
}

interface SynthesizedCollaboratorProfile {
  name: string
  email: string | null
  description: string
  communicationNotes: string
  expertiseAreas: string[]
  feedbackStyle: 'direct' | 'gentle' | 'detailed' | 'high-level' | null
}

export async function synthesizeAudienceProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesizedAudienceProfile>

export async function synthesizeCollaboratorProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesizedCollaboratorProfile>
```

**New endpoints:**
- `POST /api/audience-profiles/synthesize` → `{ rawInput, additionalContext? }` → `{ profile: SynthesizedAudienceProfile }`
- `POST /api/collaborator-profiles/synthesize` → `{ rawInput, additionalContext? }` → `{ profile: SynthesizedCollaboratorProfile }`

### Frontend

**New component: `AudienceProfileAIModal.tsx`**
- Replace current `AudienceProfileModal` in SavedProfilesSection
- 3-step wizard: Input → Review → (saved via parent)
- Uses `api.synthesizeAudienceProfile(rawInput, additionalContext)`
- On confirm, calls existing `onSaved(profile)` callback

**New component: `CollaboratorProfileAIModal.tsx`**
- Same pattern as above for collaborator profiles

**API client additions:**
```typescript
async synthesizeAudienceProfile(rawInput: string, additionalContext?: string) {
  return this.request<{ profile: SynthesizedAudienceProfile }>(
    '/api/audience-profiles/synthesize',
    { method: 'POST', body: JSON.stringify({ rawInput, additionalContext }) }
  )
}

async synthesizeCollaboratorProfile(rawInput: string, additionalContext?: string) {
  return this.request<{ profile: SynthesizedCollaboratorProfile }>(
    '/api/collaborator-profiles/synthesize',
    { method: 'POST', body: JSON.stringify({ rawInput, additionalContext }) }
  )
}
```

---

## 8) UI Flow Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│ Create Audience Profile                                    [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tell us about this audience                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  [🎤]  Start talking or type...                        │   │
│  │                                                         │   │
│  │  (voice transcript appears here as you speak)          │   │
│  │                                                         │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💡 Example: "These are my board members - mostly senior        │
│     executives with finance backgrounds. They care about        │
│     ROI and risk. Keep things high-level but have data ready."  │
│                                                                 │
│  [Cancel]                              [Generate Profile →]     │
└─────────────────────────────────────────────────────────────────┘

                            ↓ (after synthesis)

┌─────────────────────────────────────────────────────────────────┐
│ Review Audience Profile                                    [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Profile Generated                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Name: Board Members                                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Description: Senior executives providing governance      │   │
│  │ oversight with finance and strategy backgrounds          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Audience: C-level executives and board directors...      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Communication: Professional, concise, data-driven...     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Topics: ROI analysis, risk assessment, strategic fit...  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Access: Password protected                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Want to add more detail?                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ (optional: add more context to refine the profile)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Back]    [Regenerate]              [Save Profile ✓]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9) Consistency Notes

To maintain codebase consistency:

1. **Follow profileSynthesizer.ts patterns** for LLM calls (timeout, JSON response format, error handling)
2. **Use existing API client pattern** (api.ts request method)
3. **Modal styling** should match existing modals but with larger `max-w-2xl`
4. **Error states** should follow existing patterns (red toast/banner)
5. **Loading states** should use existing spinner/skeleton patterns
6. **Form validation** should match existing validation patterns
