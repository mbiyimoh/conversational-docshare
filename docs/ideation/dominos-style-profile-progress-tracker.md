# Domino's-Style Progress Tracker for AI Profile Generation

**Slug:** dominos-style-profile-progress-tracker
**Author:** Claude Code
**Date:** 2025-12-15
**Updated:** 2025-12-15 (post-architecture refactor)
**Related:** `feat-braindump-agent-profile-synthesis-frontend.md`, `feat-sequential-profile-generation.md`

---

## 1) Intent & Assumptions

**Task brief:** Implement a multi-stage "Domino's tracker" style progress indicator for AI agent profile generation. When users complete a braindump or interview, they should see step-by-step visual progress with named stages that explain what's happening, build confidence the system is working, and provide insight into how the profile gets created.

**Assumptions:**
- Profile generation takes 15-60 seconds depending on input size
- Users are non-technical and benefit from operational transparency
- The existing V1 interview flow has SSE streaming infrastructure we can extend
- Framer Motion is already available in the project for animations
- The 33 Strategies design system (gold accents, glass cards, DM Sans font) applies

**Out of scope:**
- Changes to the actual LLM synthesis logic (prompts, model, etc.)
- Changing the 12-field profile structure
- Mobile-specific optimizations (responsive design assumed)
- Persisting progress state across page refreshes

**User Decisions (Confirmed):**
1. Show time estimate: "This usually takes 30-60 seconds"
2. Include cancel button: Yes
3. Show streaming preview: Yes
4. Error recovery: Auto-retry twice before showing error
5. V1 interview flow: Update to match new progress UI

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `backend/src/services/profileSynthesizer.ts` | Two synthesis flows: V1 (5 sections via interview) with `generateSingleSection()`, V2 (12 fields via braindump) with single `synthesizeFromBrainDump()` call |
| `backend/src/controllers/agent.controller.ts` | V1 already has `generateAgentProfileStream` with SSE events (`section_start`, `section_complete`). V2 has no streaming. |
| `frontend/src/components/AgentProfileBrainDumpModal.tsx` | Current V2 UI shows basic spinner "Analyzing your description..." with no stage breakdown |
| `frontend/src/lib/api.ts` | Has `generateAgentProfileStream()` using `fetchEventSource` for V1, `synthesizeAgentProfile()` as plain POST for V2 |
| `CLAUDE.md` | SSE patterns for TestingDojo chat, stale closure gotchas, 60-second LLM timeout standard |

**New Architecture Files (Post-Refactor):**

| File | Takeaway |
|------|----------|
| `frontend/src/components/AgentPage.tsx` | Smart wrapper orchestrating profile creation flow. Calls `api.getAgentConfig()` to check `status === 'complete'`. Opens BrainDump/Interview modals. Handles `onSaved` callback with success toast. |
| `frontend/src/components/AgentInterviewModal.tsx` | Modal-based 5-question interview. Has built-in progress bar. Saves config then calls `onComplete()`. |
| `frontend/src/components/AgentProfile.tsx` | **Already has streaming progress UI for V1!** Lines 279-333 show section-by-section progress with checkmarks/spinners. Also has refinement flow that needs progress. |
| `frontend/src/components/SourceMaterialModal.tsx` | View raw braindump or interview responses. Uses `rawBrainDump` or `interviewData` from AgentConfig. |
| `CLAUDE.md` (Agent Tab Architecture) | Documents flow: AgentPage → Modals → AgentProfile. Tab uses URL params. |

---

## 3) Codebase Map

### Current Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgentPage.tsx                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ checkProfileExists() → api.getAgentConfig()              │   │
│  │   ├─ status !== 'complete' → ProfileCreationChoice       │   │
│  │   └─ status === 'complete' → AgentProfile                │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────┬───────────────────────────────────┬─────────────┘
                │                                   │
    ┌───────────▼───────────┐           ┌──────────▼──────────┐
    │ AgentProfileBrainDump │           │ AgentInterviewModal │
    │       Modal.tsx       │           │                     │
    │                       │           │  • 5 questions      │
    │  • Text/voice input   │           │  • Built-in progress│
    │  • 'processing' step  │◄──NEEDS──►│  • Saves interview  │
    │    ❌ Basic spinner   │  PROGRESS │    then onComplete()│
    │  • Preview + Save     │  TRACKER  │                     │
    └───────────────────────┘           └──────────┬──────────┘
                                                   │
                                        ┌──────────▼──────────┐
                                        │   AgentProfile.tsx  │
                                        │                     │
                                        │  ✅ Already has     │
                                        │     streaming UI    │
                                        │     for V1!         │
                                        │                     │
                                        │  • Refinement flow  │◄──NEEDS
                                        │    ❌ No progress   │   PROGRESS
                                        └─────────────────────┘
