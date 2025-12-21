# Profile Synthesis Progress Tracker

## Status
**Draft** | Ready for Implementation

## Authors
- Claude Code
- Date: 2025-12-15

## Overview

Implement a Domino's-style multi-stage progress tracker for AI agent profile generation. When users complete a braindump or trigger profile refinement, they see step-by-step visual progress with named stages, rotating context tips, and cancel support. This replaces the current basic spinner with a confidence-building experience that explains what's happening.

**Architecture Note:** This integrates with the Agent Tab Architecture (`AgentPage.tsx`) which handles profile existence checks and modal orchestration. The new `AgentPage` wrapper shows `ProfileCreationChoice` for new profiles and `AgentProfile` for existing ones. Related components include `SourceMaterialModal` (view raw input) and `AgentInterviewModal` (interview flow).

## Background/Problem Statement

Currently, when users submit a braindump or refine their profile:
- They see a basic spinner with "Analyzing your description..."
- No visibility into what the AI is doing
- No time estimate - users don't know if it's 5 seconds or 60 seconds
- No ability to cancel
- Uncertain waits feel longer (UX research shows progress indicators increase patience 3x)

The V1 interview flow already has streaming section-by-section progress in `AgentProfile.tsx`, but the V2 braindump flow and refinement flow have no progress indication.

## Goals

- Replace basic spinner with 4-stage visual progress tracker
- Show meaningful stage names that explain AI work
- Display rotating context tips during the "Generating" stage
- Provide time estimate ("This usually takes 30-60 seconds")
- Add cancel button with ESC keyboard support
- Auto-retry failed requests up to 2 times
- Create reusable component for all profile generation flows
- Follow 33 Strategies design system

## Non-Goals

- Changes to LLM synthesis logic (prompts, model selection)
- Changes to 12-field profile structure
- Mobile-specific optimizations (responsive design assumed)
- Persisting progress state across page refreshes
- Real-time token streaming preview (future enhancement)

## Technical Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `@microsoft/fetch-event-source` | ^2.0.1 | SSE client for streaming events |
| `framer-motion` | ^11.18.2 | Stage transition animations |
| `lucide-react` | ^0.469.0 | Icons (Sparkles, Loader2, CheckCircle2, Circle, X) |

All dependencies already installed in `frontend/package.json`.

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           ProfileSynthesisProgress                   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │   │
│  │  │StageIndicator│ │ContextTips │ │StreamingPreview│  │   │
│  │  └─────────────┘ └─────────────┘ └───────────────┘  │   │
│  │                                                      │   │
│  │  useSynthesisProgress (SSE hook)                    │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│                             │ SSE Events                    │
│                             ▼                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/projects/:id/profile/synthesize-stream
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        synthesizeBrainDumpStream Controller          │   │
│  │                                                      │   │
│  │  send('start') → delay → send('generating') →       │   │
│  │  synthesizeFromBrainDump() → send('complete')       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Backend: SSE Endpoint

**File:** `backend/src/controllers/agent.controller.ts`

**Route:** `POST /api/projects/:projectId/profile/synthesize-stream`

**Event Types:**
```typescript
type SynthesisProgressEvent =
  | { type: 'stage'; stage: 'start' | 'generating' | 'finalizing' }
  | { type: 'complete'; profile: BrainDumpSynthesisResult }
  | { type: 'error'; message: string; retryable: boolean }
```

**Implementation Pattern:**
```typescript
export async function synthesizeBrainDumpStream(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Authentication required' } })
  }

  const { projectId } = req.params
  const { rawInput, additionalContext } = req.body

  // Verify project ownership
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.ownerId !== req.user.userId) {
    return res.status(404).json({ error: { message: 'Project not found' } })
  }

  // Validate input
  if (!rawInput || rawInput.length < 50) {
    return res.status(400).json({
      error: { message: 'Brain dump must be at least 50 characters' }
    })
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const sendEvent = (data: SynthesisProgressEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    // Stage 1: Start
    sendEvent({ type: 'stage', stage: 'start' })

    // Brief delay to show processing UI (2 seconds)
    await new Promise(r => setTimeout(r, 2000))

    // Stage 2: Generating
    sendEvent({ type: 'stage', stage: 'generating' })

    // Actual LLM synthesis
    const result = await synthesizeFromBrainDump(rawInput, additionalContext)

    // Stage 3: Finalizing
    sendEvent({ type: 'stage', stage: 'finalizing' })
    await new Promise(r => setTimeout(r, 1000))

    // Complete
    sendEvent({ type: 'complete', profile: result })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synthesis failed'
    const retryable = !message.includes('invalid') && !message.includes('too short')
    sendEvent({ type: 'error', message, retryable })
  } finally {
    res.end()
  }
}
```

