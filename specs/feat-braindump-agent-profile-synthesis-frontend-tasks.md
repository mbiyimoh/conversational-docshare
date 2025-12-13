# Task Breakdown: Braindump Agent Profile Synthesis Frontend

**Generated:** 2025-12-13
**Source:** specs/feat-braindump-agent-profile-synthesis-frontend.md
**Phase:** 2 of 3

---

## Overview

Implement a 3-step wizard modal for creating AI agent profiles via natural language braindump. Users speak or type their description, the AI extracts a 12-field profile with confidence signals, and inferred fields are highlighted for refinement.

---

## Phase 1: API Foundation

### Task 1.1: Add Frontend API Types and Methods

**Description:** Add TypeScript types and API client methods for braindump synthesis
**Size:** Small
**Priority:** High
**Dependencies:** None (backend already complete)
**Can run parallel with:** None (foundation task)

**File:** `frontend/src/lib/api.ts`

**Types to add:**

```typescript
// V2 Profile field with confidence tracking
export interface AgentProfileFieldV2 {
  id: string
  title: string
  content: string
  confidence: 'EXPLICIT' | 'INFERRED' | 'ASSUMED'
  isEdited: boolean
  editedAt?: string
}

// 12-field profile structure
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

// Synthesis response
export interface BrainDumpSynthesisResponse {
  success: boolean
  profile: AgentProfileV2
  lightAreas: string[]
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
  synthesisMode: 'voice' | 'text'
}
```

**Methods to add to ApiClient class:**

```typescript
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

**Acceptance Criteria:**
- [ ] Types exported from api.ts
- [ ] synthesizeAgentProfile method calls POST /projects/:projectId/profile/synthesize
- [ ] saveAgentProfile method calls POST /projects/:projectId/profile/save
- [ ] TypeScript compiles without errors

---

## Phase 2: Modal Component

### Task 2.1: Create Modal Shell with Step Navigation

**Description:** Create AgentProfileBrainDumpModal.tsx with 3-step state machine and modal overlay
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**File:** `frontend/src/components/AgentProfileBrainDumpModal.tsx`

**Implementation:**

```typescript
import { useState, useEffect } from 'react'
import { api, AgentProfileV2, BrainDumpSynthesisResponse } from '../lib/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { Button } from './ui'

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
} as const

const FIELD_TITLES: Record<string, string> = {
  agentIdentity: 'Agent Identity',
  domainExpertise: 'Domain Expertise',
  targetAudience: 'Target Audience',
  toneAndVoice: 'Tone & Voice',
  languagePatterns: 'Language Patterns',
  adaptationRules: 'Adaptation Rules',
  keyTopics: 'Key Topics',
  avoidanceAreas: 'Avoidance Areas',
  examplePreferences: 'Example Preferences',
  proactiveGuidance: 'Proactive Guidance',
  framingStrategies: 'Framing Strategies',
  successCriteria: 'Success Criteria'
}

const MIN_INPUT_LENGTH = 50

