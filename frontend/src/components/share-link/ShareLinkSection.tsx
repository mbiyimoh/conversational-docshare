import { useState, ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ShareLinkSectionProps {
  number: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/**
 * Collapsible section component for ShareLinkManager
 * Follows 33 Strategies design system with numbered sections
 */
export function ShareLinkSection({
  number,
  title,
  children,
  defaultOpen = true,
  className,
}: ShareLinkSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card-bg/50 backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-accent tracking-wider">
            {number}
          </span>
          <span className="text-dim">—</span>
          <span className="text-sm font-mono uppercase tracking-wider text-foreground">
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted" />
        )}
      </button>

      {/* Section Content */}
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  )
}