**Route Registration:**
```typescript
// backend/src/routes/agent.routes.ts
router.post(
  '/projects/:projectId/profile/synthesize-stream',
  authenticate,
  synthesizeBrainDumpStream // Note: NOT wrapped in asyncHandler (SSE pattern)
)
```

### Frontend: Component Structure

```
frontend/src/components/ProfileSynthesisProgress/
├── index.ts                       # Barrel export
├── ProfileSynthesisProgress.tsx   # Main container
├── StageIndicator.tsx             # Individual stage row
├── ContextTips.tsx                # Rotating tips
└── useSynthesisProgress.ts        # SSE hook
```

### Component: ProfileSynthesisProgress

**File:** `frontend/src/components/ProfileSynthesisProgress/ProfileSynthesisProgress.tsx`

```typescript
import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { StageIndicator } from './StageIndicator'
import { ContextTips } from './ContextTips'
import { useSynthesisProgress, SynthesisStage } from './useSynthesisProgress'
import { Button } from '../ui'

export interface ProfileSynthesisProgressProps {
  projectId: string
  rawInput: string
  additionalContext?: string
  onComplete: (profile: BrainDumpSynthesisResult) => void
  onError: (error: Error) => void
  onCancel?: () => void
}

const STAGES: { id: SynthesisStage; label: string; description: string }[] = [
  { id: 'processing', label: 'Processing', description: 'Reading your input...' },
  { id: 'analyzing', label: 'Analyzing', description: 'Extracting key insights...' },
  { id: 'generating', label: 'Generating', description: 'Creating your profile...' },
  { id: 'finalizing', label: 'Finalizing', description: 'Polishing details...' },
]

export function ProfileSynthesisProgress({
  projectId,
  rawInput,
  additionalContext,
  onComplete,
  onError,
  onCancel,
}: ProfileSynthesisProgressProps) {
  const {
    currentStage,
    error,
    isComplete,
    retryCount,
    cancel,
    start,
  } = useSynthesisProgress({
    projectId,
    rawInput,
    additionalContext,
    onComplete,
    onError,
    maxRetries: 2,
  })

  // Start synthesis on mount
  useEffect(() => {
    start()
  }, [start])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        cancel()
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancel, onCancel])

  const getStageStatus = (stageId: SynthesisStage) => {
    const stageOrder = ['processing', 'analyzing', 'generating', 'finalizing', 'complete']
    const currentIndex = stageOrder.indexOf(currentStage)
    const stageIndex = stageOrder.indexOf(stageId)

    if (stageIndex < currentIndex) return 'complete'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }

  // Check reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      className="w-full max-w-md mx-auto"
      role="status"
      aria-live="polite"
      aria-label="Profile generation progress"
    >
      {/* Header with time estimate */}
      <div className="text-center mb-8">
        <p className="text-sm text-dim">This usually takes 30-60 seconds</p>
        {retryCount > 0 && (
          <p className="text-xs text-muted mt-1">Retry attempt {retryCount}/2</p>
        )}
      </div>

      {/* Stage indicators */}
      <div className="space-y-4 mb-8">
        <AnimatePresence mode="sync">
          {STAGES.map((stage, index) => (
            <motion.div
              key={stage.id}
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <StageIndicator
                label={stage.label}
                description={stage.description}
                status={getStageStatus(stage.id)}
                showTips={stage.id === 'generating' && currentStage === 'generating'}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Context tips during generating stage */}
      {currentStage === 'generating' && <ContextTips />}

      {/* Cancel button */}
      {onCancel && !isComplete && (
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cancel()
              onCancel()
            }}
            className="text-dim hover:text-muted"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
            <span className="ml-2 text-xs opacity-50">(ESC)</span>
          </Button>
        </div>
      )}
    </div>
  )
}
```

### Component: StageIndicator

**File:** `frontend/src/components/ProfileSynthesisProgress/StageIndicator.tsx`

