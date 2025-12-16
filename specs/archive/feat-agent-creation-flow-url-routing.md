# Fix AI Agent Creation Flow and URL-Based Tab Routing

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-15
**Related:** `docs/ideation/fix-agent-creation-flow-and-routing.md`, `specs/feat-braindump-agent-profile-synthesis-frontend.md`

---

## Overview

Fix three bugs in the AI agent creation flow and implement URL-based tab navigation using query parameters. This improves user experience by providing proper feedback after profile creation, removing architectural coupling between interview and profile views, and enabling deep linking/browser history for tabs.

---

## Background/Problem Statement

### Current Issues

**Bug 1: Blank Profile Page**
After creating a profile via brain dump, returning to the AI Agent tab shows a blank/loading state. Root cause: The profile view is nested inside `AgentInterview.tsx` with the wrong default sub-tab (`reviewTab = 'responses'` instead of `'profile'`).

**Bug 2: No Redirect After Brain Dump**
After saving a brain dump profile, users return to the choice screen instead of seeing their profile with success feedback. Root cause: `onSaved()` callback in `ProjectPage.tsx:182-184` sets `profileCreationMode('choice')` instead of navigating to profile view.

**Bug 3: Interview Tab Always Visible**
The Interview Responses sub-tab persists even after profile creation. Root cause: `AgentInterview.tsx` couples interview questionnaire AND profile review in the same component with sub-tabs.

**Enhancement: Tab Navigation**
Current tab navigation uses `useState` which breaks browser history and deep linking. Users cannot bookmark specific tabs or use back/forward navigation.

---

## Goals

- Fix brain dump redirect to show profile immediately with success toast
- Make `AgentProfile` the primary view when a profile exists (no nested sub-tabs)
- Add source material modal (icon button) to view raw brain dump or interview responses
- Add "Refine Profile" flow as primary update method
- Add "Start Over" option as secondary re-creation path
- Implement URL-based tab navigation with query parameters
- Support browser back/forward navigation between tabs
- Maintain backward compatibility with existing URLs

---

## Non-Goals

- Redesigning the profile display/editing UI
- Changes to Testing Dojo or Share Link Manager components
- Mobile-specific optimizations
- Adding new profile fields or synthesis improvements
- Backend API changes (all needed endpoints exist)

---

## Technical Dependencies

### External Libraries
- `react-router-dom` v6 - Already installed, using `useSearchParams` hook
- Existing UI components from `./ui` (Button, Card, Textarea, etc.)

### Internal Dependencies
- `api.synthesizeAgentProfile()` - For profile refinement with additional context
- `api.getAgentConfig()` - For checking profile existence
- `api.saveAgentProfileV2()` - For persisting refined profiles
- Database fields: `AgentConfig.rawBrainDump`, `AgentConfig.interviewData`

---

## Detailed Design

### Architecture Changes

```
BEFORE:
ProjectPage
├── tabs (useState)
└── agent tab
    └── profileCreationMode state machine
        ├── choice → ProfileCreationChoice
        ├── braindump → AgentProfileBrainDumpModal
        └── interview → AgentInterview
                          └── reviewTab sub-tabs
                              ├── responses
                              └── profile → AgentProfile (nested!)

AFTER:
ProjectPage
├── tabs (useSearchParams)
└── agent tab → AgentPage (new)
    ├── hasProfile: false → ProfileCreationChoice
    │                         └── Opens: BrainDumpModal or starts Interview
    └── hasProfile: true → AgentProfile (standalone)
                             ├── Source Material button → SourceMaterialModal (new)
                             ├── Refine Profile → inline refinement textarea
                             └── Start Over → returns to ProfileCreationChoice
```

### New Components

#### 1. `AgentPage.tsx` - Smart Wrapper

