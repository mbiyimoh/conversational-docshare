import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface GlowPulseProps {
  className?: string
  color?: 'accent' | 'purple' | 'info'
}

export function GlowPulse({ className, color = 'accent' }: GlowPulseProps) {
  const prefersReducedMotion = useReducedMotion()

  const colorMap = {
    accent: 'bg-accent',
    purple: 'bg-purple',
    info: 'bg-info',
  }

  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          'absolute rounded-full blur-3xl opacity-15',
          colorMap[color],
          className
        )}
      />
    )
  }

  return (
    <motion.div
      className={cn(
        'absolute rounded-full blur-3xl opacity-15',
        colorMap[color],
        className
      )}
      animate={{
        opacity: [0.3, 0.15, 0.3],
        scale: [1, 1.05, 1]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
    />
  )
}
