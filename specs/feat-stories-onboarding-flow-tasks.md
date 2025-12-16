# Task Breakdown: Stories-Style Onboarding Flow

**Generated:** 2025-12-13
**Source:** specs/feat-stories-onboarding-flow.md

---

## Overview

Build an Instagram Stories-style onboarding experience for new users after signup. The feature includes:
- 4-slide fullscreen overlay with tap-to-navigate
- Segmented progress bars with gold glow
- Framer Motion animations with reduced motion support
- localStorage persistence with safe fallback
- Full keyboard accessibility with focus trap
- Custom SVG icons matching 33 Strategies design system
- "Take Tour" re-trigger capability

---

## Phase 1: Foundation & Data Layer

### Task 1.1: Create useOnboardingState hook
**Description**: Implement localStorage persistence hook with safe storage fallback
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Technical Requirements**:
- Storage key: `onboarding_complete`
- Safe localStorage access (handles private browsing)
- Three methods: `isComplete`, `markComplete`, `reset`
- Lazy initialization from storage

**Implementation**:
```typescript
// frontend/src/components/onboarding/useOnboardingState.ts
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'onboarding_complete'

interface OnboardingState {
  isComplete: boolean
  markComplete: () => void
  reset: () => void
}

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

**Acceptance Criteria**:
- [ ] Returns `false` when localStorage is empty
- [ ] Returns `true` when storage has completion flag
- [ ] `markComplete()` persists to localStorage
- [ ] `reset()` clears localStorage (for "Take Tour")
- [ ] Gracefully handles private browsing mode (returns false, operations no-op)

---

### Task 1.2: Create onboardingContent data module
**Description**: Define slide content data structure and content
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Implementation**:
```typescript
// frontend/src/components/onboarding/onboardingContent.ts
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
    subtitle: "Answer a few questions. We'll configure an AI that speaks your language and knows your content.",
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

**Acceptance Criteria**:
- [ ] Exports `OnboardingSlideData` interface
- [ ] Exports `ONBOARDING_SLIDES` array with 4 slides
- [ ] Each slide has id, title, subtitle, iconType

---

## Phase 2: UI Components

### Task 2.1: Create SVG icon components
**Description**: Implement 4 custom SVG icons matching 33 Strategies aesthetic
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.2, 2.3