```typescript
// frontend/src/components/AgentPage.tsx
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
    } catch {
      setHasProfile(false)
      setShowCreationChoice(true)
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
    return <LoadingSkeleton />
  }

  return (
    <>
      {notification && <Toast message={notification} />}

      {showCreationChoice && !hasProfile && (
        <ProfileCreationChoice
          onSelectBrainDump={() => setShowBrainDumpModal(true)}
          onSelectInterview={() => setShowInterviewModal(true)}
        />
      )}

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

      {showInterviewModal && (
        <AgentInterviewModal
          projectId={projectId}
          onClose={() => setShowInterviewModal(false)}
          onComplete={handleProfileCreated}
        />
      )}

      {hasProfile && !showCreationChoice && (
        <AgentProfileStandalone
          projectId={projectId}
          onNavigateToTest={() => onNavigateToTab('test')}
          onStartOver={handleStartOver}
        />
      )}
    </>
  )
}
```

#### 2. `SourceMaterialModal.tsx` - View Raw Input

```typescript
// frontend/src/components/SourceMaterialModal.tsx
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

  useEffect(() => {
    if (isOpen) loadSourceMaterial()
  }, [isOpen, projectId])

  const loadSourceMaterial = async () => {
    try {
      setLoading(true)
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
      }
    } catch (err) {
      console.error('Failed to load source material:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg border border-border p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">
            {material?.type === 'braindump' ? 'Original Brain Dump' : 'Interview Responses'}
          </h2>
          <button onClick={onClose} className="text-dim hover:text-muted transition-colors">
            <XIcon />
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
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
          <p className="text-dim">No source material found</p>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
```

### Modified Components

#### 1. `ProjectPage.tsx` - URL-Based Tabs

```typescript
// Key changes to frontend/src/pages/ProjectPage.tsx

import { useParams, useNavigate, useSearchParams } from 'react-router-dom'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Replace useState with URL-based tab state
  const activeTab = (searchParams.get('tab') || 'documents') as TabId

  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab })
  }

  // Remove profileCreationMode state - moved to AgentPage

  return (
    // ... header unchanged ...

    {/* Tabs - update click handlers */}
    <nav className="flex space-x-8" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          // ... rest unchanged
        >
          {tab.label}
        </button>
      ))}
    </nav>

    {/* Agent tab - simplified */}
    <div role="tabpanel" hidden={activeTab !== 'agent'}>
      {activeTab === 'agent' && (
        <AgentPage
          projectId={projectId!}
          onNavigateToTab={setActiveTab}
        />
      )}
    </div>

    // ... other tabs unchanged, but update their onComplete callbacks ...

    {/* Test tab */}
    <div role="tabpanel" hidden={activeTab !== 'test'}>
      {activeTab === 'test' && (
        <TestingDojo
          projectId={projectId!}
          onNavigateAway={(dest) => {
            if (dest === 'profile' || dest === 'interview') {
              setActiveTab('agent')
            }
          }}
        />
      )}
    </div>
  )
}
```

#### 2. `AgentProfile.tsx` - Standalone with Refinement

Add to existing `AgentProfile.tsx`:

```typescript
// New props for standalone mode
interface AgentProfileProps {
  projectId: string
  interviewData?: Record<string, string>  // Optional - for backward compat
  onContinueToTesting?: () => void        // Optional in standalone mode
  onEditInterview?: () => void            // Replaced by onStartOver
  onStartOver?: () => void                // New: return to creation choice
  onNavigateToTest?: () => void           // New: for standalone mode
}

// Add state for refinement and source material
const [showSourceMaterial, setShowSourceMaterial] = useState(false)
const [showRefinement, setShowRefinement] = useState(false)
const [refinementContext, setRefinementContext] = useState('')
const [refining, setRefining] = useState(false)

// Add refinement handler
const handleRefineProfile = async () => {
  if (!refinementContext.trim()) return

  try {
    setRefining(true)
    // Get current raw input and append additional context
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

    // Reload profile
    await loadProfile()
    setShowRefinement(false)
    setRefinementContext('')
    showNotification('Profile updated successfully')
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to refine profile')
  } finally {
    setRefining(false)
  }
}

// In header section, add source material button:
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
  {/* Version history dropdown - existing */}
</div>

// Replace action buttons section:
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
        <button
          onClick={onStartOver}
          className="text-sm text-dim hover:text-muted transition-colors"
        >
          Start Over
        </button>
      </div>
      <Button onClick={onNavigateToTest || onContinueToTesting}>
        Continue to Testing
      </Button>
    </div>
  )}
</div>

{/* Source Material Modal */}
<SourceMaterialModal
  projectId={projectId}
  isOpen={showSourceMaterial}
  onClose={() => setShowSourceMaterial(false)}
/>
```

