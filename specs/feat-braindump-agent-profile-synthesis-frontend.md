# Braindump Agent Profile Synthesis Frontend

**Status:** Validated (8/10 - Ready)
**Author:** Claude Code
**Date:** 2025-12-13
**Phase:** 2 of 3 (Frontend Modal)
**Related:** `specs/feat-braindump-agent-profile-synthesis-backend.md`, `docs/ideation/braindump-to-agent-profile-system.md`

---

## Overview

Implement a 5-step wizard modal for creating AI agent profiles via natural language "braindump". Users can speak or type their description, and the AI extracts a structured 12-field profile with confidence signals. Inferred fields are highlighted to encourage iterative refinement.

This is Phase 2 of a 3-phase implementation:
- **Phase 1 (completed):** Database schema + backend synthesis service + API endpoint
- **Phase 2 (this spec):** Frontend braindump modal (5-step wizard)
- **Phase 3:** AgentProfile.tsx updates + interview→12-field mapping

---

## Background/Problem Statement

**Current State:** The backend synthesis endpoints are ready (`/profile/synthesize`, `/profile/save`), but there's no frontend UI for users to invoke them.

**Desired State:** A modal wizard that guides users through brain dump → synthesis → preview → refinement → save, matching the successful pattern from `AudienceProfileAIModal.tsx`.

---

## Goals

- Create `AgentProfileBrainDumpModal.tsx` with 5-step wizard flow
- Integrate voice input via existing `useSpeechRecognition` hook
- Display 12 fields grouped by 4 categories with confidence badges
- Highlight "light areas" (inferred/assumed fields) with amber styling
- Support iterative refinement via additionalContext
- Add frontend API methods to call backend endpoints
- Provide "Switch to guided interview" fallback

---

## Non-Goals

- AgentProfile.tsx display changes (Phase 3)
- Interview → 12-field mapping (Phase 3)
- Per-field inline refinement (deferred)
- Real-time streaming synthesis

---

## Technical Dependencies

### Backend APIs (Phase 1 - Ready)
- `POST /api/projects/:projectId/profile/synthesize` - Returns preview
- `POST /api/projects/:projectId/profile/save` - Persists profile

### Frontend Dependencies (Existing)
- `useSpeechRecognition.ts` - Browser speech recognition hook
- `AudienceProfileAIModal.tsx` - Reference implementation pattern
- `Button`, `Card`, `Textarea` from `./ui` - Design system components
- 33 Strategies design system (dark mode, gold accents)

---

## Detailed Design

### Component Architecture

**Simplified 3-step flow** (matching `AudienceProfileAIModal.tsx` pattern):

```
AgentProfileBrainDumpModal.tsx (new)
├── Step 1: 'input' - Brain Dump Collection
│   └── Textarea + inline mic button + char count
│   └── "Switch to guided interview" link
│   └── "Generate Profile →" button
├── Step 2: 'processing' - Synthesis In Progress
│   └── Spinner + "Analyzing..." message
│   └── Auto-advance on completion
└── Step 3: 'preview' - Preview & Save
    └── 4 category sections (static, not collapsible)
    └── 12 ProfileFieldPreview components with confidence badges
    └── Refinement textarea + "Regenerate" button
    └── "Save Profile" button
```

**Note:** Input mode selection (voice/text) is handled inline with a mic toggle button, not a separate step. This reduces friction and matches the reference implementation.

### Frontend API Methods

**File:** `frontend/src/lib/api.ts`

```typescript
// Add types
export interface AgentProfileFieldV2 {
  id: string
  title: string
  content: string
  confidence: 'EXPLICIT' | 'INFERRED' | 'ASSUMED'
  isEdited: boolean
  editedAt?: string
}

export interface AgentProfileV2 {
  fields: {
    agentIdentity: AgentProfileFieldV2
    domainExpertise: AgentProfileFieldV2
    targetAudience: AgentProfileFieldV2
    toneAndVoice: AgentProfileFieldV2
    languagePatterns: AgentProfileFieldV2
    adaptationRules: AgentProfileFieldV2
    keyTopics: AgentProfileFieldV2
    avoidanceAreas: AgentProfileFieldV2
    examplePreferences: AgentProfileFieldV2
    proactiveGuidance: AgentProfileFieldV2
    framingStrategies: AgentProfileFieldV2
    successCriteria: AgentProfileFieldV2
  }
  generatedAt: string
  source: 'braindump' | 'interview' | 'manual'
  version: 2
}

export interface BrainDumpSynthesisResponse {
  success: boolean
  profile: AgentProfileV2
  lightAreas: string[]
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
  synthesisMode: 'voice' | 'text'
}

// Add methods to ApiClient class
async synthesizeAgentProfile(
  projectId: string,
  rawInput: string,
  additionalContext?: string,
  synthesisMode?: 'voice' | 'text'
): Promise<BrainDumpSynthesisResponse> {
  return this.request<BrainDumpSynthesisResponse>(
    `/projects/${projectId}/profile/synthesize`,
    {
      method: 'POST',
      body: JSON.stringify({ rawInput, additionalContext, synthesisMode })
    }
  )
}

async saveAgentProfile(
  projectId: string,
  profile: AgentProfileV2,
  rawInput: string,
  lightAreas: string[],
  synthesisMode?: 'voice' | 'text'
): Promise<{ success: boolean; agentConfig: { id: string; profileVersion: number } }> {
  return this.request(
    `/projects/${projectId}/profile/save`,
    {
      method: 'POST',
      body: JSON.stringify({ profile, rawInput, lightAreas, synthesisMode })
    }
  )
}
```

