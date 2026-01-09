'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { UpvoteButton } from './UpvoteButton'
import { formatDistanceToNow } from 'date-fns'
import { Bug, Sparkles, Lightbulb, HelpCircle, Paperclip } from 'lucide-react'

interface FeedbackCardProps {
  feedback: {
    id: string
    title: string
    description: string
    area: string
    type: string
    status: string
    upvoteCount: number
    hasUserUpvoted: boolean
    createdAt: string
    user: {
      name: string | null
      email: string
      avatarUrl?: string | null
    }
    attachments: Array<{ url: string; filename: string }>
  }
}

const typeIcons = {
  BUG: Bug,
  ENHANCEMENT: Sparkles,
  IDEA: Lightbulb,
  QUESTION: HelpCircle
}

const typeColors = {
  BUG: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ENHANCEMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IDEA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  QUESTION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
}

const statusColors = {
  OPEN: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  IN_REVIEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PLANNED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  IN_PROGRESS: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  COMPLETED: 'bg-green-600 text-white',
  CLOSED: 'bg-gray-400 text-white dark:bg-gray-600'
}

// CUSTOMIZE: Update these labels to match your FeedbackArea enum
const areaLabels: Record<string, string> = {
  NODE_TREE_UI: 'Node Tree UI',
  MAIN_AI_CHAT: 'Main AI Chat',
  COMPASS: 'Compass',
  SCOPE_TOOL: 'Scope Tool',
  OTHER: 'Other'
}

/**
 * Feedback card component
 * Displays a single feedback item with voting, badges, and metadata
 */
export function FeedbackCard({ feedback }: FeedbackCardProps) {
  const TypeIcon = typeIcons[feedback.type as keyof typeof typeIcons] || HelpCircle

  return (
    <Card className="hover:shadow-md transition-shadow feedback-card">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Upvote Section */}
          <UpvoteButton
            feedbackId={feedback.id}
            initialUpvotes={feedback.upvoteCount}
            initialHasUpvoted={feedback.hasUserUpvoted}
          />

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-lg leading-tight">
                {feedback.title}
              </h3>
              <div className="flex gap-2 shrink-0">
                <Badge className={typeColors[feedback.type as keyof typeof typeColors]}>
                  <TypeIcon className="mr-1 h-3 w-3" />
                  {feedback.type}
                </Badge>
                <Badge className={statusColors[feedback.status as keyof typeof statusColors]}>
                  {feedback.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {feedback.description}
            </p>

            {/* Attachments */}
            {feedback.attachments.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {feedback.attachments.map((attachment, i) => (
                  <a
                    key={i}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Paperclip className="h-3 w-3" />
                    {attachment.filename}
                  </a>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarImage src={feedback.user.avatarUrl || undefined} />
                <AvatarFallback>
                  {(feedback.user.name || feedback.user.email)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">
                {feedback.user.name || feedback.user.email}
              </span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}</span>
              <span>•</span>
              <Badge variant="outline" className="text-xs">
                {areaLabels[feedback.area] || feedback.area}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
