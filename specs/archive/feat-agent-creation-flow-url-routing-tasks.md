# Task Breakdown: Fix AI Agent Creation Flow and URL-Based Tab Routing

**Generated:** 2025-12-15
**Source:** specs/feat-agent-creation-flow-url-routing.md

---

## Overview

Fix three bugs in the AI agent creation flow (blank profile page, no redirect after brain dump, interview tab persists) and implement URL-based tab navigation using query parameters. This involves creating 2 new components (AgentPage, SourceMaterialModal), modifying 3 existing components (ProjectPage, AgentProfile, AgentInterview), and adding comprehensive testing.

**Total Tasks:** 10
**Phases:** 6
**Parallel Execution Opportunities:** Tasks 2.1-2.2 can run in parallel; Tasks 5.1 and 6.1-6.2 can run in parallel

---

## Phase 1: Fix Critical Bugs

### Task 1.1: Create AgentPage Smart Wrapper Component

**Description:** Create new AgentPage.tsx component that handles profile existence check and orchestrates the agent tab flow.
**Size:** Large
**Priority:** High (Critical Bug Fix)
**Dependencies:** None
**Can run parallel with:** None (foundational)

**File:** `frontend/src/components/AgentPage.tsx`

**Technical Requirements:**
- Check profile existence via `api.getAgentConfig(projectId)`
- Show ProfileCreationChoice when no profile exists
- Show AgentProfile when profile exists
- Handle brain dump modal and interview modal flows
- Display success toast after profile creation
- Support "Start Over" flow to return to creation choice

**Complete Implementation:**

```typescript
// frontend/src/components/AgentPage.tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { ProfileCreationChoice } from './ProfileCreationChoice'
import { AgentProfileBrainDumpModal } from './AgentProfileBrainDumpModal'
import { AgentInterviewModal } from './AgentInterviewModal'
import { AgentProfile } from './AgentProfile'

interface AgentPageProps {
  projectId: string
  onNavigateToTab: (tab: string) => void
}

export function AgentPage({ projectId, onNavigateToTab }: AgentPageProps) {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreationChoice, setShowCreationChoice] = useState(false)
  const [showBrainDumpModal, setShowBrainDumpModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    checkProfileExists()
  }, [projectId])

  const checkProfileExists = async () => {
    try {
      setLoading(true)
      const response = await api.getAgentConfig(projectId)
      const config = response.agentConfig as { status?: string } | null
      setHasProfile(config?.status === 'complete')
      setShowCreationChoice(config?.status !== 'complete')
    } catch (err) {
      // Assume no profile exists - let user create one
      // This handles 404s and network errors gracefully
      setHasProfile(false)
      setShowCreationChoice(true)
      console.warn('Failed to check profile existence:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileCreated = () => {
    setNotification('Profile created successfully')
    setShowBrainDumpModal(false)
    setShowInterviewModal(false)
    setShowCreationChoice(false)
    setHasProfile(true)
    setTimeout(() => setNotification(null), 3000)
  }

  const handleStartOver = () => {
    setShowCreationChoice(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading...
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Success Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-success text-background px-4 py-2 rounded-lg shadow-lg z-50">
          {notification}
        </div>
      )}

      {/* Creation Choice - shown when no profile exists */}
      {showCreationChoice && !hasProfile && (
        <ProfileCreationChoice
          onSelectBrainDump={() => setShowBrainDumpModal(true)}
          onSelectInterview={() => setShowInterviewModal(true)}
        />
      )}

      {/* Brain Dump Modal */}
      {showBrainDumpModal && (
        <AgentProfileBrainDumpModal
          projectId={projectId}
          onClose={() => setShowBrainDumpModal(false)}
          onSaved={handleProfileCreated}
          onSwitchToInterview={() => {
            setShowBrainDumpModal(false)
            setShowInterviewModal(true)
          }}
        />
      )}

      {/* Interview Modal */}
      {showInterviewModal && (
        <AgentInterviewModal
          projectId={projectId}
          onClose={() => setShowInterviewModal(false)}
          onComplete={handleProfileCreated}
        />
      )}

      {/* Profile View - shown when profile exists */}
      {hasProfile && !showCreationChoice && (
        <AgentProfile
          projectId={projectId}
          onNavigateToTest={() => onNavigateToTab('test')}
          onStartOver={handleStartOver}
        />
      )}
    </>
  )
}
```