### Modal Component

**File:** `frontend/src/components/AgentProfileBrainDumpModal.tsx`

```typescript
import { useState, useEffect } from 'react'
import { api, AgentProfileV2, BrainDumpSynthesisResponse } from '../lib/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { Button, Card } from './ui'

type Step = 'input' | 'processing' | 'preview'

interface AgentProfileBrainDumpModalProps {
  projectId: string
  onClose: () => void
  onSaved: () => void
  onSwitchToInterview: () => void
}

// Field categories for display grouping
const FIELD_CATEGORIES = {
  'Identity & Context': ['agentIdentity', 'domainExpertise', 'targetAudience'],
  'Communication & Style': ['toneAndVoice', 'languagePatterns', 'adaptationRules'],
  'Content & Priorities': ['keyTopics', 'avoidanceAreas', 'examplePreferences'],
  'Engagement & Behavior': ['proactiveGuidance', 'framingStrategies', 'successCriteria']
}
```

### UX Flow Details

**Step 1: Input ('input')**
- Large textarea (6+ rows) with placeholder example:
  - "Describe your AI agent. What does it represent? Who will it talk to? How should it communicate? What topics should it focus on?"
- Mic button in top-right of textarea (if speech supported)
  - Recording state: red pulse animation
  - Transcript appends to textarea
- Character count: "X / 50 min" (gold when >= 50)
- "Generate Profile →" button (disabled if < 50 chars)
- "Switch to guided interview" link at bottom left

**Step 2: Processing ('processing')**
- Centered spinner with gold accent
- "Analyzing your expertise..." message
- Auto-advance to preview on completion
- Error state: Show error message with "Try Again" button

**Step 3: Preview ('preview')**
- Header: "Review Your Agent Profile"
- 4 category sections (static, all visible):
  - Identity & Context (3 fields)
  - Communication & Style (3 fields)
  - Content & Priorities (3 fields)
  - Engagement & Behavior (3 fields)
- Each field shows:
  - Title + confidence badge (green "Explicit", amber "Inferred", gray "Assumed")
  - Content (read-only)
  - Light areas: amber left border + subtle background tint
- Refinement section at bottom:
  - "Want to add more detail?" label
  - Textarea for additional context
  - "Regenerate" button (appears if text entered)
- Action buttons:
  - "← Back" (returns to input step)
  - "Save Profile" (calls save API, closes modal on success)

### Styling (33 Strategies Design System)

```css
/* Light area highlighting */
.field-light-area {
  border-left: 2px solid #d4a54a;
  background: rgba(212, 165, 74, 0.05);
}

/* Confidence badges */
.badge-explicit { color: #22c55e; background: rgba(34, 197, 94, 0.1); }
.badge-inferred { color: #d4a54a; background: rgba(212, 165, 74, 0.1); }
.badge-assumed { color: #6b7280; background: rgba(107, 114, 128, 0.1); }
```

---

## Integration Points

### Entry Point: ProjectPage Agent Tab

The braindump modal is triggered from the existing "agent" tab in `ProjectPage.tsx`, replacing the default entry to `AgentInterview.tsx`.

**File:** `frontend/src/pages/ProjectPage.tsx`

**Current behavior:** Tab shows `AgentInterview` component directly.

**New behavior:** Tab shows a choice screen with two options:
1. "Describe your AI agent" → Opens `AgentProfileBrainDumpModal`
2. "Guided interview" → Shows existing `AgentInterview` component

