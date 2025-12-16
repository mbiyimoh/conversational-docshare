# Stories-Style Onboarding Flow

**Status:** Draft
**Authors:** Claude Code
**Date:** 2025-12-13
**Related:** [Ideation Doc](../docs/ideation/stories-onboarding-flow.md)

---

## Overview

Create an Instagram Stories-style onboarding experience for new users immediately after signup. The flow uses a fullscreen overlay with 4 slides that communicate the product's core mental model through tap-to-navigate interactions, animated transitions, and the 33 Strategies premium dark theme.

---

## Background/Problem Statement

New users arriving at the dashboard after registration have no context for what the product does or how to use it. The mental model is non-obvious: creators upload documents, configure an AI agent via interview, share links, and viewers then chat with the AI instead of reading documents directly.

Without proper orientation:
- Users may not understand the unique value proposition
- First-time activation rates suffer
- Support burden increases with "how do I start?" questions

An Instagram Stories-style onboarding leverages a familiar, mobile-first interaction pattern that communicates benefits quickly (<60 seconds) without friction.

---

## Goals

- Orient new users on the product mental model in under 60 seconds
- Achieve high completion rate (>80%) through familiar tap-to-advance pattern
- Maintain 33 Strategies premium design aesthetic
- Provide accessible experience (keyboard nav, reduced motion, screen readers)
- Enable re-access via "Take Tour" help menu for users who skipped
- Work seamlessly on desktop and mobile

---

## Non-Goals

- Interactive product tour with UI element tooltips (separate feature)
- Viewer/recipient onboarding flow (different audience)
- Video or audio content in slides
- Account setup wizard (collecting additional profile info)
- A/B testing infrastructure for slide variants
- Backend persistence of onboarding state (localStorage sufficient for MVP)

---

## Technical Dependencies

| Dependency | Version | Usage |
|------------|---------|-------|
| React | ^18.x | Component framework |
| Framer Motion | ^10.x | Animations and gesture handling |
| react-router-dom | ^6.x | Navigation (implicit) |
| Tailwind CSS | ^3.x | Styling |
| localStorage | Native | State persistence |

All dependencies are already installed in the project.

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DashboardPage.tsx                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  {!isOnboardingComplete && <StoriesOnboarding />}         │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │               StoriesOnboarding.tsx                 │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │            ProgressBars.tsx                   │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │           OnboardingSlide.tsx                 │  │  │  │
│  │  │  │  • SVG Icon                                   │  │  │  │
│  │  │  │  • Title (Instrument Serif)                   │  │  │  │
│  │  │  │  • Subtitle (DM Sans)                         │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │  Skip Button / Get Started CTA                │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        Dashboard Content                         │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
frontend/src/
├── components/
│   └── onboarding/
│       ├── StoriesOnboarding.tsx      # Main container with tap/keyboard nav
│       ├── OnboardingSlide.tsx        # Individual slide with animations
│       ├── ProgressBars.tsx           # Segmented progress indicator
│       ├── onboardingContent.ts       # Slide data (title, subtitle, icon)
│       ├── onboardingIcons.tsx        # Custom SVG icon components
│       └── useOnboardingState.ts      # localStorage persistence hook
├── pages/
│   └── DashboardPage.tsx              # Integration point (modify)
```

### Component Specifications

#### 1. useOnboardingState.ts

```typescript
const STORAGE_KEY = 'onboarding_complete'

interface OnboardingState {
  isComplete: boolean
  markComplete: () => void
  reset: () => void  // For "Take Tour" re-trigger
}

// Helper to safely access localStorage (handles private browsing mode)
function safeLocalStorage() {
  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, testKey)
    localStorage.removeItem(testKey)
    return localStorage
  } catch {
    return null
  }
}