**Implementation**:
```typescript
// frontend/src/components/onboarding/onboardingIcons.tsx
import { motion } from 'framer-motion'

interface IconProps {
  className?: string
  animate?: boolean
}

export function DocumentChatIcon({ className, animate }: IconProps) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      animate={animate ? { scale: [1, 1.05, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Document body */}
      <path d="M8 12 L8 52 L32 52 L32 12 L24 12 L24 4 L8 4 Z" strokeWidth="2"/>
      {/* Corner fold */}
      <path d="M24 4 L32 12" strokeWidth="2"/>
      {/* Document lines */}
      <line x1="12" y1="20" x2="28" y2="20" strokeWidth="1.5"/>
      <line x1="12" y1="28" x2="24" y2="28" strokeWidth="1.5"/>
      <line x1="12" y1="36" x2="20" y2="36" strokeWidth="1.5"/>
      {/* Speech bubble */}
      <path d="M36 20 C36 14 42 10 50 10 C58 10 64 14 64 22 C64 30 58 34 50 34 L46 34 L42 42 L42 34 L40 34 C38 34 36 32 36 28 Z" strokeWidth="2"/>
      {/* Bubble dots */}
      <circle cx="46" cy="22" r="1.5" fill="currentColor"/>
      <circle cx="50" cy="22" r="1.5" fill="currentColor"/>
      <circle cx="54" cy="22" r="1.5" fill="currentColor"/>
    </motion.svg>
  )
}

export function BrainIcon({ className, animate }: IconProps) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      animate={animate ? { scale: [1, 1.05, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Brain outline - left hemisphere */}
      <path d="M20 16 C12 16 8 24 8 32 C8 44 16 52 28 52 L28 48" strokeWidth="2"/>
      {/* Brain outline - right hemisphere */}
      <path d="M28 16 C36 16 44 20 44 28 C44 36 40 44 28 48" strokeWidth="2"/>
      {/* Brain folds */}
      <path d="M16 28 C20 28 24 24 28 28" strokeWidth="1.5"/>
      <path d="M16 36 C22 36 26 32 32 36" strokeWidth="1.5"/>
      {/* Thought/interview lines emanating right */}
      <line x1="48" y1="20" x2="56" y2="20" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="28" x2="58" y2="28" strokeWidth="2" strokeLinecap="round"/>
      <line x1="48" y1="36" x2="56" y2="36" strokeWidth="2" strokeLinecap="round"/>
      {/* Connection stem */}
      <path d="M44 28 L48 28" strokeWidth="1.5"/>
    </motion.svg>
  )
}

export function ShareLinkIcon({ className, animate }: IconProps) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      animate={animate ? { scale: [1, 1.05, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Chain link 1 */}
      <rect x="8" y="24" width="20" height="16" rx="8" strokeWidth="2"/>
      {/* Chain link 2 */}
      <rect x="24" y="24" width="20" height="16" rx="8" strokeWidth="2"/>
      {/* Share arrows emanating */}
      <path d="M48 20 L56 12 L56 20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="56" y1="12" x2="56" y2="28" strokeWidth="2" strokeLinecap="round"/>
      <path d="M48 44 L56 52 L56 44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="56" y1="52" x2="56" y2="36" strokeWidth="2" strokeLinecap="round"/>
      {/* Center connector highlight */}
      <line x1="28" y1="32" x2="36" y2="32" strokeWidth="2" strokeLinecap="round"/>
    </motion.svg>
  )
}

export function SparkleIcon({ className, animate }: IconProps) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      animate={animate ? { scale: [1, 1.05, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Main 4-point star */}
      <path d="M32 8 L36 24 L52 28 L36 32 L32 48 L28 32 L12 28 L28 24 Z" strokeWidth="2" strokeLinejoin="round"/>
      {/* Top-right small sparkle */}
      <path d="M48 8 L50 14 L56 16 L50 18 L48 24 L46 18 L40 16 L46 14 Z" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Bottom-left small sparkle */}
      <path d="M16 40 L18 46 L24 48 L18 50 L16 56 L14 50 L8 48 L14 46 Z" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Bottom-right tiny sparkle */}
      <circle cx="52" cy="48" r="2" fill="currentColor"/>
      {/* Top-left tiny sparkle */}
      <circle cx="12" cy="16" r="2" fill="currentColor"/>
    </motion.svg>
  )
}

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

**Acceptance Criteria**:
- [ ] All 4 icons render correctly at 64x64
- [ ] Icons use `currentColor` for theming
- [ ] Optional `animate` prop enables pulse animation
- [ ] Icons match 33 Strategies aesthetic (geometric, no emojis)
- [ ] `OnboardingIcon` dispatcher works for all types

---

### Task 2.2: Create ProgressBars component
**Description**: Implement segmented Instagram-style progress indicator
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.1, 2.3

**Implementation**:
```typescript
// frontend/src/components/onboarding/ProgressBars.tsx
import { cn } from '../../lib/utils'

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

**Acceptance Criteria**:
- [ ] Renders correct number of bars based on `total`
- [ ] Highlights bars up to and including `currentIndex`
- [ ] Has gold glow effect on active bars
- [ ] Includes proper ARIA attributes for accessibility
- [ ] Smooth 300ms transitions between states

---

### Task 2.3: Create OnboardingSlide component
**Description**: Implement individual slide with Framer Motion animations
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1 (icons)
**Can run parallel with**: Task 2.2

