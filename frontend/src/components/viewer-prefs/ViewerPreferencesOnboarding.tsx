import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { GlowPulse } from '../ui'
import { ProgressBars } from '../onboarding/ProgressBars'
import { PreviewResponse } from './PreviewResponse'
import { DepthSelector } from './DepthSelector'
import { FontSelector } from './FontSelector'
import { ThemeSelector } from './ThemeSelector'
import { useViewerPreferencesContext } from './ViewerPreferencesProvider'
import { DepthLevel, FontFamily, ThemeName } from './viewerPrefsConfig'

interface ViewerPreferencesOnboardingProps {
  onComplete: () => void
}

const STEPS = ['depth', 'font', 'theme'] as const
type Step = typeof STEPS[number]

const STEP_TITLES: Record<Step, string> = {
  depth: 'How much detail do you prefer?',
  font: 'Choose your reading style',
  theme: 'Pick a color scheme'
}

export function ViewerPreferencesOnboarding({ onComplete }: ViewerPreferencesOnboardingProps) {
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    preferences,
    updateDepth,
    updateFont,
    updateTheme,
    markOnboardingComplete
  } = useViewerPreferencesContext()

  const [currentStep, setCurrentStep] = useState(0)
  const isLastStep = currentStep === STEPS.length - 1

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1)
          }
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          if (currentStep > 0) {
            setCurrentStep(prev => prev - 1)
          }
          break
        case 'Escape':
          handleSkip()
          break
        case 'Enter':
          if (isLastStep) {
            handleComplete()
          } else {
            setCurrentStep(prev => prev + 1)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStep, isLastStep])

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

  const handleSkip = useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [markOnboardingComplete, onComplete])

  const handleComplete = useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [markOnboardingComplete, onComplete])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }, [isLastStep, handleComplete])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleDepthChange = useCallback((depth: DepthLevel) => {
    updateDepth(depth)
  }, [updateDepth])

  const handleFontChange = useCallback((font: FontFamily) => {
    updateFont(font)
  }, [updateFont])

  const handleThemeChange = useCallback((theme: ThemeName) => {
    updateTheme(theme)
  }, [updateTheme])

  const currentStepName = STEPS[currentStep]

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Customize your reading experience"
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-50 bg-background',
        'flex flex-col min-h-screen',
        'outline-none'
      )}
    >
      {/* Atmospheric glow */}
      <GlowPulse className="w-96 h-96 -top-48 -left-48" />
      <GlowPulse className="w-80 h-80 -bottom-40 -right-40" color="purple" />

      {/* Progress bars */}
      <ProgressBars currentIndex={currentStep} total={STEPS.length} />

      {/* Skip button */}
      <div className="absolute top-16 right-5 z-10">
        <button
          onClick={handleSkip}
          className={cn(
            'px-4 py-2 text-sm font-medium text-muted',
            'hover:text-foreground transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-accent',
            'min-h-[44px] min-w-[44px]'
          )}
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Step title */}
        <motion.h2
          key={currentStepName}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          className="text-2xl md:text-3xl font-display text-foreground text-center mb-8"
        >
          {STEP_TITLES[currentStepName]}
        </motion.h2>

        {/* Preview response - always visible */}
        <div className="w-full mb-8">
          <PreviewResponse
            depth={preferences.depth}
            fontFamily={preferences.fontFamily}
            theme={preferences.theme}
          />
        </div>

        {/* Step-specific selector */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepName}
            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {currentStepName === 'depth' && (
              <DepthSelector
                value={preferences.depth}
                onChange={handleDepthChange}
              />
            )}
            {currentStepName === 'font' && (
              <FontSelector
                value={preferences.fontFamily}
                onChange={handleFontChange}
              />
            )}
            {currentStepName === 'theme' && (
              <ThemeSelector
                value={preferences.theme}
                onChange={handleThemeChange}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="px-8 pb-12 flex items-center justify-between max-w-2xl mx-auto w-full">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg',
            'transition-colors min-h-[44px]',
            currentStep === 0
              ? 'text-muted cursor-not-allowed'
              : 'text-foreground hover:bg-background-elevated'
          )}
        >
          Back
        </button>

        <button
          onClick={handleNext}
          className={cn(
            'px-6 py-3 text-base font-semibold rounded-xl',
            'bg-accent text-background',
            'hover:bg-accent/90 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
            'min-h-[44px]'
          )}
        >
          {isLastStep ? "Let's go" : 'Next'}
        </button>
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite">
        Step {currentStep + 1} of {STEPS.length}: {STEP_TITLES[currentStepName]}
      </div>
    </div>
  )
}