**Acceptance Criteria:**
- [ ] Component loads and checks profile existence on mount
- [ ] Shows loading spinner while checking
- [ ] Shows ProfileCreationChoice when no profile exists
- [ ] Shows AgentProfile when profile exists
- [ ] Brain dump modal opens when selected
- [ ] Interview modal opens when selected
- [ ] Success toast appears after profile creation
- [ ] Profile view shows immediately after creation (no redirect to choice)
- [ ] "Start Over" returns to creation choice
- [ ] Handles API errors gracefully (shows creation choice as fallback)

---

### Task 1.2: Update ProjectPage to Use AgentPage

**Description:** Simplify ProjectPage by replacing inline agent tab logic with AgentPage component.
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**File:** `frontend/src/pages/ProjectPage.tsx`

**Technical Requirements:**
- Remove `profileCreationMode` state and related logic
- Import and use AgentPage component
- Pass `projectId` and `onNavigateToTab` props

**Changes to make:**

```typescript
// Remove these imports (if not used elsewhere):
// import { ProfileCreationChoice } from '../components/ProfileCreationChoice'
// import { AgentProfileBrainDumpModal } from '../components/AgentProfileBrainDumpModal'

// Add this import:
import { AgentPage } from '../components/AgentPage'

// Remove this state:
// const [profileCreationMode, setProfileCreationMode] = useState<'loading' | 'choice' | 'braindump' | 'interview'>('loading')

// Remove the useEffect that checks for existing profile (lines ~46-66)

// Replace the entire agent tab content (lines ~161-199) with:
<div role="tabpanel" hidden={activeTab !== 'agent'}>
  {activeTab === 'agent' && (
    <AgentPage
      projectId={projectId!}
      onNavigateToTab={setActiveTab}
    />
  )}
</div>
```

**Acceptance Criteria:**
- [ ] ProfileCreationMode state removed
- [ ] Agent tab useEffect removed
- [ ] AgentPage component renders in agent tab
- [ ] Navigation between tabs still works
- [ ] No TypeScript errors

---

## Phase 2: Add Source Material Modal

### Task 2.1: Create SourceMaterialModal Component

**Description:** Create modal component to display raw brain dump or interview responses.
**Size:** Medium
**Priority:** Medium
**Dependencies:** None
**Can run parallel with:** Task 2.2

**File:** `frontend/src/components/SourceMaterialModal.tsx`

**Complete Implementation:**

```typescript
// frontend/src/components/SourceMaterialModal.tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Button } from './ui'

interface SourceMaterialModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface SourceMaterial {
  type: 'braindump' | 'interview'
  braindump?: string
  interviewData?: Record<string, string>
}

const INTERVIEW_QUESTIONS: Record<string, string> = {
  audience: 'Who is your primary audience?',
  purpose: "What's the main purpose of these documents?",
  tone: 'What communication style should the AI use?',
  emphasis: 'What should the AI emphasize?',
  questions: 'What proactive questions should the AI ask?'
}

export function SourceMaterialModal({ projectId, isOpen, onClose }: SourceMaterialModalProps) {
  const [material, setMaterial] = useState<SourceMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) loadSourceMaterial()
  }, [isOpen, projectId])

  const loadSourceMaterial = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getAgentConfig(projectId)
      const config = response.agentConfig as {
        rawBrainDump?: string
        interviewData?: Record<string, string>
        synthesisMode?: string
      }

      if (config.rawBrainDump) {
        setMaterial({ type: 'braindump', braindump: config.rawBrainDump })
      } else if (config.interviewData) {
        setMaterial({ type: 'interview', interviewData: config.interviewData })
      } else {
        setMaterial(null)
      }
    } catch (err) {
      console.error('Failed to load source material:', err)
      setMaterial(null)
      setError('Unable to load source material')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg border border-border p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">
            {material?.type === 'braindump' ? 'Original Brain Dump' : 'Interview Responses'}
          </h2>
          <button
            onClick={onClose}
            className="text-dim hover:text-muted transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
          </div>
        ) : material?.type === 'braindump' ? (
          <div className="p-4 bg-background-elevated rounded-lg">
            <p className="text-muted whitespace-pre-wrap font-body">{material.braindump}</p>
          </div>
        ) : material?.type === 'interview' ? (
          <div className="space-y-4">
            {Object.entries(INTERVIEW_QUESTIONS).map(([key, question]) => (
              <div key={key} className="border border-border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">{question}</h3>
                <p className="text-muted whitespace-pre-wrap">
                  {material.interviewData?.[key] || 'Not answered'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dim text-center py-8">No source material found</p>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Modal opens when isOpen is true
- [ ] Modal closes when close button clicked
- [ ] Shows loading state while fetching
- [ ] Displays brain dump content when available
- [ ] Displays interview Q&A when brain dump not available
- [ ] Shows "No source material found" as fallback
- [ ] Handles API errors gracefully
- [ ] Scrollable when content exceeds viewport

---

### Task 2.2: Add Source Material Button to AgentProfile

**Description:** Add icon button to AgentProfile header that opens SourceMaterialModal.
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.1 (can start structure, integrate after)

**File:** `frontend/src/components/AgentProfile.tsx`

**Changes to make:**

1. Add import:
```typescript
import { SourceMaterialModal } from './SourceMaterialModal'
```

2. Add state:
```typescript
const [showSourceMaterial, setShowSourceMaterial] = useState(false)
```

3. Add button in header section (after the title, before version dropdown):
```typescript
{/* In the header div, add this button */}
<div className="flex items-center gap-2">
  <button
    onClick={() => setShowSourceMaterial(true)}
    className="p-2 text-dim hover:text-muted transition-colors"
    title="View source material"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </button>
  {/* Existing version history dropdown */}