```typescript
import { motion } from 'framer-motion'
import { Sparkles, Loader2, CheckCircle2, Circle } from 'lucide-react'

interface StageIndicatorProps {
  label: string
  description: string
  status: 'pending' | 'active' | 'complete'
  showTips?: boolean
}

export function StageIndicator({ label, description, status }: StageIndicatorProps) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const getIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-success" />
      case 'active':
        return prefersReducedMotion ? (
          <Sparkles className="w-5 h-5 text-accent" />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-5 h-5 text-accent" />
          </motion.div>
        )
      default:
        return <Circle className="w-5 h-5 text-dim opacity-30" />
    }
  }

  return (
    <motion.div
      className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
        status === 'active'
          ? 'bg-accent/5 border border-accent/20'
          : status === 'complete'
            ? 'bg-success/5 border border-success/20'
            : 'bg-transparent border border-transparent'
      }`}
      animate={
        status === 'active' && !prefersReducedMotion
          ? { scale: [1, 1.02, 1] }
          : {}
      }
      transition={{ duration: 2, repeat: Infinity }}
    >
      {getIcon()}
      <div className="flex-1">
        <p
          className={`font-medium ${
            status === 'active'
              ? 'text-accent'
              : status === 'complete'
                ? 'text-success'
                : 'text-dim'
          }`}
        >
          {label}
        </p>
        <p
          className={`text-sm ${
            status === 'active' ? 'text-muted' : 'text-dim'
          }`}
        >
          {description}
        </p>
      </div>
    </motion.div>
  )
}
```

### Component: ContextTips

**File:** `frontend/src/components/ProfileSynthesisProgress/ContextTips.tsx`

```typescript
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TIPS = [
  'Analyzing communication style...',
  'Identifying domain expertise...',
  'Extracting key topics...',
  'Determining target audience...',
  'Crafting engagement approach...',
  'Defining content priorities...',
]

const TIP_INTERVAL = 8000 // 8 seconds

export function ContextTips() {
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TIPS.length)
    }, TIP_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center h-6" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.p
          key={currentTipIndex}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-muted italic"
        >
          {TIPS[currentTipIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
```

### Hook: useSynthesisProgress

**File:** `frontend/src/components/ProfileSynthesisProgress/useSynthesisProgress.ts`

```typescript
import { useState, useCallback, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { BrainDumpSynthesisResult } from '../../lib/api'

export type SynthesisStage =
  | 'idle'
  | 'processing'
  | 'analyzing'
  | 'generating'
  | 'finalizing'
  | 'complete'

interface UseSynthesisProgressOptions {
  projectId: string
  rawInput: string
  additionalContext?: string
  onComplete: (profile: BrainDumpSynthesisResult) => void
  onError: (error: Error) => void
  maxRetries?: number
}

interface UseSynthesisProgressReturn {
  currentStage: SynthesisStage
  error: Error | null
  isComplete: boolean
  retryCount: number
  cancel: () => void
  start: () => void
}

// Map backend stages to frontend stages
const STAGE_MAP: Record<string, SynthesisStage> = {
  start: 'processing',
  generating: 'generating',
  finalizing: 'finalizing',
}

export function useSynthesisProgress({
  projectId,
  rawInput,
  additionalContext,
  onComplete,
  onError,
  maxRetries = 2,
}: UseSynthesisProgressOptions): UseSynthesisProgressReturn {
  const [currentStage, setCurrentStage] = useState<SynthesisStage>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)
  const isStartedRef = useRef(false)

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const start = useCallback(async () => {
    // Prevent double-start
    if (isStartedRef.current) return
    isStartedRef.current = true

    const attemptSynthesis = async (attempt: number): Promise<void> => {
      setRetryCount(attempt)
      setCurrentStage('processing')
      setError(null)

      abortControllerRef.current = new AbortController()

      // Simulate "analyzing" stage after 3 seconds of "processing"
      const analyzeTimer = setTimeout(() => {
        setCurrentStage('analyzing')
      }, 3000)

      try {
        await fetchEventSource(
          `${import.meta.env.VITE_API_URL || ''}/api/projects/${projectId}/profile/synthesize-stream`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ rawInput, additionalContext }),
            signal: abortControllerRef.current.signal,

            onmessage(event) {
              clearTimeout(analyzeTimer)
              const data = JSON.parse(event.data)

              switch (data.type) {
                case 'stage':
                  setCurrentStage(STAGE_MAP[data.stage] || data.stage)
                  break

                case 'complete':
                  setCurrentStage('complete')
                  setIsComplete(true)
                  onComplete(data.profile)
                  break

                case 'error':
                  if (data.retryable && attempt < maxRetries) {
                    // Retry after brief delay
                    setTimeout(() => attemptSynthesis(attempt + 1), 2000)
                  } else {
                    const err = new Error(data.message)
                    setError(err)
                    onError(err)
                  }
                  break
              }
            },

            onerror(err) {
              clearTimeout(analyzeTimer)
              // Retry on network errors
              if (attempt < maxRetries) {
                setTimeout(() => attemptSynthesis(attempt + 1), 2000)
              } else {
                const error = new Error('Connection failed')
                setError(error)
                onError(error)
              }
              throw err // Stop the connection
            },

            onclose() {
              clearTimeout(analyzeTimer)
            },
          }
        )
      } catch (err) {
        clearTimeout(analyzeTimer)
        // Handle abort (cancel)
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        // Other errors handled in onerror
      }
    }

    await attemptSynthesis(0)
  }, [projectId, rawInput, additionalContext, onComplete, onError, maxRetries])

  return {
    currentStage,
    error,
    isComplete,
    retryCount,
    cancel,
    start,
  }
}
```

### Integration: AgentProfileBrainDumpModal

**File:** `frontend/src/components/AgentProfileBrainDumpModal.tsx`

Replace lines ~247-259 (the processing step):

```typescript
// Before (current)
{step === 'processing' && (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mb-4" />
    <p className="text-muted">Analyzing your description...</p>
  </div>
)}

