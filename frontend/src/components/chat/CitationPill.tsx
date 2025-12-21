/**
 * CitationPill Component
 *
 * Compact inline citation marker [1] that doesn't disrupt reading flow.
 * Part of the Perplexity-style citation system for document references.
 */

import { cn } from '../../lib/utils'

interface CitationPillProps {
  /** Citation number (1-based) */
  number: number
  /** Click handler for navigation */
  onClick?: () => void
  /** Whether this is in a user message (affects styling) */
  isUserMessage?: boolean
  /** Whether citation is currently highlighted/active */
  isActive?: boolean
}

export function CitationPill({
  number,
  onClick,
  isUserMessage = false,
  isActive = false,
}: CitationPillProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        // Base styles - compact, inline, non-disruptive
        'inline-flex items-center justify-center',
        'min-w-[1.25em] h-[1.25em] px-0.5',
        'text-[0.75em] font-medium leading-none',
        'rounded align-baseline',
        'transition-all duration-150',
        'hover:scale-110 focus:outline-none focus:ring-1 focus:ring-offset-1',
        // Position adjustment to align with text baseline
        'relative -top-[0.1em]',
        // Color variants
        isUserMessage
          ? cn(
              'bg-background/25 text-background',
              'hover:bg-background/40',
              'focus:ring-background/50 focus:ring-offset-accent'
            )
          : cn(
              'bg-accent/20 text-accent',
              'hover:bg-accent/30',
              'focus:ring-accent/50 focus:ring-offset-background',
              isActive && 'bg-accent/40 ring-1 ring-accent/50'
            )
      )}
      title={`View source ${number}`}
      aria-label={`Citation ${number}`}
    >
      {number}
    </button>
  )
}