#### 3. `AgentInterview.tsx` - Simplify to Interview-Only Modal

Convert the existing component to a modal by removing the profile sub-tab and review view:

```typescript
// frontend/src/components/AgentInterviewModal.tsx
// Refactored from AgentInterview.tsx - removes profile sub-tab entirely

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

  // Load existing interview data if resuming
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
      onComplete() // Signal to AgentPage that profile was created
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header with close button */}
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

**Key changes from original `AgentInterview.tsx`:**
- Removed `view` state ('interview' | 'review') - no more review view
- Removed `reviewTab` state ('responses' | 'profile') - no more sub-tabs
- Removed embedded `AgentProfile` component - profile is now standalone in `AgentPage`
- Added modal wrapper with backdrop and close button
- On completion, calls `onComplete()` to signal `AgentPage` instead of showing review

### Data Flow

```
Profile Creation (Brain Dump):
1. User clicks "AI Agent" tab → URL: /projects/123?tab=agent
2. AgentPage checks api.getAgentConfig() → no profile
3. Shows ProfileCreationChoice
4. User selects "Describe in Your Own Words"
5. Opens AgentProfileBrainDumpModal
6. User completes brain dump → api.saveAgentProfileV2()
7. onSaved() callback → AgentPage.handleProfileCreated()
8. Toast: "Profile created successfully"
9. AgentPage sets hasProfile=true, shows AgentProfile

Profile Refinement:
1. User clicks "Refine Profile" on AgentProfile
2. Shows inline textarea
3. User enters additional context
4. Clicks "Regenerate Profile"
5. Calls api.synthesizeAgentProfile() with additionalContext
6. Calls api.saveAgentProfileV2() with new profile
7. Reloads profile, shows success toast