// After (new)
{step === 'processing' && (
  <ProfileSynthesisProgress
    projectId={projectId}
    rawInput={rawInput}
    onComplete={(result) => {
      setSynthesisResult(result)
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

### Integration: AgentProfile Refinement

**File:** `frontend/src/components/AgentProfile.tsx`

**Note:** The current implementation uses a simple `refining` state with inline loading spinner. This integration *upgrades* to a modal overlay with the full progress tracker experience, matching the braindump flow UX.

Replace the refinement flow:

```typescript
// Add state for showing progress
const [showRefinementProgress, setShowRefinementProgress] = useState(false)

// Modify handleRefineProfile to show progress
const handleRefineProfile = () => {
  if (!refinementContext.trim()) return
  setShowRefinementProgress(true)
}

// In the render, replace the refining state handling:
{showRefinementProgress && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-card-bg border border-border rounded-lg p-8 max-w-lg">
      <ProfileSynthesisProgress
        projectId={projectId}
        rawInput={rawBrainDump || ''}
        additionalContext={refinementContext}
        onComplete={async (result) => {
          await api.saveAgentProfileV2(projectId, {
            profile: result.profile,
            rawInput: rawBrainDump || '',
            lightAreas: result.lightAreas,
            synthesisMode: result.synthesisMode,
          })
          await loadProfile()
          await loadVersionHistory()
          setShowRefinementProgress(false)
          setShowRefinement(false)
          setRefinementContext('')
          showNotification('Profile updated successfully')
        }}
        onError={(err) => {
          setError(err.message)
          setShowRefinementProgress(false)
        }}
        onCancel={() => {
          setShowRefinementProgress(false)
        }}
      />
    </div>
  </div>
)}
```

### API Client Addition

**File:** `frontend/src/lib/api.ts`

Add new event type and export (for type safety in components):

```typescript
// Add to existing exports
export type SynthesisProgressEvent =
  | { type: 'stage'; stage: 'start' | 'generating' | 'finalizing' }
  | { type: 'complete'; profile: BrainDumpSynthesisResult }
  | { type: 'error'; message: string; retryable: boolean }
```

## User Experience

### User Flow: BrainDump

1. User enters braindump text and clicks "Generate Profile"
2. Modal transitions to progress view showing:
   - Time estimate: "This usually takes 30-60 seconds"
   - 4 stages with current stage highlighted in gold
   - Active stage pulses gently
3. After ~3s "Processing" transitions to "Analyzing"
4. When backend sends `generating` event, transitions to "Generating"
5. Rotating tips appear below stages every 8 seconds
6. When backend sends `finalizing`, transitions to "Finalizing"
7. On complete, transitions to preview step
8. User can press ESC or click Cancel at any time to abort

### User Flow: Refinement

1. User clicks "Refine Profile" and enters additional context
2. Clicks "Regenerate Profile"
3. Overlay modal appears with same progress tracker
4. On complete, profile updates and success toast shows
5. Cancel returns to refinement input state

### Accessibility

- `role="status"` and `aria-live="polite"` on progress container
- Screen readers announce stage transitions
- ESC keyboard shortcut for cancel
- Respects `prefers-reduced-motion` - disables animations

## Testing Strategy

### Unit Tests

**Purpose comments required for each test**

```typescript
// ProfileSynthesisProgress.test.tsx

describe('ProfileSynthesisProgress', () => {
  /**
   * Purpose: Verify component renders all 4 stages on mount
   * Validates: Initial render state
   */
  it('renders all four stages in correct order', () => {
    render(<ProfileSynthesisProgress {...defaultProps} />)
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('Analyzing')).toBeInTheDocument()
    expect(screen.getByText('Generating')).toBeInTheDocument()
    expect(screen.getByText('Finalizing')).toBeInTheDocument()
  })

  /**
   * Purpose: Verify time estimate displays
   * Validates: User expectation setting
   */
  it('displays time estimate', () => {
    render(<ProfileSynthesisProgress {...defaultProps} />)
    expect(screen.getByText('This usually takes 30-60 seconds')).toBeInTheDocument()
  })

  /**
   * Purpose: Verify ESC key triggers cancel
   * Validates: Keyboard accessibility
   */
  it('calls onCancel when ESC is pressed', async () => {
    const onCancel = vi.fn()
    render(<ProfileSynthesisProgress {...defaultProps} onCancel={onCancel} />)

    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  /**
   * Purpose: Verify cancel button appears and works
   * Validates: User can abort generation
   */
  it('shows cancel button that calls onCancel', async () => {
    const onCancel = vi.fn()
    render(<ProfileSynthesisProgress {...defaultProps} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

```typescript
// useSynthesisProgress.test.ts

describe('useSynthesisProgress', () => {
  /**
   * Purpose: Verify hook starts in idle state
   * Validates: Clean initialization
   */
  it('initializes with idle stage', () => {
    const { result } = renderHook(() => useSynthesisProgress(defaultOptions))
    expect(result.current.currentStage).toBe('idle')
  })

  /**
   * Purpose: Verify stage transitions happen on SSE events
   * Validates: Core functionality - backend events update UI
   */
  it('transitions stages based on SSE events', async () => {
    // Mock fetchEventSource to emit events
    mockFetchEventSource([
      { type: 'stage', stage: 'start' },
      { type: 'stage', stage: 'generating' },
      { type: 'stage', stage: 'finalizing' },
      { type: 'complete', profile: mockProfile },
    ])

    const { result } = renderHook(() => useSynthesisProgress(defaultOptions))
    act(() => result.current.start())

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true)
    })
  })

  /**
   * Purpose: Verify auto-retry on retryable errors
   * Validates: Resilience to transient failures
   */
  it('retries up to maxRetries on retryable error', async () => {
    const attemptCounts: number[] = []
    mockFetchEventSource([
      { type: 'error', message: 'Timeout', retryable: true },
    ], () => attemptCounts.push(1))

    const { result } = renderHook(() =>
      useSynthesisProgress({ ...defaultOptions, maxRetries: 2 })
    )
    act(() => result.current.start())

    await waitFor(() => {
      expect(attemptCounts.length).toBe(3) // Initial + 2 retries
    })
  })

  /**
   * Purpose: Verify non-retryable errors fail immediately
   * Validates: Validation errors don't waste retries
   */
  it('does not retry non-retryable errors', async () => {
    mockFetchEventSource([
      { type: 'error', message: 'Input too short', retryable: false },
    ])

    const onError = vi.fn()
    const { result } = renderHook(() =>
      useSynthesisProgress({ ...defaultOptions, onError })
    )
    act(() => result.current.start())

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(result.current.retryCount).toBe(0)
    })
  })
})
```

```typescript
// ContextTips.test.tsx