export function AgentProfileBrainDumpModal({
  projectId,
  onClose,
  onSaved,
  onSwitchToInterview
}: AgentProfileBrainDumpModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [rawInput, setRawInput] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [synthesisResult, setSynthesisResult] = useState<BrainDumpSynthesisResponse | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition()

  // Sync voice transcript to input
  useEffect(() => {
    if (transcript) {
      setRawInput(prev => prev + (prev ? ' ' : '') + transcript)
    }
  }, [transcript])

  const handleSynthesize = async () => {
    if (rawInput.trim().length < MIN_INPUT_LENGTH) {
      setError(`Please provide at least ${MIN_INPUT_LENGTH} characters`)
      return
    }

    setSynthesizing(true)
    setError('')
    setStep('processing')

    try {
      const context = step === 'preview' ? additionalContext : undefined
      const result = await api.synthesizeAgentProfile(
        projectId,
        rawInput.trim(),
        context?.trim(),
        isListening ? 'voice' : 'text'
      )
      setSynthesisResult(result)
      setAdditionalContext('')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed')
      setStep('input')
    } finally {
      setSynthesizing(false)
    }
  }

  const handleSave = async () => {
    if (!synthesisResult) return

    setSaving(true)
    setError('')

    try {
      await api.saveAgentProfile(
        projectId,
        synthesisResult.profile,
        synthesisResult.rawInput,
        synthesisResult.lightAreas,
        synthesisResult.synthesisMode
      )
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const toggleVoice = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-lg bg-card-bg backdrop-blur-sm border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">
            {step === 'input' && 'Describe Your AI Agent'}
            {step === 'processing' && 'Generating Profile...'}
            {step === 'preview' && 'Review Your Agent Profile'}
          </h2>
          <button onClick={onClose} className="text-dim hover:text-muted transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step content rendered here - see subsequent tasks */}
        {step === 'input' && (
          <InputStep
            rawInput={rawInput}
            setRawInput={setRawInput}
            isSupported={isSupported}
            isListening={isListening}
            toggleVoice={toggleVoice}
            onSynthesize={handleSynthesize}
            onSwitchToInterview={onSwitchToInterview}
          />
        )}

        {step === 'processing' && <ProcessingStep />}

        {step === 'preview' && synthesisResult && (
          <PreviewStep
            synthesisResult={synthesisResult}
            additionalContext={additionalContext}
            setAdditionalContext={setAdditionalContext}
            onRegenerate={handleSynthesize}
            onSave={handleSave}
            onBack={() => setStep('input')}
            synthesizing={synthesizing}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Modal renders with backdrop blur overlay
- [ ] X button and click-outside closes modal
- [ ] Step state transitions work correctly
- [ ] Error state displays error message
- [ ] Voice transcript syncs to textarea

---

### Task 2.2: Implement Input Step

**Description:** Build the input step with textarea, voice input, and character count validation
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.3 (if component split)

**Add to AgentProfileBrainDumpModal.tsx:**

```typescript
interface InputStepProps {
  rawInput: string
  setRawInput: (value: string) => void
  isSupported: boolean
  isListening: boolean
  toggleVoice: () => void
  onSynthesize: () => void
  onSwitchToInterview: () => void
}

function InputStep({
  rawInput,
  setRawInput,
  isSupported,
  isListening,
  toggleVoice,
  onSynthesize,
  onSwitchToInterview
}: InputStepProps) {
  const charCount = rawInput.trim().length
  const isValid = charCount >= MIN_INPUT_LENGTH

  return (
    <>
      <p className="text-muted mb-4 font-body">
        Describe your AI agent in your own words. What does it represent? Who will it talk to?
        How should it communicate? What topics should it focus on?
      </p>

      <div className="relative mb-4">
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="e.g., This AI represents our investor relations team. It should speak to board members and investors - people with finance backgrounds who care about ROI and risk. Keep things high-level but professional, and always have detailed data ready if they ask follow-up questions..."
          rows={8}
          className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 pr-12 text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 font-body resize-none"
        />
        {isSupported && (
          <button
            onClick={toggleVoice}
            className={`absolute right-3 top-3 p-2 rounded-full transition-colors ${
              isListening
                ? 'bg-destructive/20 text-destructive animate-pulse'
                : 'bg-white/5 text-muted hover:bg-white/10'
            }`}
            title={isListening ? 'Stop recording' : 'Start voice input'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        )}
      </div>

      {isListening && (
        <p className="text-sm text-accent mb-4 flex items-center gap-2 font-body">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse"></span>
          Listening... speak now
        </p>
      )}

      {/* Character count */}
      <div className="flex items-center justify-between mb-6">
        <span className={`text-sm font-mono ${isValid ? 'text-accent' : 'text-dim'}`}>
          {charCount} / {MIN_INPUT_LENGTH} min
        </span>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onSwitchToInterview}
          className="text-sm text-dim hover:text-muted underline font-body"
        >
          Switch to guided interview
        </button>
        <Button
          onClick={onSynthesize}
          disabled={!isValid}
          variant="default"
        >
          Generate Profile →
        </Button>
      </div>
    </>
  )
}
```

**Acceptance Criteria:**
- [ ] Textarea with 8 rows and placeholder text
- [ ] Mic button shows when speech supported
- [ ] Recording state shows red pulse animation
- [ ] Character count shows X / 50 min
- [ ] Character count turns gold when >= 50
- [ ] Generate button disabled when < 50 chars
- [ ] "Switch to guided interview" link works

---

### Task 2.3: Implement Processing Step

**Description:** Build the processing step with loading spinner and message
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.2

**Add to AgentProfileBrainDumpModal.tsx:**

```typescript
function ProcessingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mb-6" />
      <p className="text-muted font-body text-lg">Analyzing your expertise...</p>
      <p className="text-dim font-body text-sm mt-2">This may take a few seconds</p>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Centered spinner with gold accent color
- [ ] "Analyzing your expertise..." message displayed
- [ ] Sub-text about timing displayed

---

### Task 2.4: Implement Preview Step

**Description:** Build the preview step with 12 fields, confidence badges, light area highlighting, and refinement
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.1, Task 2.2, Task 2.3
**Can run parallel with:** None

**Add to AgentProfileBrainDumpModal.tsx:**

```typescript
interface PreviewStepProps {
  synthesisResult: BrainDumpSynthesisResponse
  additionalContext: string
  setAdditionalContext: (value: string) => void
  onRegenerate: () => void
  onSave: () => void
  onBack: () => void
  synthesizing: boolean
  saving: boolean
}

function PreviewStep({
  synthesisResult,
  additionalContext,
  setAdditionalContext,
  onRegenerate,
  onSave,
  onBack,
  synthesizing,
  saving
}: PreviewStepProps) {
  const { profile, lightAreas, overallConfidence } = synthesisResult

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'EXPLICIT':
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-success/10 text-success font-mono">
            Explicit
          </span>
        )
      case 'INFERRED':
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-mono">
            Inferred
          </span>
        )
      case 'ASSUMED':
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-dim/10 text-dim font-mono">
            Assumed
          </span>
        )
      default:
        return null
    }
  }

  const explicitCount = Object.values(profile.fields).filter(f => f.confidence === 'EXPLICIT').length
  const lightCount = lightAreas.length

  return (
    <>
      {/* Overall confidence summary */}
      <div className={`mb-6 p-3 rounded-lg border ${
        overallConfidence === 'HIGH'
          ? 'bg-success/5 border-success/20'
          : overallConfidence === 'MEDIUM'
            ? 'bg-accent/5 border-accent/20'
            : 'bg-dim/5 border-dim/20'
      }`}>
        <div className="flex items-center gap-2 text-sm font-body">
          <span className={
            overallConfidence === 'HIGH' ? 'text-success' :
            overallConfidence === 'MEDIUM' ? 'text-accent' : 'text-dim'
          }>
            {overallConfidence === 'HIGH' && '✓ High confidence profile'}
            {overallConfidence === 'MEDIUM' && '○ Some fields need attention'}
            {overallConfidence === 'LOW' && '! Several fields need more detail'}
          </span>
          <span className="text-muted">
            ({explicitCount} explicit, {lightCount} inferred)
          </span>
        </div>
      </div>

      {/* Field categories */}
      <div className="space-y-6 mb-6">
        {Object.entries(FIELD_CATEGORIES).map(([category, fieldIds]) => (
          <div key={category}>
            <h3 className="text-sm font-mono text-accent uppercase tracking-wide mb-3">
              {category}
            </h3>
            <div className="space-y-3">
              {fieldIds.map((fieldId) => {
                const field = profile.fields[fieldId as keyof typeof profile.fields]
                const isLight = lightAreas.includes(fieldId)

                return (
                  <div
                    key={fieldId}
                    className={`p-4 rounded-lg border ${
                      isLight
                        ? 'border-l-2 border-l-accent border-accent/20 bg-accent/5'
                        : 'border-border bg-background-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">
                        {FIELD_TITLES[fieldId]}
                      </span>
                      {getConfidenceBadge(field.confidence)}
                    </div>
                    <p className="text-sm text-muted whitespace-pre-wrap">
                      {field.content}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Refinement section */}
      <div className="border-t border-border pt-6 mb-6">
        <label className="block text-sm font-medium text-muted mb-2 font-body">
          Want to add more detail? (optional)
        </label>
        <textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Add context to refine inferred fields..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 font-body resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-muted hover:text-foreground font-body transition-colors"
        >
          ← Back
        </button>
        <div className="flex gap-3">
          {additionalContext.trim() && (
            <Button
              onClick={onRegenerate}
              disabled={synthesizing}
              variant="outline"
            >
              {synthesizing ? 'Regenerating...' : 'Regenerate'}
            </Button>
          )}
          <Button
            onClick={onSave}
            disabled={saving}
            variant="default"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </>
  )
}
```

**Acceptance Criteria:**
- [ ] Overall confidence banner shows HIGH/MEDIUM/LOW with counts
- [ ] 4 category sections display all 12 fields
- [ ] Each field shows title + confidence badge + content
- [ ] Light areas have amber left border and subtle background
- [ ] Refinement textarea works
- [ ] Regenerate button appears when refinement text entered
- [ ] Back button returns to input step
- [ ] Save button calls API and triggers onSaved

---

## Phase 3: Integration

### Task 3.1: Create Profile Creation Choice Component

**Description:** Build ProfileCreationChoice component for agent tab entry point
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.4
**Can run parallel with:** None

**File:** `frontend/src/components/ProfileCreationChoice.tsx`

```typescript
import { Button, Card } from './ui'

interface ProfileCreationChoiceProps {
  onSelectBrainDump: () => void
  onSelectInterview: () => void
}

export function ProfileCreationChoice({
  onSelectBrainDump,
  onSelectInterview
}: ProfileCreationChoiceProps) {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <h2 className="text-2xl font-serif text-foreground text-center mb-2">
        Create Your AI Agent Profile
      </h2>
      <p className="text-muted text-center mb-8 font-body">
        Choose how you'd like to configure your AI agent's behavior
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brain Dump Option */}
        <Card
          className="p-6 cursor-pointer hover:border-accent/50 transition-colors"
          onClick={onSelectBrainDump}
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Describe in Your Own Words
            </h3>
            <p className="text-sm text-muted font-body">
              Speak or type a natural description. AI extracts a structured profile.
            </p>
            <span className="inline-block mt-4 text-xs text-accent font-mono">
              RECOMMENDED
            </span>
          </div>
        </Card>

        {/* Interview Option */}
        <Card
          className="p-6 cursor-pointer hover:border-border/80 transition-colors"
          onClick={onSelectInterview}
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Guided Interview
            </h3>
            <p className="text-sm text-muted font-body">
              Answer 5 structured questions to build your profile step by step.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Two cards displayed side-by-side
- [ ] Brain dump card shows "RECOMMENDED" badge
- [ ] Cards are clickable and trigger callbacks
- [ ] Hover state shows border change

---

### Task 3.2: Update ProjectPage Agent Tab Integration

**Description:** Integrate braindump modal and choice component into ProjectPage
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** None

**File:** `frontend/src/pages/ProjectPage.tsx`

**Changes to make:**

1. Add imports:
```typescript
import { ProfileCreationChoice } from '../components/ProfileCreationChoice'
import { AgentProfileBrainDumpModal } from '../components/AgentProfileBrainDumpModal'
```

2. Add state:
```typescript
const [profileCreationMode, setProfileCreationMode] = useState<'choice' | 'braindump' | 'interview'>('choice')
```

3. Update the agent tab render (find existing AgentInterview usage and wrap):
```typescript
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
        projectId={projectId!}
        onClose={() => setProfileCreationMode('choice')}
        onSaved={() => {
          setProfileCreationMode('choice')
          // TODO: Show success notification or refresh profile
        }}
        onSwitchToInterview={() => setProfileCreationMode('interview')}
      />
    )}
    {profileCreationMode === 'interview' && (
      <AgentInterview
        projectId={projectId!}
        onComplete={(action) => {
          if (action === 'navigate-to-share') {
            setActiveTab('share')
          }
        }}
      />
    )}
  </>
)}
```

**Note:** Need to check existing AgentInterview integration and preserve its onComplete behavior.

**Acceptance Criteria:**
- [ ] Agent tab shows choice component by default
- [ ] Clicking "Describe in Your Own Words" opens braindump modal
- [ ] Clicking "Guided Interview" shows AgentInterview component
- [ ] Modal close returns to choice screen
- [ ] Save success returns to choice screen
- [ ] Switch to interview from modal works

---

## Summary

| Phase | Tasks | Size |
|-------|-------|------|
| Phase 1: API Foundation | 1 task | Small |
| Phase 2: Modal Component | 4 tasks | Medium-Large |
| Phase 3: Integration | 2 tasks | Small-Medium |
| **Total** | **7 tasks** | |

**Parallel Execution Opportunities:**
- Tasks 2.2 and 2.3 can run in parallel (both are step implementations)
- Task 3.1 can start as soon as Task 2.4 is complete

**Critical Path:**
Task 1.1 → Task 2.1 → Task 2.2/2.3 → Task 2.4 → Task 3.1 → Task 3.2