Tab Navigation:
1. User clicks "Test" tab → setSearchParams({ tab: 'test' })
2. URL updates to /projects/123?tab=test
3. Browser history entry created
4. User clicks Back → URL reverts to previous tab
5. useSearchParams re-renders with correct activeTab
```

### URL Structure

```
/projects/123              → Default: documents tab
/projects/123?tab=documents
/projects/123?tab=agent    → Shows AgentPage (profile or creation choice)
/projects/123?tab=test     → Testing Dojo
/projects/123?tab=share    → Share Link Manager
/projects/123?tab=analytics
```

### Error Handling

#### Profile Refinement Failures

When `handleRefineProfile` encounters errors:

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

**Error scenarios and handling:**

| Scenario | User Experience | Technical Handling |
|----------|----------------|-------------------|
| Network failure during synthesis | Error toast, input preserved, can retry | Catch in try/catch, show error state |
| API timeout (>60s) | "Request timed out" message, can retry | AbortController timeout in API |
| Invalid profile response | "Failed to process response" message | Validate response shape before save |
| Save failure after synthesis | "Profile generated but save failed" | Separate try/catch for save step |

#### Source Material Loading Failures

```typescript
const loadSourceMaterial = async () => {
  try {
    setLoading(true)
    setError('')
    const response = await api.getAgentConfig(projectId)
    // ... process response
  } catch (err) {
    // Show graceful fallback instead of crashing
    setMaterial(null)
    setError('Unable to load source material')
  } finally {
    setLoading(false)
  }
}
```

#### Profile Existence Check Failures

In `AgentPage.checkProfileExists()`:

```typescript
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
    // Optionally log for debugging
    console.warn('Failed to check profile existence:', err)
  } finally {
    setLoading(false)
  }
}
```

---

## User Experience

### Happy Path: New Profile Creation

1. User navigates to project → lands on Documents tab
2. Clicks "AI Agent" tab → sees ProfileCreationChoice
3. Selects "Describe in Your Own Words"
4. Brain dump modal opens
5. User describes their agent → clicks "Generate Profile"
6. Preview shows → user clicks "Save Profile"
7. Modal closes, toast appears: "Profile created successfully"
8. AgentProfile displays immediately
9. User can view source material via icon button
10. User can refine with prompt or continue to testing

### Profile Refinement

1. User views existing AgentProfile
2. Clicks "Refine Profile"
3. Textarea appears inline
4. User enters: "Be more formal with executives"
5. Clicks "Regenerate Profile"
6. Loading state while synthesizing
7. Profile updates, toast: "Profile updated successfully"

### Start Over

1. User views existing AgentProfile
2. Clicks "Start Over" link
3. Confirmation (optional): "This will let you create a new profile"
4. Returns to ProfileCreationChoice
5. Can select brain dump or interview

### Tab Navigation

1. User on Agent tab → clicks "Test"
2. URL updates, test page loads
3. User clicks browser Back
4. Returns to Agent tab with profile intact

---

## Testing Strategy

### Unit Tests

```typescript
// AgentPage.test.tsx
describe('AgentPage', () => {
  // Purpose: Verify profile existence check determines correct view
  it('shows ProfileCreationChoice when no profile exists', async () => {
    mockApi.getAgentConfig.mockRejectedValue(new Error('not found'))
    render(<AgentPage projectId="123" onNavigateToTab={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Create Your AI Agent Profile')).toBeInTheDocument()
    })
  })

  // Purpose: Verify profile view is shown for existing profiles
  it('shows AgentProfile when profile exists', async () => {
    mockApi.getAgentConfig.mockResolvedValue({
      agentConfig: { status: 'complete' }
    })
    render(<AgentPage projectId="123" onNavigateToTab={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('AI Agent Profile')).toBeInTheDocument()
    })
  })

  // Purpose: Verify success flow after profile creation
  it('shows toast and profile after brain dump save', async () => {
    // Start with no profile
    mockApi.getAgentConfig.mockRejectedValueOnce(new Error('not found'))
    const { rerender } = render(<AgentPage projectId="123" onNavigateToTab={jest.fn()} />)

    // Simulate brain dump completion
    // ... trigger onSaved callback

    // Verify toast and profile display
    expect(screen.getByText('Profile created successfully')).toBeInTheDocument()
  })
})