**Implementation**:
```typescript
// frontend/src/components/onboarding/OnboardingSlide.tsx
import { motion, useReducedMotion } from 'framer-motion'
import { OnboardingSlideData } from './onboardingContent'
import { OnboardingIcon } from './onboardingIcons'

interface OnboardingSlideProps {
  slide: OnboardingSlideData
  slideIndex: number
}

export function OnboardingSlide({ slide, slideIndex }: OnboardingSlideProps) {
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

**Acceptance Criteria**:
- [ ] Renders icon, title, and subtitle
- [ ] Staggered fade-in animation (icon → title → subtitle)
- [ ] Respects `prefers-reduced-motion` setting
- [ ] Uses 33 Strategies fonts (font-display for title)
- [ ] Proper ARIA live region for screen readers

---

### Task 2.4: Create StoriesOnboarding main component
**Description**: Implement main container with tap navigation, keyboard handling, and focus trap
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, 1.2, 2.1, 2.2, 2.3
**Can run parallel with**: None (requires all dependencies)

**Implementation**:
```typescript
// frontend/src/components/onboarding/StoriesOnboarding.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { GlowPulse } from '../ui/glow-pulse'
import { ONBOARDING_SLIDES } from './onboardingContent'
import { ProgressBars } from './ProgressBars'
import { OnboardingSlide } from './OnboardingSlide'

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
        'outline-none'
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
            'min-h-[44px] min-w-[44px]'
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
              'min-h-[44px]'
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

**Acceptance Criteria**:
- [ ] Fullscreen overlay covers entire viewport
- [ ] Tap right advances, tap left goes back
- [ ] Arrow keys navigate (Right/Down advance, Left/Up go back)
- [ ] Escape key skips to completion
- [ ] Tab cycles between Skip and Get Started buttons
- [ ] Body scroll locked while overlay visible
- [ ] Focus restored to previous element on close
- [ ] Skip button always visible with 44px touch target
- [ ] "Get Started" CTA on final slide only
- [ ] "Tap to continue" hint on non-final slides
- [ ] GlowPulse atmospheric effects render

---

### Task 2.5: Create index.ts barrel export
**Description**: Create index file for clean imports
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.4
**Can run parallel with**: None

**Implementation**:
```typescript
// frontend/src/components/onboarding/index.ts
export { StoriesOnboarding } from './StoriesOnboarding'
export { useOnboardingState } from './useOnboardingState'
export { ONBOARDING_SLIDES } from './onboardingContent'
export type { OnboardingSlideData } from './onboardingContent'
```

**Acceptance Criteria**:
- [ ] Exports StoriesOnboarding component
- [ ] Exports useOnboardingState hook
- [ ] Exports ONBOARDING_SLIDES and type

---

## Phase 3: Integration

### Task 3.1: Integrate with DashboardPage
**Description**: Add conditional rendering of onboarding overlay to DashboardPage
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.4, 2.5
**Can run parallel with**: Task 3.2

**Implementation**:

Modify `frontend/src/pages/DashboardPage.tsx`:

```typescript
// Add imports at top
import { StoriesOnboarding, useOnboardingState } from '../components/onboarding'

// Inside DashboardPage function, add:
const { isComplete: isOnboardingComplete, markComplete } = useOnboardingState()

// In the return statement, add overlay before dashboard content:
return (
  <div className="min-h-screen bg-background">
    {/* Onboarding overlay - shown when not complete */}
    {!isOnboardingComplete && (
      <StoriesOnboarding onComplete={markComplete} />
    )}

    {/* Existing dashboard content below... */}
    {/* Header */}
    <div className="border-b border-border bg-background-elevated">
      {/* ... */}
    </div>
    {/* ... rest of dashboard */}
  </div>
)
```

**Acceptance Criteria**:
- [ ] Onboarding shows for new users (localStorage empty)
- [ ] Onboarding does not show for returning users
- [ ] Dashboard content renders behind/after onboarding
- [ ] Completing onboarding reveals dashboard

