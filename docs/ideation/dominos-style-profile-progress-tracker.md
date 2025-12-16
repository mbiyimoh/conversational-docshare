# Domino's-Style Progress Tracker for AI Profile Generation

**Slug:** dominos-style-profile-progress-tracker
**Author:** Claude Code
**Date:** 2025-12-15
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

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `backend/src/services/profileSynthesizer.ts` | Two synthesis flows: V1 (5 sections via interview) with `generateSingleSection()`, V2 (12 fields via braindump) with single `synthesizeFromBrainDump()` call |
| `backend/src/controllers/agent.controller.ts` | V1 already has `generateAgentProfileStream` with SSE events (`section_start`, `section_complete`). V2 has no streaming. |
| `frontend/src/components/AgentProfileBrainDumpModal.tsx` | Current V2 UI shows basic spinner "Analyzing your description..." with no stage breakdown |
| `frontend/src/lib/api.ts` | Has `generateAgentProfileStream()` using `fetchEventSource` for V1, `synthesizeAgentProfile()` as plain POST for V2 |
| `CLAUDE.md` | SSE patterns for TestingDojo chat, stale closure gotchas, 60-second LLM timeout standard |

---

## 3) Codebase Map

**Primary components/modules:**
- `frontend/src/components/AgentProfileBrainDumpModal.tsx` - Current braindump UI (needs enhancement)
- `backend/src/services/profileSynthesizer.ts` - Contains `synthesizeFromBrainDump()`
- `backend/src/controllers/agent.controller.ts` - Has `generateAgentProfileStream` pattern to follow

**Shared dependencies:**
- `framer-motion` - Already used for onboarding animations
- `lucide-react` - Icon library
- `@microsoft/fetch-event-source` - SSE client library
- 33 Strategies design tokens (gold `#d4a54a`, glass cards, DM Sans)

**Data flow:**
1. User enters braindump text in modal
2. Frontend calls `/api/projects/:projectId/profile/synthesize`
3. Backend runs single LLM call (~30-60s)
4. Response returned with 12-field profile
5. User reviews and saves

**Current gap:** No intermediate progress events between step 2 and 4.

**Potential blast radius:**
- `AgentProfileBrainDumpModal.tsx` - Major changes
- `profileSynthesizer.ts` - Refactor for streaming (if Option A)
- `agent.controller.ts` - New streaming endpoint
- `api.ts` - New SSE method for V2

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

**Suggested Stage Names:**

| Stage | Label | Rotating Tips (for long stages) |
|-------|-------|--------------------------------|
| Processing | "Processing your input..." | - |
| Analyzing | "Extracting key insights..." | - |
| Generating | "Creating your profile..." | "Analyzing communication style...", "Identifying domain expertise...", "Extracting key topics...", "Determining target audience..." |
| Finalizing | "Polishing details..." | - |
| Complete | "Profile created successfully!" | - |

---

## 8) Clarifications Needed

1. **Time estimate display:** Should we show "This usually takes 30-60 seconds" or prefer no time indication at all?

2. **Cancel button:** Should users be able to cancel mid-generation? (Recommended: Yes)

3. **Streaming preview:** During "Generating" stage, should we show partial profile content as it's extracted, or just the animated stages?

4. **Error recovery:** If generation fails, should we auto-retry once or immediately show error?

5. **Interview flow parity:** Should the V1 interview-based generation also get this new UI treatment, or keep its current streaming sections approach?

---

## 9) Component Architecture

```
frontend/src/components/
├── ProfileSynthesisProgress/
│   ├── ProfileSynthesisProgress.tsx   # Main container
│   ├── StageIndicator.tsx             # Individual stage row
│   ├── StreamingPreview.tsx           # Optional text preview
│   └── useSynthesisProgress.ts        # SSE hook
└── AgentProfileBrainDumpModal.tsx     # Updated to use new component
```

**Key Props:**
```typescript
interface ProfileSynthesisProgressProps {
  projectId: string
  brainDumpText: string
  onComplete: (profile: AgentProfileV2) => void
  onError: (error: Error) => void
  onCancel?: () => void
}
```

---

## 10) Visual Design (33 Strategies)

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
- Section marker: JetBrains Mono, uppercase, tracking-wider

**Animation Timing:**
- Stage transitions: 0.3s ease-out
- Icon pulse: 2s infinite
- Tip rotation: 8-10s interval
- Success celebration: spring animation (stiffness 260, damping 20)

---

## 11) Implementation Checklist

### Backend (Option C)
- [ ] Create `synthesizeBrainDumpStream` in `agent.controller.ts`
- [ ] Add route `/api/projects/:projectId/profile/synthesize-stream`
- [ ] Send `start`, `generating`, `complete` events via SSE

### Frontend
- [ ] Create `ProfileSynthesisProgress` component
- [ ] Create `StageIndicator` sub-component
- [ ] Create `useSynthesisProgress` hook with SSE logic
- [ ] Update `AgentProfileBrainDumpModal` to use new progress UI
- [ ] Add rotating context tips during "Generating" stage
- [ ] Add cancel button with keyboard support (ESC)
- [ ] Add success animation on completion
- [ ] Add ARIA live regions for accessibility

### Testing
- [ ] Test with short input (~50 chars) - should complete quickly without feeling rushed
- [ ] Test with long input (~2000 chars) - stages should feel natural
- [ ] Test network disconnect recovery
- [ ] Test cancel mid-generation
- [ ] Test reduced motion preference
