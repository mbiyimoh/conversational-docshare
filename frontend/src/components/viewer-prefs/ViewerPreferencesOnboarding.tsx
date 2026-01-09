import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { GlowPulse } from '../ui'
import { ProgressBars } from '../onboarding/ProgressBars'
import { PreviewResponse } from './PreviewResponse'
import { DepthSelector } from './DepthSelector'
import { FontSelector } from './FontSelector'
import { ThemeSelector } from './ThemeSelector'
import { CollaboratorFeatureSlide } from './CollaboratorFeatureSlide'
import { useViewerPreferencesContext } from './ViewerPreferencesProvider'
import { DepthLevel, FontFamily, FontSize, ThemeName } from './viewerPrefsConfig'

interface ViewerPreferencesOnboardingProps {
  onComplete: () => void
  isCollaborator?: boolean
}

const STEPS_BASE = ['depth', 'font', 'theme'] as const
const STEPS_COLLABORATOR = ['depth', 'font', 'theme', 'collaboration'] as const
type Step = 'depth' | 'font' | 'theme' | 'collaboration'

const STEP_TITLES: Record<Step, string> = {
  depth: 'How much detail do you prefer?',
  font: 'Choose your reading style',
  theme: 'Pick a color scheme',
  collaboration: 'Leave feedback on documents'
}

export function ViewerPreferencesOnboarding({ onComplete, isCollaborator = false }: ViewerPreferencesOnboardingProps) {
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    preferences,
    updateDepth,
    updateFont,
    updateFontSize,
    updateTheme,
    markOnboardingComplete
  } = useViewerPreferencesContext()

  // Determine steps based on collaborator status
  const STEPS = useMemo(() =>
    isCollaborator ? STEPS_COLLABORATOR : STEPS_BASE,
    [isCollaborator]
  )

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

  const handleFontSizeChange = useCallback((fontSize: FontSize) => {
    updateFontSize(fontSize)
  }, [updateFontSize])

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
        'flex flex-col h-screen',
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

      {/* Main content - scrollable (includes navigation buttons) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col items-center min-h-full px-4 py-6 md:py-8 max-w-2xl mx-auto w-full">
          {/* Content wrapper - use justify-start on mobile to ensure scrollability, center on desktop */}
          <div className="flex-1 flex flex-col items-center justify-start md:justify-center w-full">
            {/* Step title */}
            <motion.h2
              key={currentStepName}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
              className="text-xl md:text-3xl font-display text-foreground text-center mb-4 md:mb-8"
            >
              {STEP_TITLES[currentStepName]}
            </motion.h2>

            {/* Preview response - visible except on collaboration step */}
            {currentStepName !== 'collaboration' && (
              <div className="w-full mb-4 md:mb-6">
                <PreviewResponse
                  depth={preferences.depth}
                  fontFamily={preferences.fontFamily}
                  fontSize={preferences.fontSize}
                  theme={preferences.theme}
                />
              </div>
            )}

            {/* Note for depth step */}
            {currentStepName === 'depth' && (
              <p className="text-xs text-muted text-center mb-4 md:mb-6 max-w-md">
                You can always ask for more or less detail in any conversation.
              </p>
            )}

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
                    fontSize={preferences.fontSize}
                    onChange={handleFontChange}
                    onFontSizeChange={handleFontSizeChange}
                  />
                )}
                {currentStepName === 'theme' && (
                  <ThemeSelector
                    value={preferences.theme}
                    onChange={handleThemeChange}
                  />
                )}
                {currentStepName === 'collaboration' && (
                  <CollaboratorFeatureSlide />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Spacer - grows on desktop to push nav down, fixed on mobile for scrollability */}
          <div className="h-4 md:flex-grow md:h-0" />

          {/* Bottom navigation - inside scroll area */}
          <div className="flex-shrink-0 w-full pt-4 md:pt-6 pb-4 md:pb-6 flex items-center justify-between">
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
        </div>
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite">
        Step {currentStep + 1} of {STEPS.length}: {STEP_TITLES[currentStepName]}
      </div>
    </div>
  )
}