```typescript
// In ProjectPage.tsx, within the 'agent' tab:
const [profileCreationMode, setProfileCreationMode] = useState<'choice' | 'braindump' | 'interview'>('choice')

{activeTab === 'agent' && (
  <>
    {profileCreationMode === 'choice' && (
      <ProfileCreationChoice
        onSelectBrainDump={() => setProfileCreationMode('braindump')}
        onSelectInterview={() => setProfileCreationMode('interview')}
      />
    )}
    {profileCreationMode === 'braindump' && (
      <AgentProfileBrainDumpModal
        projectId={projectId}
        onClose={() => setProfileCreationMode('choice')}
        onSaved={() => {
          setProfileCreationMode('choice')
          // Refresh profile display or navigate
        }}
        onSwitchToInterview={() => setProfileCreationMode('interview')}
      />
    )}
    {profileCreationMode === 'interview' && (
      <AgentInterview projectId={projectId!} onComplete={...} />
    )}
  </>
)}
```

### Interview Fallback

The "Switch to guided interview" link should:
1. Close the braindump modal
2. Navigate to existing `AgentInterview.tsx` flow
3. Interview completion still uses existing 5-section profile (Phase 3 maps to 12-field)

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Voice input records and appends to textarea
- [ ] Character count prevents submission under 50 chars
- [ ] Processing shows loading state
- [ ] Preview displays all 12 fields in 4 categories
- [ ] Light areas highlighted with amber styling
- [ ] Refinement + regenerate updates profile
- [ ] Save persists to database
- [ ] "Switch to interview" navigates correctly
- [ ] Modal closes on overlay click / X button

### E2E Tests

**File:** `e2e/agent-profile-braindump.spec.ts`

```typescript
test('should synthesize profile from braindump', async ({ page }) => {
  // Login, navigate to project
  await page.goto('/projects/test-project')

  // Open braindump modal
  await page.click('button:has-text("Create Profile")')

  // Select text mode
  await page.click('button:has-text("Type it out")')

  // Enter braindump
  await page.fill('textarea', 'I am building an AI assistant for my board members...')

  // Generate
  await page.click('button:has-text("Generate Profile")')

  // Wait for preview
  await expect(page.locator('text=Preview')).toBeVisible({ timeout: 60000 })

  // Verify fields displayed
  await expect(page.locator('text=Agent Identity')).toBeVisible()
  await expect(page.locator('text=Domain Expertise')).toBeVisible()

  // Save
  await page.click('button:has-text("Continue")')
  await page.click('button:has-text("Save Profile")')

  // Verify success
  await expect(page.locator('text=Profile saved')).toBeVisible()
})
```

---

## Performance Considerations

- **LLM Latency:** 5-15 seconds for synthesis. Show engaging loading state with progress messages.
- **Voice Input:** Use browser native API (no external service latency)
- **Optimistic UI:** Disable buttons during async operations, show immediate feedback

---

## Accessibility

- Keyboard navigation between steps
- Screen reader announcements for step changes
- Voice input button has proper aria-label
- Color + icon for confidence badges (not color alone)

---

## Implementation Tasks

### Task 1: API Client Methods
- Add types for AgentProfileFieldV2, AgentProfileV2, BrainDumpSynthesisResponse
- Add `synthesizeAgentProfile()` method to ApiClient
- Add `saveAgentProfile()` method to ApiClient

### Task 2: Modal Shell & Step Navigation
- Create `AgentProfileBrainDumpModal.tsx` with 3-step state machine
- Add modal overlay with close handling (click outside / X button)
- Implement step transitions: input → processing → preview

### Task 3: Input Step
- Large textarea with placeholder text
- Voice input integration (useSpeechRecognition hook)
- Character count display with validation (50 min)
- "Generate Profile →" button
- "Switch to guided interview" link
- Error state display

### Task 4: Processing Step
- Loading spinner with gold accent
- "Analyzing your expertise..." message
- API call to `/profile/synthesize`
- Error handling with "Try Again" button
- Auto-advance on success

### Task 5: Preview Step
- 4 category sections with 12 ProfileFieldPreview components
- Confidence badges (Explicit/Inferred/Assumed)
- Light area highlighting (amber border for non-EXPLICIT fields)
- Refinement textarea + "Regenerate" button
- "← Back" and "Save Profile" buttons

### Task 6: Integration
- Add ProfileCreationChoice component (braindump vs interview selector)
- Update ProjectPage.tsx agent tab with choice flow
- Wire up onSwitchToInterview callback
- Add success notification on save

---

## References

- Ideation document: `docs/ideation/braindump-to-agent-profile-system.md`
- Reference implementation: `frontend/src/components/AudienceProfileAIModal.tsx`
- Speech hook: `frontend/src/hooks/useSpeechRecognition.ts`
- Backend spec: `specs/feat-braindump-agent-profile-synthesis-backend.md`
- Design system: `.claude/skills/33-strategies-frontend-design.md`