---

### Task 3.2: Add "Take Tour" button
**Description**: Add re-trigger capability to dashboard header
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: Task 4.1

**Implementation**:

Modify `frontend/src/pages/DashboardPage.tsx` header section:

```typescript
// Get reset function from hook
const { isComplete: isOnboardingComplete, markComplete, reset: resetOnboarding } = useOnboardingState()

// Add button in header alongside Logout
<div className="flex gap-2">
  <Button variant="ghost" onClick={resetOnboarding} className="text-muted hover:text-foreground">
    Take Tour
  </Button>
  <Button onClick={() => setShowCreateModal(true)}>
    New Project
  </Button>
  <Button variant="ghost" onClick={handleLogout}>
    Logout
  </Button>
</div>
```

**Acceptance Criteria**:
- [ ] "Take Tour" button visible in header
- [ ] Clicking resets onboarding state
- [ ] Onboarding overlay appears after reset
- [ ] Button styled consistently with other header actions

---

## Phase 4: Testing

### Task 4.1: Unit tests for useOnboardingState
**Description**: Test hook behavior with localStorage
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 4.2, 4.3

**Implementation**:
```typescript
// frontend/src/components/onboarding/__tests__/useOnboardingState.test.ts
import { renderHook, act } from '@testing-library/react'
import { useOnboardingState } from '../useOnboardingState'

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
    expect(result.current.isComplete).toBe(true)
  })

  it('should clear localStorage when reset is called', () => {
    // Purpose: Verify "Take Tour" can re-trigger onboarding
    localStorage.setItem('onboarding_complete', 'true')
    const { result } = renderHook(() => useOnboardingState())
    act(() => result.current.reset())
    expect(localStorage.getItem('onboarding_complete')).toBeNull()
    expect(result.current.isComplete).toBe(false)
  })
})
```

**Acceptance Criteria**:
- [ ] All 4 tests pass
- [ ] Tests verify real localStorage behavior
- [ ] Tests include purpose comments

---

### Task 4.2: Unit tests for ProgressBars
**Description**: Test progress bar rendering and accessibility
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.2
**Can run parallel with**: Task 4.1, 4.3

**Implementation**:
```typescript
// frontend/src/components/onboarding/__tests__/ProgressBars.test.tsx
import { render, screen } from '@testing-library/react'
import { ProgressBars } from '../ProgressBars'

describe('ProgressBars', () => {
  it('should highlight correct number of bars based on currentIndex', () => {
    // Purpose: Verify visual progress indicator accuracy
    const { container } = render(<ProgressBars currentIndex={2} total={4} />)
    const bars = container.querySelectorAll('[class*="flex-1"]')

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
    expect(progressbar).toHaveAttribute('aria-valuemin', '1')
  })

  it('should render correct number of bars', () => {
    // Purpose: Verify bar count matches total
    const { container } = render(<ProgressBars currentIndex={0} total={5} />)
    const bars = container.querySelectorAll('[class*="flex-1"]')
    expect(bars).toHaveLength(5)
  })
})
```

**Acceptance Criteria**:
- [ ] All 3 tests pass
- [ ] Tests verify visual highlighting logic
- [ ] Tests verify ARIA attributes

---

### Task 4.3: Unit tests for StoriesOnboarding
**Description**: Test main component interactions
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Task 4.1, 4.2

