import { useState } from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'

interface UpvoteButtonProps {
  feedbackId: string
  initialCount: number
  initialHasUpvoted: boolean
  onUpdate?: (count: number, hasUpvoted: boolean) => void
}

export function UpvoteButton({
  feedbackId,
  initialCount,
  initialHasUpvoted,
  onUpdate,
}: UpvoteButtonProps) {
  const [upvotes, setUpvotes] = useState(initialCount)
  const [hasUpvoted, setHasUpvoted] = useState(initialHasUpvoted)
  const [isLoading, setIsLoading] = useState(false)

  const handleVote = async () => {
    if (isLoading) return

    // Capture previous state for rollback
    const previousUpvotes = upvotes
    const previousHasUpvoted = hasUpvoted

    // Optimistic update
    const newHasUpvoted = !hasUpvoted
    setHasUpvoted(newHasUpvoted)
    setUpvotes(newHasUpvoted ? upvotes + 1 : Math.max(0, upvotes - 1))

    setIsLoading(true)
    try {
      const response = await api.toggleFeedbackVote(
        feedbackId,
        newHasUpvoted ? 'upvote' : 'remove'
      )
      // Sync with server (handles race conditions)
      setUpvotes(response.upvoteCount)
      setHasUpvoted(response.hasUserUpvoted)
      onUpdate?.(response.upvoteCount, response.hasUserUpvoted)
    } catch {
      // Rollback on error
      setUpvotes(previousUpvotes)
      setHasUpvoted(previousHasUpvoted)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.button
      onClick={handleVote}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
        'border text-sm font-medium',
        hasUpvoted
          ? 'bg-accent/10 border-accent/30 text-accent'
          : 'bg-transparent border-border text-muted hover:text-foreground hover:border-border/60'
      )}
      whileTap={{ scale: 0.95 }}
    >
      <ThumbsUp
        size={14}
        className={cn(
          'transition-all',
          hasUpvoted && 'fill-current'
        )}
      />
      <span>{upvotes}</span>
    </motion.button>
  )
}