```

### Integration Points for Progress Tracker

**Location 1: BrainDump Modal (Primary)**
- File: `AgentProfileBrainDumpModal.tsx`
- Current: `step === 'processing'` shows basic spinner (lines 247-259)
- Change: Replace with `ProfileSynthesisProgress` component

**Location 2: Interview → Profile Generation**
- Flow: `AgentInterviewModal.onComplete()` → `AgentPage.handleProfileCreated()` → `AgentProfile.generateProfile()`
- Current: Profile generation happens in `AgentProfile` with existing streaming UI
- Change: Enhance existing `generateProfile()` UI to use shared `ProfileSynthesisProgress`

**Location 3: Refinement Flow**
- File: `AgentProfile.tsx`
- Function: `handleRefineProfile()` (lines 208-242)
- Current: Sets `refining=true`, calls `api.synthesizeAgentProfile()`, no progress
- Change: Show progress tracker during refinement

### Shared Dependencies

- `framer-motion` - Already used for onboarding animations
- `lucide-react` - Icon library (Sparkles, Loader, CheckCircle, Circle)
- `@microsoft/fetch-event-source` - SSE client library
- 33 Strategies design tokens (gold `#d4a54a`, glass cards, DM Sans)

### Existing V1 Progress UI (Reusable Pattern)

From `AgentProfile.tsx` lines 279-333:
```tsx
// State
const [generationStep, setGenerationStep] = useState<string>('')
const [currentSection, setCurrentSection] = useState<string | null>(null)
const [completedSections, setCompletedSections] = useState<string[]>([])

// Display
const sectionDisplayInfo = [
  { id: 'identityRole', name: 'Identity & Role' },
  { id: 'communicationStyle', name: 'Communication Style' },
  ...
]

// Render: checkmark (complete) | spinner (current) | empty circle (pending)
```

This pattern can be extracted into a reusable `ProfileSynthesisProgress` component.

---

## 4) Root Cause Analysis

*N/A - This is a new feature, not a bug fix.*

---

## 5) Research Findings

### Key UX Principles

| Principle | Application |
|-----------|-------------|
| **Uncertain waits feel longer** | Show named stages even without precise timing |
| **Unexplained waits feel longer** | Always provide feedback within 1 second |
| **Idle time feels longer than engaged time** | Show streaming preview, rotate context tips |
| **Progress indicators increase patience 3x** | Always use animated indicators |
| **Visible labor increases perceived value** | Name stages after actual AI tasks |

### Recommended 4-Stage Tracker

| Stage | Duration | Indicator | User-Facing Label |
|-------|----------|-----------|-------------------|
| 1. Processing | 2-5s | Pulsing sparkle icon | "Reading your brain dump..." |
| 2. Analyzing | 5-10s | Spinning loader | "Extracting key insights..." |
| 3. Generating | 30-40s | Spinner + streaming preview | "Creating your profile fields..." |
| 4. Finalizing | 3-5s | Progress bar | "Polishing and formatting..." |

### Anti-Patterns to Avoid

- **Fake progress bars** - Don't simulate progress with `setTimeout` increments
- **Precise time estimates** - Use "usually 30-60 seconds" not countdown timers
- **Too many stages** - 3-5 is optimal, more feels overwhelming
- **Static loading screens** - Always animate to show system is alive
- **Technical jargon** - "Analyzing" not "Running inference pipeline"

---

## 6) Potential Solutions

### Option A: True SSE Streaming (Recommended)

**Approach:** Refactor `synthesizeFromBrainDump()` to emit progress events via SSE, similar to existing `generateAgentProfileStream`.

**Implementation:**
1. Create new endpoint `/api/projects/:projectId/profile/synthesize-stream`
2. Backend emits: `stage`, `field_complete`, `token` (for preview), `complete`
3. Frontend uses `fetchEventSource` to receive real-time updates
4. Show 4-stage tracker with streaming text preview

**Backend Event Types:**
```typescript
type ProgressEvent =
  | { type: 'stage'; stage: 'processing' | 'analyzing' | 'generating' | 'finalizing' }
  | { type: 'field_progress'; fieldId: string; fieldName: string }
  | { type: 'preview'; content: string }  // Partial output for preview
  | { type: 'complete'; profile: AgentProfileV2 }
  | { type: 'error'; message: string }
```

**Pros:**
- Progress tied to actual work
- Consistent with existing V1 streaming pattern
- Real-time feedback builds maximum confidence
- Can show which field is currently being extracted