**Implementation**:
```typescript
// frontend/src/components/onboarding/__tests__/StoriesOnboarding.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { StoriesOnboarding } from '../StoriesOnboarding'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion')
  return {
    ...actual,
    useReducedMotion: () => true, // Disable animations in tests
  }
})

describe('StoriesOnboarding', () => {
  it('should render first slide initially', () => {
    // Purpose: Verify initial state
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    expect(screen.getByText('Share Documents, Not Reading Lists')).toBeInTheDocument()
  })

  it('should call onComplete when Skip is clicked', () => {
    // Purpose: Verify skip functionality
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    fireEvent.click(screen.getByText('Skip'))
    expect(onComplete).toHaveBeenCalledTimes(1)
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
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('should show Get Started on last slide', () => {
    // Purpose: Verify final CTA appears
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    // Navigate to last slide
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('Get Started')).toBeInTheDocument()
    expect(screen.queryByText('Tap to continue')).not.toBeInTheDocument()
  })

  it('should call onComplete when Get Started is clicked', () => {
    // Purpose: Verify final CTA works
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    // Navigate to last slide
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    }

    fireEvent.click(screen.getByText('Get Started'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('should have dialog role for accessibility', () => {
    // Purpose: Verify ARIA dialog semantics
    const onComplete = vi.fn()
    render(<StoriesOnboarding onComplete={onComplete} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
```

**Acceptance Criteria**:
- [ ] All 7 tests pass
- [ ] Tests verify navigation (keyboard)
- [ ] Tests verify skip/complete functionality
- [ ] Tests verify accessibility attributes

---

## Phase 5: Documentation

### Task 5.1: Update CLAUDE.md
**Description**: Add onboarding documentation to project context
**Size**: Small
**Priority**: Low
**Dependencies**: Task 3.1
**Can run parallel with**: None

**Implementation**:

Add to CLAUDE.md:

```markdown
---

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

**Acceptance Criteria**:
- [ ] Documentation added to CLAUDE.md
- [ ] Key files, localStorage key, and re-trigger documented
- [ ] Accessibility features noted

---

## Dependency Graph

```
Phase 1 (Foundation)
├── Task 1.1: useOnboardingState hook
└── Task 1.2: onboardingContent data
         │
         ▼
Phase 2 (UI Components)
├── Task 2.1: SVG icons ─────────────┐
├── Task 2.2: ProgressBars ──────────┤
└── Task 2.3: OnboardingSlide ───────┤
                                     │
                                     ▼
                          Task 2.4: StoriesOnboarding
                                     │
                                     ▼
                          Task 2.5: index.ts exports
                                     │
                                     ▼
Phase 3 (Integration)
├── Task 3.1: DashboardPage integration
└── Task 3.2: "Take Tour" button
         │
         ▼
Phase 4 (Testing)
├── Task 4.1: useOnboardingState tests
├── Task 4.2: ProgressBars tests
└── Task 4.3: StoriesOnboarding tests
         │
         ▼
Phase 5 (Documentation)
└── Task 5.1: Update CLAUDE.md
```

## Parallel Execution Opportunities

| Group | Tasks | Notes |
|-------|-------|-------|
| Foundation | 1.1, 1.2 | Both are independent |
| UI Components | 2.1, 2.2 | Icons and ProgressBars are independent |
| Testing | 4.1, 4.2, 4.3 | All tests can run in parallel |

## Summary

| Phase | Tasks | Priority Tasks |
|-------|-------|---------------|
| Phase 1: Foundation | 2 | 1.1, 1.2 |
| Phase 2: UI Components | 5 | 2.1, 2.2, 2.3, 2.4 |
| Phase 3: Integration | 2 | 3.1 |
| Phase 4: Testing | 3 | 4.1, 4.3 |
| Phase 5: Documentation | 1 | 5.1 |
| **Total** | **13** | |

## Execution Order (Recommended)

1. **Batch 1** (parallel): Task 1.1, Task 1.2
2. **Batch 2** (parallel): Task 2.1, Task 2.2
3. **Batch 3**: Task 2.3 (depends on 2.1)
4. **Batch 4**: Task 2.4 (depends on all above)
5. **Batch 5**: Task 2.5
6. **Batch 6** (parallel): Task 3.1, Task 3.2
7. **Batch 7** (parallel): Task 4.1, Task 4.2, Task 4.3
8. **Batch 8**: Task 5.1
