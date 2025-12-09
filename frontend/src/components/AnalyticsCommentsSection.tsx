import { useState } from 'react'
import { api } from '../lib/api'

interface DocumentComment {
  id: string
  highlightedText: string
  content: string
  viewerName: string | null
  viewerEmail: string | null
  status: string
  createdAt: string
}

interface AnalyticsCommentsSectionProps {
  conversationId: string
  comments: DocumentComment[]
  isOwner: boolean
  onStatusUpdate?: (commentId: string, status: string) => void
}

export function AnalyticsCommentsSection({
  comments,
  isOwner,
  onStatusUpdate,
}: AnalyticsCommentsSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (commentId: string, newStatus: string) => {
    try {
      setUpdating(commentId)
      await api.updateCommentStatus(
        commentId,
        newStatus as 'pending' | 'addressed' | 'dismissed'
      )
      onStatusUpdate?.(commentId, newStatus)
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (comments.length === 0) return null

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Document Comments ({comments.length})
      </h4>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1 italic">
              "{comment.highlightedText.slice(0, 80)}..."
            </div>
            <div className="text-sm text-gray-800 mb-2">
              {comment.content}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {comment.viewerName || comment.viewerEmail || 'Anonymous'}
              </span>
              {isOwner && (
                <select
                  value={comment.status}
                  onChange={(e) => handleStatusChange(comment.id, e.target.value)}
                  disabled={updating === comment.id}
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value="pending">Pending</option>
                  <option value="addressed">Addressed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
