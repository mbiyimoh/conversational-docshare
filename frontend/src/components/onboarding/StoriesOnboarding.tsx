import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'
import { GlowPulse } from '../ui'
import { ProgressBars } from './ProgressBars'
import { OnboardingSlide } from './OnboardingSlide'
import { ONBOARDING_SLIDES } from './onboardingContent'

interface StoriesOnboardingProps {
  onComplete: () => void
}

export function StoriesOnboarding({ onComplete }: StoriesOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1

  // Tap navigation handler
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const tapZone = x > rect.width / 2 ? 'right' : 'left'

      if (tapZone === 'right') {
        if (currentSlide < ONBOARDING_SLIDES.length - 1) {
          setCurrentSlide((prev) => prev + 1)
        }
        // Don't auto-complete on last slide tap - require button click
      } else if (currentSlide > 0) {
        setCurrentSlide((prev) => prev - 1)
      }
    },
    [currentSlide]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (currentSlide < ONBOARDING_SLIDES.length - 1) {
            setCurrentSlide((prev) => prev + 1)
          }
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          if (currentSlide > 0) {
            setCurrentSlide((prev) => prev - 1)
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
      <ProgressBars currentIndex={currentSlide} total={ONBOARDING_SLIDES.length} />

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