</div>
```

4. Add modal at end of component:
```typescript
{/* Source Material Modal */}
<SourceMaterialModal
  projectId={projectId}
  isOpen={showSourceMaterial}
  onClose={() => setShowSourceMaterial(false)}
/>
```

**Acceptance Criteria:**
- [ ] Icon button visible in profile header
- [ ] Clicking button opens SourceMaterialModal
- [ ] Modal closes when close button clicked
- [ ] Button has proper hover state and tooltip

---

## Phase 3: Add Profile Refinement

### Task 3.1: Add Refinement UI and Handler to AgentProfile

**Description:** Add inline refinement flow with textarea and regenerate functionality.
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** None

**File:** `frontend/src/components/AgentProfile.tsx`

**Technical Requirements:**
- Add refinement state variables
- Implement handleRefineProfile using existing synthesis API
- Add "Refine Profile" button and inline textarea
- Add "Start Over" link
- Update action buttons layout
- Handle errors gracefully (preserve user input)

**Changes to make:**

1. Update props interface:
```typescript
interface AgentProfileProps {
  projectId: string
  interviewData?: Record<string, string>  // Optional - for backward compat
  onContinueToTesting?: () => void        // Optional in standalone mode
  onEditInterview?: () => void            // Keep for backward compat
  onStartOver?: () => void                // New: return to creation choice
  onNavigateToTest?: () => void           // New: for standalone mode
}
```

2. Add state variables (after existing state):
```typescript
const [showRefinement, setShowRefinement] = useState(false)
const [refinementContext, setRefinementContext] = useState('')
const [refining, setRefining] = useState(false)
```

3. Add refinement handler:
```typescript
const handleRefineProfile = async () => {
  if (!refinementContext.trim()) return

  try {
    setRefining(true)
    setError('') // Clear previous errors

    const configResponse = await api.getAgentConfig(projectId)
    const config = configResponse.agentConfig as { rawBrainDump?: string }

    const response = await api.synthesizeAgentProfile(
      projectId,
      config.rawBrainDump || '',
      refinementContext
    )

    await api.saveAgentProfileV2(projectId, {
      profile: response.profile,
      rawInput: config.rawBrainDump || '',
      lightAreas: response.lightAreas,
      synthesisMode: response.synthesisMode
    })

    await loadProfile()
    await loadVersionHistory()
    setShowRefinement(false)
    setRefinementContext('')
    showNotification('Profile updated successfully')
  } catch (err) {
    // Show error but preserve user input
    setError(err instanceof Error ? err.message : 'Failed to refine profile. Please try again.')
    // DO NOT clear refinementContext - user can retry with same input
    // DO NOT close refinement panel - keep it open for retry
  } finally {
    setRefining(false)
  }
}
```

4. Replace action buttons section (at bottom of component):
```typescript
{/* Action Buttons Section */}
<div className="mt-8 space-y-4">
  {/* Refinement Section */}
  {showRefinement ? (
    <Card className="p-4">
      <h3 className="font-display text-foreground mb-2">Refine Your Profile</h3>
      <p className="text-sm text-muted mb-3">
        Add context to update your agent's behavior. This will regenerate the profile.
      </p>
      <Textarea
        value={refinementContext}
        onChange={(e) => setRefinementContext(e.target.value)}
        placeholder="e.g., Be more formal with executives. Emphasize sustainability initiatives..."
        rows={3}
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setShowRefinement(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleRefineProfile}
          disabled={!refinementContext.trim() || refining}
          isLoading={refining}
        >
          Regenerate Profile
        </Button>
      </div>
    </Card>
  ) : (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button onClick={() => setShowRefinement(true)}>
          Refine Profile
        </Button>
        {onStartOver && (
          <button
            onClick={onStartOver}
            className="text-sm text-dim hover:text-muted transition-colors"
          >
            Start Over
          </button>
        )}
      </div>
      <Button onClick={onNavigateToTest || onContinueToTesting}>
        Continue to Testing
      </Button>
    </div>
  )}