// SourceMaterialModal.test.tsx
describe('SourceMaterialModal', () => {
  // Purpose: Verify brain dump content displays correctly
  it('displays brain dump content when available', async () => {
    mockApi.getAgentConfig.mockResolvedValue({
      agentConfig: { rawBrainDump: 'Test brain dump content' }
    })
    render(<SourceMaterialModal projectId="123" isOpen={true} onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Test brain dump content')).toBeInTheDocument()
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
    })
  })
})
```

### Integration Tests

```typescript
// ProjectPage.integration.test.tsx
describe('ProjectPage URL Navigation', () => {
  // Purpose: Verify URL params control active tab
  it('renders correct tab based on URL query param', () => {
    renderWithRouter(<ProjectPage />, { route: '/projects/123?tab=agent' })
    expect(screen.getByRole('tabpanel', { hidden: false })).toContainElement(
      screen.getByText(/AI Agent/i)
    )
  })

  // Purpose: Verify tab clicks update URL
  it('updates URL when tab is clicked', async () => {
    const { history } = renderWithRouter(<ProjectPage />, { route: '/projects/123' })

    fireEvent.click(screen.getByRole('tab', { name: /test/i }))

    expect(history.location.search).toBe('?tab=test')
  })

  // Purpose: Verify browser back works with tabs
  it('navigates back to previous tab on history back', async () => {
    const { history } = renderWithRouter(<ProjectPage />, { route: '/projects/123?tab=agent' })

    fireEvent.click(screen.getByRole('tab', { name: /test/i }))
    expect(history.location.search).toBe('?tab=test')

    history.back()
    await waitFor(() => {
      expect(history.location.search).toBe('?tab=agent')
    })
  })
})
```

### E2E Tests

```typescript
// e2e/agent-profile-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Agent Profile Creation Flow', () => {
  // Purpose: Full happy path for brain dump profile creation
  test('creates profile via brain dump and shows success', async ({ page }) => {
    // Login and navigate to project
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Navigate to AI Agent tab
    await page.goto('/projects/test-project?tab=agent')

    // Select brain dump
    await page.click('text=Describe in Your Own Words')

    // Enter brain dump
    await page.fill('textarea', 'This AI represents our investor relations team. It should be professional but approachable.')

    // Generate profile
    await page.click('button:has-text("Generate Profile")')
    await expect(page.locator('text=Analyzing')).toBeVisible()

    // Wait for preview
    await expect(page.locator('text=Review')).toBeVisible({ timeout: 60000 })

    // Save profile
    await page.click('button:has-text("Save Profile")')

    // Verify success toast and profile view
    await expect(page.locator('text=Profile created successfully')).toBeVisible()
    await expect(page.locator('text=AI Agent Profile')).toBeVisible()

    // Verify URL didn't change
    expect(page.url()).toContain('?tab=agent')
  })

  // Purpose: Verify profile refinement flow
  test('refines existing profile with additional context', async ({ page }) => {
    // Navigate to project with existing profile
    await page.goto('/projects/test-project?tab=agent')

    // Click refine
    await page.click('button:has-text("Refine Profile")')

    // Enter refinement
    await page.fill('textarea', 'Be more formal with executives')
    await page.click('button:has-text("Regenerate Profile")')

    // Wait for update
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 60000 })
  })

  // Purpose: Verify source material modal works
  test('opens source material modal', async ({ page }) => {
    await page.goto('/projects/test-project?tab=agent')

    // Click source material icon
    await page.click('[title="View source material"]')

    // Verify modal content
    await expect(page.locator('text=Original Brain Dump')).toBeVisible()
  })
})

