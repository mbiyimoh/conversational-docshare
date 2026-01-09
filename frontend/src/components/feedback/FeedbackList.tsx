import { useState } from 'react'
import { motion } from 'framer-motion'
import { Filter, SortAsc } from 'lucide-react'
import { Button } from '../ui/button'
import { FeedbackCard } from './FeedbackCard'
import { cn } from '../../lib/utils'
import type {
  FeedbackItem,
  FeedbackArea,
  FeedbackType,
  FeedbackStatus,
  ListFeedbackParams,
} from '../../types/feedback'
import {
  FEEDBACK_AREAS,
  FEEDBACK_TYPES,
  FEEDBACK_STATUSES,
  FEEDBACK_AREA_DISPLAY_NAMES,
  FEEDBACK_TYPE_DISPLAY_NAMES,
  FEEDBACK_STATUS_DISPLAY_NAMES,
} from '../../types/feedback'

interface FeedbackListProps {
  feedback: FeedbackItem[]
  isLoading: boolean
  hasMore: boolean
  isAdmin: boolean
  onLoadMore: () => void
  onFilterChange: (params: ListFeedbackParams) => void
  onFeedbackUpdate: (feedback: FeedbackItem) => void
  currentFilters: ListFeedbackParams
}

type SortOption = 'popular' | 'recent' | 'oldest'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
]

export function FeedbackList({
  feedback,
  isLoading,
  hasMore,
  isAdmin,
  onLoadMore,
  onFilterChange,
  onFeedbackUpdate,
  currentFilters,
}: FeedbackListProps) {
  const [showFilters, setShowFilters] = useState(false)

  const handleSortChange = (sort: SortOption) => {
    onFilterChange({ ...currentFilters, sort, cursor: undefined })
  }

  const handleAreaChange = (area: FeedbackArea | undefined) => {
    onFilterChange({ ...currentFilters, area, cursor: undefined })
  }

  const handleTypeChange = (type: FeedbackType | undefined) => {
    onFilterChange({ ...currentFilters, type, cursor: undefined })
  }

  const handleStatusChange = (status: FeedbackStatus | undefined) => {
    onFilterChange({ ...currentFilters, status, cursor: undefined })
  }

  const hasActiveFilters =
    currentFilters.area || currentFilters.type || currentFilters.status

  return (
    <div className="space-y-4">
      {/* Sort and Filter Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <SortAsc size={16} className="text-muted" />
          <select
            value={currentFilters.sort || 'popular'}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className={cn(
              'bg-transparent border border-border rounded-lg',
              'px-3 py-1.5 text-sm text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-accent'
            )}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter toggle */}
        <Button
          variant={hasActiveFilters ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={14} className="mr-1.5" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-accent/20 text-accent rounded text-xs">
              Active
            </span>
          )}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 bg-card-bg border border-border rounded-lg space-y-4"
        >
          {/* Area filter */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">
              Area
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleAreaChange(undefined)}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-colors',
                  !currentFilters.area
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/5 text-muted hover:text-foreground'
                )}
              >
                All
              </button>
              {FEEDBACK_AREAS.map((area) => (
                <button
                  key={area}
                  onClick={() => handleAreaChange(area)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    currentFilters.area === area
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-muted hover:text-foreground'
                  )}
                >
                  {FEEDBACK_AREA_DISPLAY_NAMES[area]}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleTypeChange(undefined)}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-colors',
                  !currentFilters.type
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/5 text-muted hover:text-foreground'
                )}
              >
                All
              </button>
              {FEEDBACK_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    currentFilters.type === type
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-muted hover:text-foreground'
                  )}
                >
                  {FEEDBACK_TYPE_DISPLAY_NAMES[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleStatusChange(undefined)}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-colors',
                  !currentFilters.status
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/5 text-muted hover:text-foreground'
                )}
              >
                All
              </button>
              {FEEDBACK_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    currentFilters.status === status
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-muted hover:text-foreground'
                  )}
                >
                  {FEEDBACK_STATUS_DISPLAY_NAMES[status]}
                </button>
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onFilterChange({ sort: currentFilters.sort, cursor: undefined })
              }
            >
              Clear all filters
            </Button>
          )}
        </motion.div>
      )}

      {/* Feedback list */}
      <div className="space-y-3">
        {feedback.map((item) => (
          <FeedbackCard
            key={item.id}
            feedback={item}
            isAdmin={isAdmin}
            onUpdate={onFeedbackUpdate}
          />
        ))}

        {/* Empty state */}
        {!isLoading && feedback.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted">No feedback found</p>
            {hasActiveFilters && (
              <p className="text-sm text-muted mt-1">
                Try adjusting your filters
              </p>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {/* Load more button */}
        {hasMore && !isLoading && (
          <div className="text-center pt-4">
            <Button variant="secondary" onClick={onLoadMore}>
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