</div>
```

**Acceptance Criteria:**
- [ ] "Refine Profile" button visible when profile exists
- [ ] Clicking opens inline textarea
- [ ] Can enter refinement context
- [ ] "Regenerate Profile" calls API with additional context
- [ ] Profile reloads after successful refinement
- [ ] Success toast shows "Profile updated successfully"
- [ ] Error preserved user input (doesn't clear textarea)
- [ ] Cancel button closes refinement UI
- [ ] "Start Over" link visible and functional
- [ ] "Continue to Testing" navigates to test tab

---

## Phase 4: URL-Based Navigation

### Task 4.1: Implement URL-Based Tab Navigation

**Description:** Replace useState tab management with useSearchParams for URL-based navigation.
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** None

**File:** `frontend/src/pages/ProjectPage.tsx`

**Technical Requirements:**
- Import useSearchParams from react-router-dom
- Replace useState for activeTab with URL-based state
- Update tab click handlers to use setSearchParams
- Default to 'documents' tab when no param
- Update onComplete callbacks throughout

**Changes to make:**

1. Update imports:
```typescript
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
```

2. Replace tab state:
```typescript
// Remove:
// const [activeTab, setActiveTab] = useState<TabId>('documents')

// Add:
const [searchParams, setSearchParams] = useSearchParams()
const activeTab = (searchParams.get('tab') || 'documents') as TabId

const setActiveTab = (tab: TabId) => {
  setSearchParams({ tab })
}
```

3. Update TestingDojo callback:
```typescript
<TestingDojo
  projectId={projectId!}
  onNavigateAway={(dest) => {
    if (dest === 'recommendations' || dest === 'interview' || dest === 'profile') {
      setActiveTab('agent')
    }
  }}
/>
```

**Acceptance Criteria:**
- [ ] Tab clicks update URL with ?tab= parameter
- [ ] URL parameter controls active tab on page load
- [ ] Default to 'documents' tab when no parameter
- [ ] Browser back/forward navigates between tabs
- [ ] Deep links work (e.g., /projects/123?tab=agent)
- [ ] No breaking changes to existing functionality

---

## Phase 5: Simplify AgentInterview

### Task 5.1: Create AgentInterviewModal

**Description:** Create new modal-based interview component by extracting logic from AgentInterview.
**Size:** Large
**Priority:** Medium
**Dependencies:** Task 1.1
**Can run parallel with:** Tasks 6.1, 6.2

**File:** `frontend/src/components/AgentInterviewModal.tsx`

**Complete Implementation:**

```typescript
// frontend/src/components/AgentInterviewModal.tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Card, Button, Textarea } from './ui'

interface AgentInterviewModalProps {
  projectId: string
  onClose: () => void
  onComplete: () => void
}

const questions = [
  {
    id: 'audience',
    question: "Who is your primary audience?",
    placeholder: "e.g., Board members, Investors, Technical team members",
    description: "Who will be asking questions about these documents?",
  },
  {
    id: 'purpose',
    question: "What's the main purpose of these documents?",
    placeholder: "e.g., Quarterly strategic planning, Technical documentation",
    description: "What are these documents meant to accomplish?",
  },
  {
    id: 'tone',
    question: "What communication style should the AI use?",
    placeholder: "e.g., Professional but approachable, Formal and technical",
    description: "How should the AI communicate with your audience?",
  },
  {
    id: 'emphasis',
    question: "What should the AI emphasize?",
    placeholder: "e.g., Key metrics, risks, strategic recommendations",
    description: "What topics or areas are most important?",
  },
  {
    id: 'questions',
    question: "What proactive questions should the AI ask?",
    placeholder: "e.g., How does this align with your objectives?",
    description: "Questions to help guide the conversation (optional)",
  },
]

