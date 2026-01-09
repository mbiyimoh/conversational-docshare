import { Bug, Sparkles, Lightbulb, HelpCircle } from 'lucide-react'
import { Card } from '../ui/card'
import { UpvoteButton } from './UpvoteButton'
import { FeedbackStatusDropdown } from './FeedbackStatusDropdown'
import type { FeedbackItem, FeedbackType } from '../../types/feedback'
import {
  FEEDBACK_AREA_DISPLAY_NAMES,
  FEEDBACK_TYPE_DISPLAY_NAMES,
} from '../../types/feedback'

interface FeedbackCardProps {
  feedback: FeedbackItem
  isAdmin: boolean
  onUpdate?: (feedback: FeedbackItem) => void
}

const TYPE_ICONS: Record<FeedbackType, React.ReactNode> = {
  BUG: <Bug size={14} />,
  ENHANCEMENT: <Sparkles size={14} />,
  IDEA: <Lightbulb size={14} />,
  QUESTION: <HelpCircle size={14} />,
}

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: '#ef4444',
  ENHANCEMENT: '#8b5cf6',
  IDEA: '#f59e0b',
  QUESTION: '#3b82f6',
}

export function FeedbackCard({ feedback, isAdmin, onUpdate }: FeedbackCardProps) {
  const typeColor = TYPE_COLORS[feedback.type]
  const formattedDate = new Date(feedback.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const handleVoteUpdate = (count: number, hasUpvoted: boolean) => {
    onUpdate?.({
      ...feedback,
      upvoteCount: count,
      hasUserUpvoted: hasUpvoted,
    })
  }

  return (
    <Card className="p-4 hover:border-border/60 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type badge */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
          >
            {TYPE_ICONS[feedback.type]}
            {FEEDBACK_TYPE_DISPLAY_NAMES[feedback.type]}
          </span>

          {/* Status dropdown */}
          <FeedbackStatusDropdown
            feedbackId={feedback.id}
            currentStatus={feedback.status}
            isAdmin={isAdmin}
            onUpdate={onUpdate}
          />
        </div>

        {/* Upvote button */}
        <UpvoteButton
          feedbackId={feedback.id}
          initialCount={feedback.upvoteCount}
          initialHasUpvoted={feedback.hasUserUpvoted}
          onUpdate={handleVoteUpdate}
        />
      </div>

      {/* Title */}
      <h3 className="font-display text-foreground text-base mb-2">
        {feedback.title}
      </h3>

      {/* Description */}
      <p className="text-muted text-sm mb-3 line-clamp-3">
        {feedback.description}
      </p>

      {/* Areas */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {feedback.areas.map((area) => (
          <span
            key={area}
            className="px-2 py-0.5 bg-white/5 rounded text-xs text-muted"
          >
            {FEEDBACK_AREA_DISPLAY_NAMES[area]}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          by {feedback.user.name || feedback.user.email.split('@')[0]}
        </span>
        <span>{formattedDate}</span>
      </div>
    </Card>
  )
}
