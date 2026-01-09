import { motion } from 'framer-motion'
import { MessageSquarePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface FeedbackButtonProps {
  context: 'creator' | 'viewer'
  className?: string
}

/**
 * Context-aware sticky feedback button
 * - Creator views: bottom-left fixed
 * - Viewer views: bottom-right fixed (within document panel)
 * - On click: navigates to /feedback page
 */
export function FeedbackButton({ context, className }: FeedbackButtonProps) {
  const navigate = useNavigate()

  const positionClasses = context === 'creator'
    ? 'fixed bottom-6 left-6 z-50'
    : 'fixed bottom-6 right-6 z-50'

  return (
    <motion.button
      onClick={() => navigate('/feedback')}
      className={cn(
        positionClasses,
        'flex items-center gap-2 px-4 py-2.5 rounded-full',
        'bg-card-bg border border-border shadow-lg',
        'text-muted hover:text-foreground hover:border-accent/50',
        'transition-colors',
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.3 }}
    >
      <MessageSquarePlus size={18} />
      <span className="text-sm font-medium">Feedback</span>
    </motion.button>
  )
}

/**
 * Compact icon-only feedback button for mobile headers
 */
export function FeedbackIconButton({
  onClick,
  className,
}: {
  onClick?: () => void
  className?: string
}) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate('/feedback')
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'p-2 rounded-lg',
        'text-muted hover:text-foreground hover:bg-white/5',
        'transition-colors',
        className
      )}
      aria-label="Submit feedback"
    >
      <MessageSquarePlus size={20} />
    </button>
  )
}
