import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'
import type { FeedbackStatus, FeedbackItem } from '../../types/feedback'
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_DISPLAY_NAMES,
  FEEDBACK_STATUS_COLORS,
} from '../../types/feedback'

interface FeedbackStatusDropdownProps {
  feedbackId: string
  currentStatus: FeedbackStatus
  isAdmin: boolean
  onUpdate?: (feedback: FeedbackItem) => void
}

export function FeedbackStatusDropdown({
  feedbackId,
  currentStatus,
  isAdmin,
  onUpdate,
}: FeedbackStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [isLoading, setIsLoading] = useState(false)

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (newStatus === status || isLoading) return

    setIsOpen(false)
    setIsLoading(true)

    // Optimistic update
    const previousStatus = status
    setStatus(newStatus)

    try {
      const response = await api.updateFeedbackStatus(feedbackId, newStatus)
      onUpdate?.(response.feedback)
    } catch {
      // Rollback on error
      setStatus(previousStatus)
    } finally {
      setIsLoading(false)
    }
  }

  const statusColor = FEEDBACK_STATUS_COLORS[status]

  // Non-admin: just show badge
  if (!isAdmin) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
      >
        {FEEDBACK_STATUS_DISPLAY_NAMES[status]}
      </span>
    )
  }

  // Admin: interactive dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
          'transition-all hover:ring-1 hover:ring-white/20',
          isLoading && 'opacity-50'
        )}
        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
      >
        {FEEDBACK_STATUS_DISPLAY_NAMES[status]}
        <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute top-full left-0 mt-1 z-50',
                'bg-card-bg border border-border rounded-lg shadow-xl',
                'py-1 min-w-[120px]'
              )}
            >
              {FEEDBACK_STATUSES.map((s) => {
                const color = FEEDBACK_STATUS_COLORS[s]
                const isActive = s === status

                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={cn(
                      'w-full px-3 py-1.5 text-left text-xs transition-colors',
                      'flex items-center gap-2',
                      isActive ? 'bg-white/5' : 'hover:bg-white/5'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span style={{ color: isActive ? color : undefined }}>
                      {FEEDBACK_STATUS_DISPLAY_NAMES[s]}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