**Cons:**
- Requires backend refactoring
- Single LLM call means limited granularity (need to restructure prompt or batch)
- More complex error handling

**Estimated Effort:** Medium-High (2-3 days)

---

### Option B: Simulated Progress with Timed Stages

**Approach:** Keep existing single API call, frontend shows animated stages on a timer, jumps to completion when response arrives.

**Implementation:**
1. Frontend shows stages advancing every ~10-15 seconds
2. "Generating" stage has rotating context tips
3. When API response arrives, immediately complete all stages
4. Use `Promise.race` with timeout for stuck requests

**Pros:**
- No backend changes
- Quick to implement
- Still provides visual engagement

**Cons:**
- Progress not tied to reality
- Could show "Finalizing" when actually still in early processing
- Less trustworthy if users notice the disconnect

**Estimated Effort:** Low (0.5-1 day)

---

### Option C: Hybrid - Backend Markers + Frontend Animation (Best Compromise)

**Approach:** Backend sends minimal stage markers (start, generating, complete), frontend fills in animated transitions between them.

**Implementation:**
1. Backend SSE sends 3 events: `start`, `generating`, `complete`
2. Frontend shows 4-5 UI stages, animating between backend markers
3. "Processing" and "Analyzing" are timed from `start`
4. "Generating" activates on backend `generating` event
5. "Finalizing" + "Complete" trigger on `complete`

**Backend Changes (Minimal):**
```typescript
export async function synthesizeBrainDumpStream(req: Request, res: Response) {
  // SSE setup...

  sendEvent({ type: 'stage', stage: 'start' })

  // Small delay to show processing UI
  await new Promise(r => setTimeout(r, 2000))
  sendEvent({ type: 'stage', stage: 'generating' })

  const result = await synthesizeFromBrainDump(rawInput, additionalContext)

  sendEvent({ type: 'complete', profile: result.profile })
}
```

**Pros:**
- Minimal backend changes
- Real events anchor the animation
- Feels responsive without full restructure

**Cons:**
- Still some simulated progress
- Less granular than Option A

**Estimated Effort:** Medium (1-2 days)

---

## 7) Recommendation

**Recommended: Option C (Hybrid) for MVP, Option A for V2**

**Rationale:**
1. Option C delivers 80% of the UX value with 40% of the effort
2. Backend changes are minimal and low-risk
3. Existing SSE infrastructure can be reused
4. Future enhancement to Option A is straightforward
5. Existing V1 progress UI in `AgentProfile.tsx` provides a proven pattern to extend

**Suggested Stage Names:**

| Stage | Label | Rotating Tips (for long stages) |
|-------|-------|--------------------------------|
| Processing | "Processing your input..." | - |
| Analyzing | "Extracting key insights..." | - |
| Generating | "Creating your profile..." | "Analyzing communication style...", "Identifying domain expertise...", "Extracting key topics...", "Determining target audience..." |
| Finalizing | "Polishing details..." | - |
| Complete | "Profile created successfully!" | - |

---

## 8) Component Architecture (Updated)

### File Structure

```
frontend/src/components/
├── ProfileSynthesisProgress/
│   ├── index.ts                         # Barrel export
│   ├── ProfileSynthesisProgress.tsx     # Main container (shared by all flows)
│   ├── StageIndicator.tsx               # Individual stage row with animation
│   ├── StreamingPreview.tsx             # Partial content preview
│   ├── ContextTips.tsx                  # Rotating tips during generation
│   └── useSynthesisProgress.ts          # SSE connection hook
│
├── AgentPage.tsx                        # Unchanged - orchestrator
├── AgentProfileBrainDumpModal.tsx       # Uses ProfileSynthesisProgress
├── AgentInterviewModal.tsx              # Unchanged (has own progress bar)
├── AgentProfile.tsx                     # Uses ProfileSynthesisProgress for refinement
└── SourceMaterialModal.tsx              # Unchanged
```

### Component Interfaces

```typescript
// Main progress component - used by BrainDump, Interview gen, and Refinement
interface ProfileSynthesisProgressProps {
  projectId: string
  mode: 'braindump' | 'interview' | 'refinement'
  inputText?: string           // For braindump/refinement
  additionalContext?: string   // For refinement
  onComplete: (profile: AgentProfileV2) => void
  onError: (error: Error) => void
  onCancel?: () => void
  showTimeEstimate?: boolean   // Default: true
  allowRetry?: boolean         // Default: true (auto-retry twice)
}

// Individual stage indicator
interface StageIndicatorProps {
  stage: StageConfig
  status: 'pending' | 'active' | 'complete'
  description?: string
}

// Stage configuration
interface StageConfig {
  id: string
  label: string
  description: string
  icon: 'sparkles' | 'loader' | 'check' | 'circle'
}

// SSE hook return type
interface UseSynthesisProgressReturn {
  currentStage: Stage
  streamedPreview: string
  error: Error | null
  isComplete: boolean
  cancel: () => void
}
```