describe('ContextTips', () => {
  /**
   * Purpose: Verify tips rotate on interval
   * Validates: User engagement during wait
   */
  it('rotates tips every 8 seconds', async () => {
    vi.useFakeTimers()
    render(<ContextTips />)

    const firstTip = screen.getByText(/Analyzing communication style/)
    expect(firstTip).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(8000))

    await waitFor(() => {
      expect(screen.getByText(/Identifying domain expertise/)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })
})
```

### Integration Tests

```typescript
// AgentProfileBrainDumpModal.integration.test.tsx

describe('BrainDump Modal with Progress', () => {
  /**
   * Purpose: Verify full flow from input to preview
   * Validates: End-to-end user journey
   */
  it('shows progress tracker during synthesis and transitions to preview', async () => {
    mockApiStream([
      { type: 'stage', stage: 'start' },
      { type: 'stage', stage: 'generating' },
      { type: 'complete', profile: mockProfile },
    ])

    render(<AgentProfileBrainDumpModal {...props} />)

    // Enter braindump
    await userEvent.type(screen.getByRole('textbox'), 'My AI assistant...')
    await userEvent.click(screen.getByText('Generate Profile'))

    // Should show progress
    expect(screen.getByText('This usually takes 30-60 seconds')).toBeInTheDocument()

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Preview your profile')).toBeInTheDocument()
    })
  })
})
```

### E2E Tests (Playwright)

```typescript
// profile-synthesis-progress.spec.ts