test.describe('Tab URL Navigation', () => {
  // Purpose: Verify deep linking to specific tabs
  test('navigates directly to tab via URL', async ({ page }) => {
    await page.goto('/projects/test-project?tab=test')
    await expect(page.locator('text=Testing Dojo')).toBeVisible()
  })

  // Purpose: Verify browser history works with tabs
  test('browser back navigates between tabs', async ({ page }) => {
    await page.goto('/projects/test-project?tab=documents')

    await page.click('text=AI Agent')
    await expect(page).toHaveURL(/tab=agent/)

    await page.goBack()
    await expect(page).toHaveURL(/tab=documents/)
  })

  // Purpose: Verify default tab for URLs without param
  test('defaults to documents tab without param', async ({ page }) => {
    await page.goto('/projects/test-project')
    await expect(page.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true')
  })
})
```

---

## Performance Considerations

- **Tab switching:** No additional API calls when switching tabs (components maintain state)
- **Profile check:** Single API call on AgentPage mount to check existence
- **Source material:** Lazy loaded only when modal opens
- **URL updates:** `setSearchParams` is synchronous and doesn't cause re-renders beyond the tab change

---

## Security Considerations

- No new API endpoints or authentication changes
- Source material only accessible to authenticated project owners
- URL params sanitized through TypeScript types

---

## Documentation

### CLAUDE.md Updates

Add to existing "Braindump Agent Profile Synthesis" section:

```markdown
## Agent Tab Architecture

**What:** Smart AgentPage wrapper that handles profile existence check and navigation flow.

**Key files:**
- `frontend/src/components/AgentPage.tsx` - Smart wrapper
- `frontend/src/components/SourceMaterialModal.tsx` - View raw input
- `frontend/src/components/AgentProfile.tsx` - Standalone profile view

**Profile Update Flow:**
- **Primary (recommended):** "Refine Profile" button - textarea for additional context
- **Secondary:** "Start Over" link - returns to creation choice

**Tab Navigation:**
- Uses `useSearchParams` for URL-based tab state
- Pattern: `/projects/:id?tab=agent`
- Default: 'documents' tab

**Critical Gotchas:**
- **Source Material**: Fetched from `rawBrainDump` or `interviewData` fields in AgentConfig
- **Profile Check**: Use `api.getAgentConfig()` to check `status === 'complete'`
```

---

## Implementation Phases

### Phase 1: Fix Critical Bugs

**Files:** `ProjectPage.tsx`, `AgentPage.tsx` (new)

1. Create `AgentPage.tsx` wrapper component
2. Move profile existence check logic from ProjectPage to AgentPage
3. Fix `onSaved` callback to show profile instead of choice
4. Add success toast notification

**Validation:** After brain dump save, user sees toast and profile immediately

### Phase 2: Add Source Material Modal

**Files:** `SourceMaterialModal.tsx` (new), `AgentProfile.tsx`

1. Create `SourceMaterialModal.tsx` component
2. Add icon button to `AgentProfile.tsx` header
3. Fetch source material from API on modal open
4. Display brain dump or interview Q&A based on data

**Validation:** Icon button opens modal showing source content

### Phase 3: Add Profile Refinement

**Files:** `AgentProfile.tsx`, `api.ts`

1. Add refinement state and UI to `AgentProfile.tsx`
2. Implement `handleRefineProfile` using existing synthesis API
3. Add "Start Over" link with navigation back to choice
4. Update action buttons layout

**Validation:** Refine flow updates profile, Start Over returns to choice

### Phase 4: URL-Based Navigation

**Files:** `ProjectPage.tsx`

1. Replace `useState` with `useSearchParams` for activeTab
2. Update tab click handlers to use `setSearchParams`
3. Update all `onComplete` callbacks to use URL navigation
4. Test browser back/forward functionality

**Validation:** Tab changes update URL, back button works

### Phase 5: Simplify AgentInterview

**Files:** `AgentInterview.tsx` → `AgentInterviewModal.tsx` (refactor)

1. Create new `AgentInterviewModal.tsx` based on interview logic from `AgentInterview.tsx`
2. Remove from original file:
   - `view` state ('interview' | 'review')
   - `reviewTab` state ('responses' | 'profile')
   - Embedded `AgentProfile` component
   - Review view JSX (entire `if (view === 'review')` block)
3. Add modal wrapper with backdrop and close button
4. Change completion flow: `onComplete()` callback instead of showing review
5. Keep original `AgentInterview.tsx` as deprecated alias or remove entirely
6. Update imports in `AgentPage.tsx` to use new modal

**Key code reference:** See "AgentInterview.tsx - Simplify to Interview-Only Modal" section above for full implementation.

**Validation:** Interview works as modal, closes on completion, no profile sub-tab visible

### Phase 6: Polish

**Files:** Various

1. Add proper loading skeletons
2. Ensure consistent error handling
3. Test all edge cases
4. Verify no regressions in existing functionality

**Validation:** E2E tests pass, manual testing complete

---

## Open Questions

None - all clarifications resolved during ideation.

---

## References

- Ideation Document: `docs/ideation/fix-agent-creation-flow-and-routing.md`
- Brain Dump Spec: `specs/feat-braindump-agent-profile-synthesis-frontend.md`
- React Router `useSearchParams`: https://reactrouter.com/en/main/hooks/use-search-params
- Existing patterns: `frontend/src/components/AudienceProfileAIModal.tsx` (modal pattern)