export function useOnboardingState(): OnboardingState {
  const storage = safeLocalStorage()

  const [isComplete, setIsComplete] = useState(() => {
    return storage?.getItem(STORAGE_KEY) === 'true'
  })

  const markComplete = useCallback(() => {
    storage?.setItem(STORAGE_KEY, 'true')
    setIsComplete(true)
  }, [storage])

  const reset = useCallback(() => {
    storage?.removeItem(STORAGE_KEY)
    setIsComplete(false)
  }, [storage])

  return { isComplete, markComplete, reset }
}
```

#### 2. onboardingContent.ts

```typescript
export interface OnboardingSlideData {
  id: string
  title: string
  subtitle: string
  iconType: 'document-chat' | 'brain' | 'share-link' | 'sparkle'
}

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    id: 'documents',
    title: 'Share Documents, Not Reading Lists',
    subtitle: 'Turn your documents into conversations that your audience actually engages with.',
    iconType: 'document-chat',
  },
  {
    id: 'configure',
    title: 'Train Your AI in Minutes',
    subtitle: 'Answer a few questions. We\'ll configure an AI that speaks your language and knows your content.',
    iconType: 'brain',
  },
  {
    id: 'share',
    title: 'One Link, Instant Access',
    subtitle: 'Share a single link. No logins required. Your audience gets answers immediately.',
    iconType: 'share-link',
  },
  {
    id: 'ready',
    title: 'Ready to Transform How You Share?',
    subtitle: 'Create your first project and see the magic happen.',
    iconType: 'sparkle',
  },
]
```

#### 3. ProgressBars.tsx

```typescript
interface ProgressBarsProps {
  currentIndex: number
  total: number
}

export function ProgressBars({ currentIndex, total }: ProgressBarsProps) {
  return (
    <div
      className="flex gap-1.5 px-5 pt-14"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Slide ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 h-0.5 rounded-full transition-all duration-300',
            i <= currentIndex
              ? 'bg-accent shadow-[0_0_8px_hsl(var(--color-accent-glow))]'
              : 'bg-white/10'
          )}
        />
      ))}
    </div>
  )
}
```

#### 4. OnboardingSlide.tsx

```typescript
interface OnboardingSlideProps {
  slide: OnboardingSlideData
  slideIndex: number
  isActive: boolean
}

export function OnboardingSlide({ slide, slideIndex, isActive }: OnboardingSlideProps) {
  const prefersReducedMotion = useReducedMotion()

  const variants = {
    enter: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : -20 },
  }

  return (
    <motion.div
      key={slideIndex}
      className="flex flex-col items-center justify-center text-center px-8"
      initial="enter"
      animate="center"
      exit="exit"
      variants={variants}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.25, 0.4, 0.25, 1] }}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Icon with pulse animation */}
      <OnboardingIcon
        type={slide.iconType}
        className="w-16 h-16 text-accent mb-8"
        animate={!prefersReducedMotion}
      />

      {/* Title */}
      <motion.h2
        key={`title-${slideIndex}`}
        className="font-display text-3xl md:text-4xl text-foreground mb-5"
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {slide.title}
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        key={`subtitle-${slideIndex}`}
        className="text-muted text-base md:text-lg max-w-sm"
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {slide.subtitle}
      </motion.p>
    </motion.div>
  )
}
```

#### 5. StoriesOnboarding.tsx (Main Component)

```typescript
interface StoriesOnboardingProps {
  onComplete: () => void
}