### Integration Examples

**BrainDump Modal (replace lines 247-259):**
```tsx
{step === 'processing' && (
  <ProfileSynthesisProgress
    projectId={projectId}
    mode="braindump"
    inputText={rawInput}
    onComplete={(profile) => {
      setSynthesisResult(profile)
      setStep('preview')
    }}
    onError={(err) => {
      setError(err.message)
      setStep('input')
    }}
    onCancel={() => setStep('input')}
  />
)}
```

**Refinement Flow (replace lines 208-242):**
```tsx
{refining && (
  <ProfileSynthesisProgress
    projectId={projectId}
    mode="refinement"
    additionalContext={refinementContext}
    onComplete={async (profile) => {
      await api.saveAgentProfileV2(projectId, { profile, ... })
      await loadProfile()
      setRefining(false)
      showNotification('Profile updated')
    }}
    onError={(err) => setError(err.message)}
    onCancel={() => setRefining(false)}
  />
)}
```

---

## 9) Visual Design (33 Strategies)

**Stage Indicators:**
- **Active:** Gold accent (`#d4a54a`), scale 1.02, pulsing/spinning icon
- **Complete:** Green checkmark (`#22c55e`), scale 1
- **Pending:** Muted gray (`#555555`), opacity 0.3

**Container:**
```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(8px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 0.5rem;
```

**Typography:**
- Stage labels: DM Sans, font-medium
- Descriptions: DM Sans, text-sm, text-muted
- Time estimate: DM Sans, text-sm, text-dim
- Section marker: JetBrains Mono, uppercase, tracking-wider

**Animation Timing:**
- Stage transitions: 0.3s ease-out
- Icon pulse: 2s infinite
- Tip rotation: 8-10s interval
- Success celebration: spring animation (stiffness 260, damping 20)

**Cancel Button:**
- Text-only, muted color
- "Cancel" label
- ESC keyboard shortcut

---

## 10) Implementation Checklist

### Backend (Option C)

- [ ] Create `synthesizeBrainDumpStream` in `agent.controller.ts`
- [ ] Add route `POST /api/projects/:projectId/profile/synthesize-stream`
- [ ] Send SSE events: `start`, `generating`, `complete`, `error`
- [ ] Add retry logic (up to 2 retries before error)
- [ ] Ensure 60-second timeout with proper cleanup

### Frontend - Shared Components

- [ ] Create `ProfileSynthesisProgress/` directory
- [ ] Create `ProfileSynthesisProgress.tsx` main component
- [ ] Create `StageIndicator.tsx` with animations
- [ ] Create `StreamingPreview.tsx` for partial content display
- [ ] Create `ContextTips.tsx` with 8-10s rotation
- [ ] Create `useSynthesisProgress.ts` SSE hook with retry logic

### Frontend - Integration

- [ ] Update `AgentProfileBrainDumpModal.tsx` to use new progress component
- [ ] Update `AgentProfile.tsx` refinement flow to use progress component
- [ ] Update `AgentProfile.tsx` V1 generation to use shared component
- [ ] Add cancel button with ESC keyboard support
- [ ] Add ARIA live regions for accessibility
- [ ] Add "This usually takes 30-60 seconds" time estimate

### Frontend API

- [ ] Add `synthesizeBrainDumpStream()` method to `api.ts`
- [ ] Handle SSE connection lifecycle
- [ ] Implement auto-retry (2 attempts before error)

### Testing

- [ ] Test with short input (~50 chars) - should complete quickly without feeling rushed
- [ ] Test with long input (~2000 chars) - stages should feel natural
- [ ] Test network disconnect recovery
- [ ] Test cancel mid-generation
- [ ] Test reduced motion preference
- [ ] Test auto-retry behavior
- [ ] Test all three flows: braindump, interview generation, refinement

---

## 11) Migration Notes

### Backward Compatibility

The existing `synthesizeAgentProfile()` API endpoint will remain unchanged. The new `synthesize-stream` endpoint is additive.

### Rollout Strategy

1. **Phase 1:** Deploy `ProfileSynthesisProgress` component
2. **Phase 2:** Integrate into `AgentProfileBrainDumpModal` (primary use case)
3. **Phase 3:** Integrate into `AgentProfile` refinement flow
4. **Phase 4:** Consolidate V1 interview generation to use shared component
