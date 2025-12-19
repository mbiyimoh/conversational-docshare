import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ChatExpandButtonProps {
  onClick: () => void
  disabled?: boolean
  isLoading?: boolean
}

export function ChatExpandButton({
  onClick,
  disabled = false,
  isLoading = false
}: ChatExpandButtonProps) {
  const prefersReducedMotion = useReducedMotion()

  if (disabled && !isLoading) return null

  return (
    <motion.button
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.2 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'flex items-center gap-1.5 mt-3 px-3 py-1.5',
        'text-xs font-medium text-muted',
        'rounded-md border border-border',
        'hover:text-foreground hover:border-accent/50 hover:bg-accent/5',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border border-muted border-t-accent" />
          <span>Expanding...</span>
        </>
      ) : (
        <>
          <ChevronDown className="w-3 h-3" />
          <span>Expand on that</span>
        </>
      )}
    </motion.button>
  )
}