export function StoriesOnboarding({ onComplete }: StoriesOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1

  // Tap navigation handler
  const handleTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const tapZone = x > rect.width / 2 ? 'right' : 'left'

    if (tapZone === 'right') {
      if (currentSlide < ONBOARDING_SLIDES.length - 1) {
        setCurrentSlide(prev => prev + 1)
      }
      // Don't auto-complete on last slide tap - require button click
    } else if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }, [currentSlide])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (currentSlide < ONBOARDING_SLIDES.length - 1) {
            setCurrentSlide(prev => prev + 1)
          }
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1)
          }
          break
        case 'Escape':
          onComplete()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlide, onComplete])

  // Focus trap and body scroll lock
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement
    containerRef.current?.focus()
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
      previousActiveElement?.focus()
    }
  }, [])

  // Focus trap - cycle Tab between interactive elements
  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = containerRef.current?.querySelectorAll(
        'button:not([disabled])'
      ) as NodeListOf<HTMLElement>

      if (!focusableElements?.length) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [])

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to the platform"
      tabIndex={-1}
      onClick={handleTap}
      className={cn(
        'fixed inset-0 z-50 bg-background cursor-pointer',
        'flex flex-col min-h-screen',
        'outline-none' // Focus visible handled by skip button
      )}
    >
      {/* Atmospheric glow effects */}
      <GlowPulse className="w-96 h-96 -top-48 -left-48" />
      <GlowPulse className="w-80 h-80 -bottom-40 -right-40" color="purple" />

      {/* Progress bars */}
      <ProgressBars
        currentIndex={currentSlide}
        total={ONBOARDING_SLIDES.length}
      />

      {/* Skip button - always visible */}
      <div className="absolute top-16 right-5 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onComplete()
          }}
          className={cn(
            'px-4 py-2 text-sm font-medium text-muted',
            'hover:text-foreground transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
            'min-h-[44px] min-w-[44px]' // Touch target
          )}
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <OnboardingSlide
            key={currentSlide}
            slide={ONBOARDING_SLIDES[currentSlide]}
            slideIndex={currentSlide}
            isActive={true}
          />
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="px-8 pb-12 text-center">
        {isLastSlide ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onComplete()
            }}
            className={cn(
              'w-full max-w-sm mx-auto',
              'px-6 py-4 text-base font-semibold',
              'bg-accent text-background rounded-xl',
              'hover:bg-accent/90 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
              'min-h-[44px]' // Touch target
            )}
          >
            Get Started
          </button>
        ) : (
          <p className="text-xs text-dim">Tap to continue</p>
        )}
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite">
        Use arrow keys to navigate slides. Press Escape to skip.
      </div>
    </div>
  )
}
```

#### 6. onboardingIcons.tsx

Four custom SVG icons matching the 33 Strategies aesthetic:

```typescript
interface IconProps {
  className?: string
  animate?: boolean
}

// 1. Document → Chat transformation icon
export function DocumentChatIcon({ className, animate }: IconProps) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className={className}
      animate={animate ? {
        scale: [1, 1.05, 1],
      } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Document shape morphing into speech bubble */}
      <path
        d="M8 8h32v40H8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M44 16c8 0 12 6 12 12s-4 12-12 12h-4l-4 8v-8h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Document lines */}
      <line x1="14" y1="18" x2="34" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="26" x2="30" y2="26" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="34" x2="26" y2="34" stroke="currentColor" strokeWidth="1.5" />
    </motion.svg>
  )
}

// 2. Brain/interview icon
export function BrainIcon({ className, animate }: IconProps) { ... }

// 3. Share/link icon
export function ShareLinkIcon({ className, animate }: IconProps) { ... }

// 4. Sparkle/magic icon
export function SparkleIcon({ className, animate }: IconProps) { ... }

// Icon dispatcher
export function OnboardingIcon({ type, ...props }: IconProps & { type: string }) {
  switch (type) {
    case 'document-chat': return <DocumentChatIcon {...props} />
    case 'brain': return <BrainIcon {...props} />
    case 'share-link': return <ShareLinkIcon {...props} />
    case 'sparkle': return <SparkleIcon {...props} />
    default: return null
  }
}
```

### Integration with DashboardPage.tsx

```typescript
// Add to DashboardPage.tsx

import { StoriesOnboarding } from '../components/onboarding/StoriesOnboarding'
import { useOnboardingState } from '../components/onboarding/useOnboardingState'

export function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { isComplete: isOnboardingComplete, markComplete } = useOnboardingState()
  const navigate = useNavigate()

  // ... existing useEffect and handlers ...

  if (loading) { /* existing loading state */ }
  if (error) { /* existing error state */ }

  return (
    <div className="min-h-screen bg-background">
      {/* Onboarding overlay - shown when not complete */}
      {!isOnboardingComplete && (
        <StoriesOnboarding onComplete={markComplete} />
      )}

      {/* Existing dashboard content */}
      {/* Header */}
      <div className="border-b border-border bg-background-elevated">
        {/* ... */}
      </div>

      {/* Dashboard content */}
      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* ... */}
      </div>

      {/* Create project modal */}
      <CreateProjectModal {...} />
    </div>
  )
}
```

### "Take Tour" Help Menu Integration

Add to dashboard header or help menu:

```typescript
// In DashboardPage.tsx or a HelpMenu component
const { reset: resetOnboarding } = useOnboardingState()

