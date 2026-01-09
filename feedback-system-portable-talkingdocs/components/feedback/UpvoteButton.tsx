'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface UpvoteButtonProps {
  feedbackId: string
  initialUpvotes: number
  initialHasUpvoted: boolean
  onUpdate?: (upvotes: number, hasUpvoted: boolean) => void
}

/**
 * Upvote button component
 *
 * Handles vote toggling with optimistic UI updates.
 * Redirects to login if not authenticated.
 *
 * CUSTOMIZE: Update the useAuth import to match your auth hook location.
 * Your auth hook should return { user } where user is null if not logged in.
 */
export function UpvoteButton({
  feedbackId,
  initialUpvotes,
  initialHasUpvoted,
  onUpdate
}: UpvoteButtonProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [hasUpvoted, setHasUpvoted] = useState(initialHasUpvoted)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const handleVote = async () => {
    if (!user) {
      toast.error('Please sign in to upvote')
      router.push('/login')  // CUSTOMIZE: Update to your login route
      return
    }

    setIsLoading(true)

    // Capture current state BEFORE optimistic update
    const previousUpvotes = upvotes
    const previousHasUpvoted = hasUpvoted

    // Optimistic update
    const newHasUpvoted = !hasUpvoted
    const newUpvotes = newHasUpvoted ? upvotes + 1 : upvotes - 1
    setHasUpvoted(newHasUpvoted)
    setUpvotes(newUpvotes)

    try {
      const res = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: newHasUpvoted ? 'upvote' : 'remove'
        })
      })

      if (!res.ok) throw new Error('Failed to vote')

      const data = await res.json()
      // Sync with server state (handles race conditions)
      setUpvotes(data.upvoteCount)
      setHasUpvoted(data.hasUserUpvoted)
      onUpdate?.(data.upvoteCount, data.hasUserUpvoted)

    } catch {
      // Rollback to previous state (not initial props)
      setHasUpvoted(previousHasUpvoted)
      setUpvotes(previousUpvotes)
      toast.error('Failed to update vote')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={hasUpvoted ? 'default' : 'outline'}
        size="icon"
        onClick={handleVote}
        disabled={isLoading}
        className="h-10 w-10"
        aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote'}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium tabular-nums">
        {upvotes}
      </span>
    </div>
  )
}