export function AgentInterviewModal({ projectId, onClose, onComplete }: AgentInterviewModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [interviewData, setInterviewData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadExisting() {
      try {
        const response = await api.getAgentConfig(projectId)
        const config = response.agentConfig as { interviewData?: Record<string, string> }
        if (config?.interviewData) {
          setInterviewData(config.interviewData)
        }
      } catch {
        // No existing data - start fresh
      }
    }
    loadExisting()
  }, [projectId])

  const currentQuestion = questions[currentStep]
  const isLastStep = currentStep === questions.length - 1
  const progress = ((currentStep + 1) / questions.length) * 100

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    setError('')

    try {
      const essentialAnswers = ['audience', 'purpose', 'tone', 'emphasis'].filter(
        (key) => interviewData[key]
      ).length
      const completionLevel = (essentialAnswers / 4) * 100
      const status = completionLevel >= 75 ? 'complete' : 'incomplete'

      await api.saveAgentConfig(projectId, interviewData, status, completionLevel)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">Configure Your AI Agent</h2>
          <button onClick={onClose} className="text-dim hover:text-muted transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-muted">
            <span>Question {currentStep + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background-elevated border border-border">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Question */}
        <Card className="p-6 mb-6">
          <h3 className="font-display text-xl text-foreground mb-2">{currentQuestion.question}</h3>
          <p className="text-muted mb-4">{currentQuestion.description}</p>
          <Textarea
            value={interviewData[currentQuestion.id] || ''}
            onChange={(e) => setInterviewData({ ...interviewData, [currentQuestion.id]: e.target.value })}
            placeholder={currentQuestion.placeholder}
            rows={4}
          />
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
            Back
          </Button>
          <div className="flex gap-2">
            {isLastStep ? (
              <Button onClick={handleComplete} disabled={saving} isLoading={saving}>
                {saving ? 'Saving...' : 'Complete'}
              </Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Modal renders with all 5 questions
- [ ] Progress bar updates as user navigates
- [ ] Back/Next navigation works
- [ ] Can enter answers for each question
- [ ] Loads existing interview data if resuming
- [ ] Complete button saves and calls onComplete
- [ ] Close button calls onClose
- [ ] Error handling shows error message
- [ ] No profile sub-tab or review view

---

## Phase 6: Polish

### Task 6.1: Add Unit Tests

**Description:** Add unit tests for new components.
**Size:** Medium
**Priority:** Medium
**Dependencies:** Tasks 1.1, 2.1, 5.1
**Can run parallel with:** Task 5.1, 6.2

**Files:**
- `frontend/src/components/__tests__/AgentPage.test.tsx`
- `frontend/src/components/__tests__/SourceMaterialModal.test.tsx`

**Test Implementation:**

```typescript
// frontend/src/components/__tests__/AgentPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { AgentPage } from '../AgentPage'
import { api } from '../../lib/api'

jest.mock('../../lib/api')
const mockApi = api as jest.Mocked<typeof api>

describe('AgentPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Purpose: Verify profile existence check determines correct view
  it('shows ProfileCreationChoice when no profile exists', async () => {
    mockApi.getAgentConfig.mockRejectedValue(new Error('not found'))
    render(<AgentPage projectId="123" onNavigateToTab={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/create.*agent.*profile/i)).toBeInTheDocument()
    })
  })

  // Purpose: Verify profile view is shown for existing profiles
  it('shows AgentProfile when profile exists', async () => {
    mockApi.getAgentConfig.mockResolvedValue({
      agentConfig: { status: 'complete' }
    })
    mockApi.getAgentProfile.mockResolvedValue({
      profile: { sections: {} }
    })
    render(<AgentPage projectId="123" onNavigateToTab={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/ai agent profile/i)).toBeInTheDocument()
    })
  })

  // Purpose: Verify loading state shows
  it('shows loading state while checking profile', () => {
    mockApi.getAgentConfig.mockImplementation(() => new Promise(() => {}))
    render(<AgentPage projectId="123" onNavigateToTab={jest.fn()} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

// frontend/src/components/__tests__/SourceMaterialModal.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { SourceMaterialModal } from '../SourceMaterialModal'
import { api } from '../../lib/api'

jest.mock('../../lib/api')
const mockApi = api as jest.Mocked<typeof api>

describe('SourceMaterialModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Purpose: Verify brain dump content displays correctly
  it('displays brain dump content when available', async () => {
    mockApi.getAgentConfig.mockResolvedValue({
      agentConfig: { rawBrainDump: 'Test brain dump content' }
    })
    render(<SourceMaterialModal projectId="123" isOpen={true} onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Test brain dump content')).toBeInTheDocument()
      expect(screen.getByText('Original Brain Dump')).toBeInTheDocument()
    })
  })

  // Purpose: Verify interview responses display with proper formatting
  it('displays interview Q&A when brain dump not available', async () => {
    mockApi.getAgentConfig.mockResolvedValue({
      agentConfig: {
        interviewData: { audience: 'Board members', tone: 'Professional' }
      }
    })
    render(<SourceMaterialModal projectId="123" isOpen={true} onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Board members')).toBeInTheDocument()
      expect(screen.getByText('Interview Responses')).toBeInTheDocument()
    })
  })

  // Purpose: Verify modal doesn't render when closed
  it('does not render when isOpen is false', () => {
    render(<SourceMaterialModal projectId="123" isOpen={false} onClose={jest.fn()} />)
    expect(screen.queryByText(/brain dump/i)).not.toBeInTheDocument()
  })
})
```

**Acceptance Criteria:**
- [ ] AgentPage tests pass
- [ ] SourceMaterialModal tests pass
- [ ] Tests cover happy paths and error states
- [ ] Tests are meaningful (can fail to reveal issues)

---

### Task 6.2: Update CLAUDE.md Documentation

**Description:** Add documentation for new Agent Tab architecture.
**Size:** Small
**Priority:** Low
**Dependencies:** All previous tasks
**Can run parallel with:** Task 6.1

**File:** `CLAUDE.md`

**Content to add (after "Braindump Agent Profile Synthesis" section):**

```markdown
## Agent Tab Architecture

**What:** Smart AgentPage wrapper that handles profile existence check and navigation flow.

**Key files:**
- `frontend/src/components/AgentPage.tsx` - Smart wrapper
- `frontend/src/components/SourceMaterialModal.tsx` - View raw input
- `frontend/src/components/AgentInterviewModal.tsx` - Interview as modal
- `frontend/src/components/AgentProfile.tsx` - Standalone profile view with refinement

**Profile Update Flow:**
- **Primary (recommended):** "Refine Profile" button - textarea for additional context, regenerates profile
- **Secondary:** "Start Over" link - returns to creation choice

**Tab Navigation:**
- Uses `useSearchParams` for URL-based tab state
- Pattern: `/projects/:id?tab=agent`
- Default: 'documents' tab
- Browser back/forward works correctly

**Critical Gotchas:**
- **Source Material**: Fetched from `rawBrainDump` or `interviewData` fields in AgentConfig
- **Profile Check**: Use `api.getAgentConfig()` to check `status === 'complete'`
- **Refinement Errors**: Preserve user input on error (don't clear textarea)
- **Interview Modal**: Calls `onComplete()` instead of showing profile sub-tab
```

**Acceptance Criteria:**
- [ ] Documentation added to CLAUDE.md
- [ ] Covers key files, flows, and gotchas
- [ ] Consistent with existing documentation style

---

## Execution Summary

| Phase | Tasks | Dependencies | Parallel Opportunities |
|-------|-------|--------------|----------------------|
| 1 | 1.1, 1.2 | None → 1.1 | Sequential |
| 2 | 2.1, 2.2 | None → 2.1 | 2.1 + 2.2 parallel |
| 3 | 3.1 | 2.2 | Sequential |
| 4 | 4.1 | 1.2 | Sequential |
| 5 | 5.1 | 1.1 | Can run with 6.x |
| 6 | 6.1, 6.2 | Various | 6.1 + 6.2 parallel |

**Critical Path:** 1.1 → 1.2 → 4.1 (URL routing)
**Parallel Track:** 2.1 + 2.2 → 3.1 (Source material + refinement)

**Total Estimated Completion:** 10 tasks across 6 phases