<button
  onClick={resetOnboarding}
  className="text-sm text-muted hover:text-foreground"
>
  Take Tour
</button>
```

---

## User Experience

### Flow Diagram

```
┌─────────────────┐
│ User Registers  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Navigate to     │
│ /dashboard      │
└────────┬────────┘
         ▼
    ┌────────────┐
    │ Check      │
    │ localStorage│
    └─────┬──────┘
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌─────────┐  ┌─────────┐
│ NOT     │  │ Complete│
│ Complete│  │         │
└────┬────┘  └────┬────┘
     │            │
     ▼            │
┌──────────────┐  │
│ Show         │  │
│ Onboarding   │  │
│ Overlay      │  │
└──────┬───────┘  │
       │          │
       ▼          │
┌──────────────┐  │
│ User taps    │  │
│ through or   │  │
│ skips        │  │
└──────┬───────┘  │
       │          │
       ▼          │
┌──────────────┐  │
│ Mark         │  │
│ complete     │◄─┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Show         │
│ Dashboard    │
└──────────────┘
```

### Interaction Patterns

| Action | Desktop | Mobile |
|--------|---------|--------|
| Advance | Click right side / Arrow Right | Tap right side |
| Go back | Click left side / Arrow Left | Tap left side |
| Skip | Click "Skip" button / Escape | Tap "Skip" button |
| Complete | Click "Get Started" on last slide | Tap "Get Started" |

### Timing

- Total experience: <60 seconds (4 slides at ~15s each)
- Transition duration: 400ms
- Progress bar transition: 300ms
- Icon pulse: 2s cycle (infinite while on slide)

---

## Testing Strategy

### Unit Tests

```typescript
// useOnboardingState.test.ts
describe('useOnboardingState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should return false initially when localStorage is empty', () => {
    // Purpose: Verify new users see onboarding
    const { result } = renderHook(() => useOnboardingState())
    expect(result.current.isComplete).toBe(false)
  })

  it('should return true when localStorage has completion flag', () => {
    // Purpose: Verify returning users skip onboarding
    localStorage.setItem('onboarding_complete', 'true')
    const { result } = renderHook(() => useOnboardingState())
    expect(result.current.isComplete).toBe(true)
  })

  it('should set localStorage when markComplete is called', () => {
    // Purpose: Verify completion persists across sessions
    const { result } = renderHook(() => useOnboardingState())
    act(() => result.current.markComplete())
    expect(localStorage.getItem('onboarding_complete')).toBe('true')
  })

  it('should clear localStorage when reset is called', () => {
    // Purpose: Verify "Take Tour" can re-trigger onboarding
    localStorage.setItem('onboarding_complete', 'true')
    const { result } = renderHook(() => useOnboardingState())
    act(() => result.current.reset())
    expect(localStorage.getItem('onboarding_complete')).toBeNull()
  })
})
```

```typescript
// ProgressBars.test.tsx
describe('ProgressBars', () => {
  it('should highlight correct number of bars based on currentIndex', () => {
    // Purpose: Verify visual progress indicator accuracy
    const { container } = render(<ProgressBars currentIndex={2} total={4} />)
    const bars = container.querySelectorAll('div > div')

    // First 3 bars (index 0, 1, 2) should be highlighted
    expect(bars[0]).toHaveClass('bg-accent')
    expect(bars[1]).toHaveClass('bg-accent')
    expect(bars[2]).toHaveClass('bg-accent')
    expect(bars[3]).not.toHaveClass('bg-accent')
  })

  it('should have correct ARIA attributes', () => {
    // Purpose: Verify screen reader accessibility
    const { getByRole } = render(<ProgressBars currentIndex={1} total={4} />)
    const progressbar = getByRole('progressbar')

    expect(progressbar).toHaveAttribute('aria-valuenow', '2')
    expect(progressbar).toHaveAttribute('aria-valuemax', '4')
  })
})
```

```typescript
// StoriesOnboarding.test.tsx
describe('StoriesOnboarding', () => {
  it('should advance slide when clicking right side', () => {
    // Purpose: Verify tap-to-advance works correctly
    const onComplete = vi.fn()
    const { getByRole } = render(<StoriesOnboarding onComplete={onComplete} />)
    const container = getByRole('dialog')

    // Mock click on right side
    fireEvent.click(container, { clientX: 500 }) // Assuming 400px width

    // Should now be on slide 2
    expect(screen.getByText('Train Your AI in Minutes')).toBeInTheDocument()
  })

  it('should go back when clicking left side', () => {
    // Purpose: Verify back navigation works
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    // Advance first
    fireEvent.click(screen.getByRole('dialog'), { clientX: 500 })
    // Then go back
    fireEvent.click(screen.getByRole('dialog'), { clientX: 50 })

    expect(screen.getByText('Share Documents, Not Reading Lists')).toBeInTheDocument()
  })

  it('should call onComplete when Skip is clicked', () => {
    // Purpose: Verify skip functionality
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    fireEvent.click(screen.getByText('Skip'))
    expect(onComplete).toHaveBeenCalled()
  })

  it('should call onComplete when Get Started is clicked on last slide', () => {
    // Purpose: Verify final CTA works
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    // Navigate to last slide
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('dialog'), { clientX: 500 })
    }

    fireEvent.click(screen.getByText('Get Started'))
    expect(onComplete).toHaveBeenCalled()
  })

  it('should navigate with keyboard arrows', () => {
    // Purpose: Verify keyboard accessibility
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Train Your AI in Minutes')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Share Documents, Not Reading Lists')).toBeInTheDocument()
  })

  it('should skip on Escape key', () => {
    // Purpose: Verify keyboard skip accessibility
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onComplete).toHaveBeenCalled()
  })
})
```

### Integration Tests

```typescript
// DashboardPage.integration.test.tsx
describe('Dashboard with Onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should show onboarding overlay for new users', async () => {
    // Purpose: Verify new user flow integration
    render(<DashboardPage />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Share Documents, Not Reading Lists')).toBeInTheDocument()
  })

  it('should not show onboarding for returning users', async () => {
    // Purpose: Verify returning user flow
    localStorage.setItem('onboarding_complete', 'true')
    render(<DashboardPage />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('should reveal dashboard after completing onboarding', async () => {
    // Purpose: Verify transition from onboarding to dashboard
    render(<DashboardPage />)

    // Complete onboarding
    fireEvent.click(screen.getByText('Skip'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })
})
```

### Accessibility Tests

```typescript
// StoriesOnboarding.a11y.test.tsx
describe('StoriesOnboarding Accessibility', () => {
  it('should have no accessibility violations', async () => {
    // Purpose: Automated a11y audit
    const { container } = render(<StoriesOnboarding onComplete={() => {}} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should trap focus within dialog', () => {
    // Purpose: Verify focus management for keyboard users
    render(<StoriesOnboarding onComplete={() => {}} />)

    const dialog = screen.getByRole('dialog')
    expect(document.activeElement).toBe(dialog)

    // Tab should cycle within dialog
    userEvent.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('should have minimum touch target size', () => {
    // Purpose: Verify mobile accessibility
    render(<StoriesOnboarding onComplete={() => {}} />)

    const skipButton = screen.getByText('Skip')
    const styles = window.getComputedStyle(skipButton)

    expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44)
    expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44)
  })
})
```

### Manual Testing Checklist

- [ ] Desktop: Chrome, Firefox, Safari - tap navigation works
- [ ] Mobile: iOS Safari, Android Chrome - touch navigation works
- [ ] Keyboard only: Full navigation possible without mouse
- [ ] Screen reader: VoiceOver/NVDA announces slide content
- [ ] Reduced motion: Animations disabled with `prefers-reduced-motion`
- [ ] New user flow: Onboarding shows after registration
- [ ] Return user flow: Onboarding does not show
- [ ] "Take Tour": Can re-trigger onboarding from help menu

---

## Performance Considerations

### Bundle Impact

| Component | Estimated Size |
|-----------|---------------|
| StoriesOnboarding.tsx | ~3KB |
| OnboardingSlide.tsx | ~1.5KB |
| ProgressBars.tsx | ~0.5KB |
| onboardingContent.ts | ~0.5KB |
| onboardingIcons.tsx | ~2KB (4 SVGs) |
| useOnboardingState.ts | ~0.3KB |
| **Total** | **~8KB** (gzipped: ~3KB) |

### Optimizations

1. **Code splitting**: Component loads only when needed (new users only)
2. **SVG icons**: Inline SVGs avoid additional network requests
3. **CSS transitions**: Hardware-accelerated via `transform` and `opacity`
4. **Minimal state**: Single localStorage read on mount

### Metrics to Track

- Onboarding completion rate
- Average time to complete
- Skip rate (by slide number)
- First project creation rate (post-onboarding)

---

## Security Considerations

### Data Storage

- **localStorage only**: No sensitive data stored
- **Key**: `onboarding_complete` (boolean string)
- **Risk**: Low - completion state is non-sensitive
- **Mitigation**: None required for MVP

### XSS Prevention

- All text content is hardcoded (no user input rendered)
- SVG icons are self-contained components
- No `dangerouslySetInnerHTML` usage

---

## Documentation

### User Documentation

No external documentation required - the onboarding itself is the documentation.

### Developer Documentation

Update `CLAUDE.md` with:

```markdown
## Stories Onboarding

**What:** Instagram Stories-style onboarding for new users after signup.

**Key files:**
- `frontend/src/components/onboarding/StoriesOnboarding.tsx` - Main component
- `frontend/src/components/onboarding/useOnboardingState.ts` - Persistence hook
- `frontend/src/pages/DashboardPage.tsx` - Integration point

**localStorage key:** `onboarding_complete`

**Re-trigger:** Call `reset()` from `useOnboardingState()` hook (used in "Take Tour")

**Accessibility:**
- Arrow keys to navigate
- Escape to skip
- Respects `prefers-reduced-motion`
```

---

## Implementation Phases

### Phase 1: Core Onboarding Flow

**Deliverables:**
- `useOnboardingState.ts` hook
- `onboardingContent.ts` slide data
- `ProgressBars.tsx` component
- `OnboardingSlide.tsx` component
- `StoriesOnboarding.tsx` main component
- `onboardingIcons.tsx` SVG icons
- DashboardPage.tsx integration
- Unit tests for all components

**Acceptance Criteria:**
- New users see 4-slide onboarding overlay
- Tap/click navigation works (left=back, right=advance)
- Keyboard navigation works (arrows, Escape)
- Skip button always visible
- "Get Started" on final slide
- Completion persists in localStorage
- Return users skip onboarding

### Phase 2: Polish & Accessibility

**Deliverables:**
- Reduced motion support
- Focus trap implementation
- ARIA live region updates
- Screen reader testing
- Mobile touch testing
- Cross-browser testing

**Acceptance Criteria:**
- Animations disabled with `prefers-reduced-motion`
- Focus trapped within overlay
- VoiceOver/NVDA announces content correctly
- Works on iOS Safari and Android Chrome
- Works on Chrome, Firefox, Safari desktop

### Phase 3: Help Menu Integration

**Deliverables:**
- "Take Tour" button in help menu or dashboard header
- Integration with `reset()` from hook

**Acceptance Criteria:**
- Users can re-trigger onboarding from UI
- Onboarding shows again after reset

---

## Open Questions

All questions resolved during ideation. User confirmed:

1. **Slide count:** 4 slides
2. **Icon style:** Custom SVGs
3. **Skip behavior:** Always visible
4. **Final CTA:** "Get Started"
5. **Re-access:** Help menu "Take Tour"

---

## References

- [Ideation Document](../docs/ideation/stories-onboarding-flow.md)
- [Instagram Stories UX Pattern](user-provided pattern document)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [WCAG 2.1 Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [33 Strategies Design System](../.claude/skills/33-strategies-frontend-design.md)

---

## Appendix: SVG Icon Specifications

### Document-Chat Icon (64x64)

Visual: Document with corner fold on left, speech bubble emerging on right

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor">
  <!-- Document body -->
  <path d="M8 12 L8 52 L32 52 L32 12 L24 12 L24 4 L8 4 Z" stroke-width="2"/>
  <!-- Corner fold -->
  <path d="M24 4 L32 12" stroke-width="2"/>
  <!-- Document lines -->
  <line x1="12" y1="20" x2="28" y2="20" stroke-width="1.5"/>
  <line x1="12" y1="28" x2="24" y2="28" stroke-width="1.5"/>
  <line x1="12" y1="36" x2="20" y2="36" stroke-width="1.5"/>
  <!-- Speech bubble -->
  <path d="M36 20 C36 14 42 10 50 10 C58 10 64 14 64 22 C64 30 58 34 50 34 L46 34 L42 42 L42 34 L40 34 C38 34 36 32 36 28 Z" stroke-width="2"/>
  <!-- Bubble dots -->
  <circle cx="46" cy="22" r="1.5" fill="currentColor"/>
  <circle cx="50" cy="22" r="1.5" fill="currentColor"/>
  <circle cx="54" cy="22" r="1.5" fill="currentColor"/>
</svg>
```

### Brain Icon (64x64)

Visual: Stylized brain profile with interview/thought lines

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor">
  <!-- Brain outline - left hemisphere -->
  <path d="M20 16 C12 16 8 24 8 32 C8 44 16 52 28 52 L28 48" stroke-width="2"/>
  <!-- Brain outline - right hemisphere -->
  <path d="M28 16 C36 16 44 20 44 28 C44 36 40 44 28 48" stroke-width="2"/>
  <!-- Brain folds -->
  <path d="M16 28 C20 28 24 24 28 28" stroke-width="1.5"/>
  <path d="M16 36 C22 36 26 32 32 36" stroke-width="1.5"/>
  <!-- Thought/interview lines emanating right -->
  <line x1="48" y1="20" x2="56" y2="20" stroke-width="2" stroke-linecap="round"/>
  <line x1="50" y1="28" x2="58" y2="28" stroke-width="2" stroke-linecap="round"/>
  <line x1="48" y1="36" x2="56" y2="36" stroke-width="2" stroke-linecap="round"/>
  <!-- Connection stem -->
  <path d="M44 28 L48 28" stroke-width="1.5"/>
</svg>
```

### Share-Link Icon (64x64)

Visual: Chain link with emanating share arrows

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor">
  <!-- Chain link 1 -->
  <rect x="8" y="24" width="20" height="16" rx="8" stroke-width="2"/>
  <!-- Chain link 2 -->
  <rect x="24" y="24" width="20" height="16" rx="8" stroke-width="2"/>
  <!-- Share arrows emanating -->
  <path d="M48 20 L56 12 L56 20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="56" y1="12" x2="56" y2="28" stroke-width="2" stroke-linecap="round"/>
  <path d="M48 44 L56 52 L56 44" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="56" y1="52" x2="56" y2="36" stroke-width="2" stroke-linecap="round"/>
  <!-- Center connector highlight -->
  <line x1="28" y1="32" x2="36" y2="32" stroke-width="2" stroke-linecap="round"/>
</svg>
```

### Sparkle Icon (64x64)

Visual: 4-point star with smaller surrounding sparkles

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor">
  <!-- Main 4-point star -->
  <path d="M32 8 L36 24 L52 28 L36 32 L32 48 L28 32 L12 28 L28 24 Z" stroke-width="2" stroke-linejoin="round"/>
  <!-- Top-right small sparkle -->
  <path d="M48 8 L50 14 L56 16 L50 18 L48 24 L46 18 L40 16 L46 14 Z" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Bottom-left small sparkle -->
  <path d="M16 40 L18 46 L24 48 L18 50 L16 56 L14 50 L8 48 L14 46 Z" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Bottom-right tiny sparkle -->
  <circle cx="52" cy="48" r="2" fill="currentColor"/>
  <!-- Top-left tiny sparkle -->
  <circle cx="12" cy="16" r="2" fill="currentColor"/>
</svg>
```