test.describe('Profile Synthesis Progress', () => {
  /**
   * Purpose: Verify real SSE connection works end-to-end
   * Validates: Full stack integration
   */
  test('shows progress stages during braindump synthesis', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('text=Agent')
    await page.click('text=Brain Dump')

    await page.fill('textarea', 'This is my AI assistant for board presentations...')
    await page.click('text=Generate Profile')

    // Should see progress stages
    await expect(page.locator('text=Processing')).toBeVisible()
    await expect(page.locator('text=This usually takes')).toBeVisible()

    // Eventually completes
    await expect(page.locator('text=Preview')).toBeVisible({ timeout: 90000 })
  })

  /**
   * Purpose: Verify cancel aborts generation
   * Validates: User can exit gracefully
   */
  test('cancel button returns to input', async ({ page }) => {
    // Start synthesis
    await page.fill('textarea', 'Test input...')
    await page.click('text=Generate Profile')

    // Cancel
    await page.keyboard.press('Escape')

    // Should return to input
    await expect(page.locator('textarea')).toBeVisible()
  })
})
```

## Performance Considerations

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| SSE connection | Keeps HTTP connection open | 60s timeout, proper cleanup |
| Animation frames | Continuous during active | Respect `prefers-reduced-motion` |
| Re-renders | Stage transitions cause re-render | Use `memo` on StageIndicator |
| Bundle size | New component ~5KB | Tree-shaking, code-split modal |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| SSE without auth | Bearer token in Authorization header |
| CSRF on POST | Token-based auth, not cookies |
| XSS in error messages | Error messages sanitized, not rendered as HTML |
| DOS via retries | Max 2 retries, server-side rate limiting |

## Documentation

**Updates needed:**

1. **CLAUDE.md** - Add section documenting progress tracker pattern:
```markdown
## Profile Synthesis Progress Tracker

**What:** Domino's-style progress UI for profile generation with SSE streaming.

**Key files:**
- `frontend/src/components/ProfileSynthesisProgress/` - Reusable progress component
- `backend/src/controllers/agent.controller.ts` - `synthesizeBrainDumpStream` endpoint

**Integration pattern:**
\`\`\`tsx
<ProfileSynthesisProgress
  projectId={projectId}
  rawInput={braindumpText}
  onComplete={(profile) => handleProfile(profile)}
  onError={(err) => setError(err.message)}
  onCancel={() => resetState()}
/>
\`\`\`
```

## Implementation Phases

### Phase 1: Core Components
- Create `ProfileSynthesisProgress/` directory structure
- Implement `useSynthesisProgress` hook
- Implement `StageIndicator` component
- Implement `ContextTips` component
- Implement main `ProfileSynthesisProgress` component

### Phase 2: Backend Endpoint
- Add `synthesizeBrainDumpStream` controller
- Add route in `agent.routes.ts`
- Add type exports to `api.ts`

### Phase 3: Integration
- Integrate into `AgentProfileBrainDumpModal`
- Integrate into `AgentProfile` refinement flow
- Add unit and integration tests

### Phase 4: Polish
- Add E2E tests
- Update CLAUDE.md documentation
- Verify accessibility compliance
- Test reduced motion preference

## Open Questions

*None - all decisions made during ideation*

## References

- **Ideation document:** `docs/ideation/dominos-style-profile-progress-tracker.md`
- **Agent Tab Architecture:** See CLAUDE.md "Agent Tab Architecture" section
- **Related components:** `AgentPage.tsx`, `SourceMaterialModal.tsx`, `AgentInterviewModal.tsx`
- **Existing SSE pattern:** `specs/archive/feat-sequential-profile-generation-tasks.md`
- **fetch-event-source docs:** https://github.com/Azure/fetch-event-source
- **Framer Motion docs:** https://www.framer.com/motion/
