/**
 * Feedback List Component
 *
 * Displays a list of feedback items with sort/filter controls.
 * Handles loading states, empty states, and pagination.
 */

'use client'

import { useState, useEffect } from 'react'
import { FeedbackCard } from './FeedbackCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { FeedbackArea, FeedbackType } from '@/lib/validation'

interface FeedbackListProps {
  refreshTrigger?: number
}

interface FeedbackItem {
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

export function FeedbackList({ refreshTrigger }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'oldest'>('popular')
  const [filterArea, setFilterArea] = useState<FeedbackArea | 'ALL'>('ALL')
  const [filterType, setFilterType] = useState<FeedbackType | 'ALL'>('ALL')

  const fetchFeedback = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        sort: sortBy
      })

      if (filterArea !== 'ALL') {
        params.append('area', filterArea)
      }

      if (filterType !== 'ALL') {
        params.append('type', filterType)
      }

      const res = await fetch(`/api/feedback?${params.toString()}`)

      if (!res.ok) {
        throw new Error('Failed to fetch feedback')
      }

      const data = await res.json()
      setFeedback(data.feedback)

    } catch (error) {
      console.error('Failed to load feedback:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [sortBy, filterArea, filterType, refreshTrigger])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-sm font-medium">
            Sort by:
          </label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger id="sort-select" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="area-filter" className="text-sm font-medium">
            Area:
          </label>
          <Select value={filterArea} onValueChange={(value) => setFilterArea(value as typeof filterArea)}>
            <SelectTrigger id="area-filter" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Areas</SelectItem>
              {/* CUSTOMIZE: Update these to match your FeedbackArea enum */}
              <SelectItem value="NODE_TREE_UI">Node Tree UI</SelectItem>
              <SelectItem value="MAIN_AI_CHAT">Main AI Chat</SelectItem>
              <SelectItem value="COMPASS">Compass</SelectItem>
              <SelectItem value="SCOPE_TOOL">Scope Tool</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="type-filter" className="text-sm font-medium">
            Type:
          </label>
          <Select value={filterType} onValueChange={(value) => setFilterType(value as typeof filterType)}>
            <SelectTrigger id="type-filter" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="BUG">Bug</SelectItem>
              <SelectItem value="ENHANCEMENT">Enhancement</SelectItem>
              <SelectItem value="IDEA">Idea</SelectItem>
              <SelectItem value="QUESTION">Question</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Badge variant="secondary" className="ml-auto">
          {feedback.length} {feedback.length === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      {/* Feedback List */}
      {feedback.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No feedback found. Be the first to submit feedback!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <FeedbackCard key={item.id} feedback={item} />
          ))}
        </div>
      )}
    </div>
  )
}
