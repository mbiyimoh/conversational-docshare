import { motion, useReducedMotion } from 'framer-motion'
import { OnboardingIcon } from './onboardingIcons'
import type { OnboardingSlideData } from './onboardingContent'

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
