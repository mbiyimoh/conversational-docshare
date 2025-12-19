import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface JumpToBottomIndicatorProps {
  visible: boolean
  unreadCount?: number
  onClick: () => void
}

export function JumpToBottomIndicator({
  visible,
  unreadCount = 0,
  onClick
}: JumpToBottomIndicatorProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.button
            onClick={onClick}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full',
              'bg-background-elevated border border-border',
              'text-sm font-medium text-foreground',
              'shadow-lg cursor-pointer',
              'hover:bg-background-elevated/80 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
              'min-h-[44px]' // Touch target
            )}
            // Breathing glow animation
            animate={prefersReducedMotion ? {} : {
              boxShadow: [
                '0 0 0 0 hsl(var(--color-accent) / 0)',
                '0 0 20px 4px hsl(var(--color-accent) / 0.3)',
                '0 0 0 0 hsl(var(--color-accent) / 0)'
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <ChevronDown className="w-4 h-4" />
            <span>
              {unreadCount > 0
                ? `${unreadCount} new`
                : 'Jump to latest'
              }
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
