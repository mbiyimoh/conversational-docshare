import { useState } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

interface CollaboratorCommentPanelProps {
  documentId: string
  conversationId: string
  selectedText: string
  selectionRange: { chunkId: string; start: number; end: number }
  position: { x: number; y: number }
  viewerEmail?: string
  viewerName?: string
  onSubmit: (content: string) => Promise<void>
  onCancel: () => void
}

export function CollaboratorCommentPanel({
  selectedText,
  position,
  onSubmit,
  onCancel,
}: CollaboratorCommentPanelProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Comment cannot be empty')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      await onSubmit(content.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="absolute z-50 w-80 p-4 bg-card-bg backdrop-blur-sm border border-border rounded-lg shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header with highlighted text preview */}
      <div className="mb-4 pb-3 border-b border-border">
        <div className="text-xs font-mono text-accent mb-1.5 uppercase tracking-wider">Commenting on:</div>
        <div className="text-sm font-body text-muted italic line-clamp-2">
          "{selectedText}"
        </div>
      </div>

      {/* Comment input */}
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your comment..."
          className="h-24"
          autoFocus
          error={error}
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-3">
          <Button
            onClick={onCancel}
            disabled={submitting}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            size="sm"
            isLoading={submitting}
          >
            {submitting ? 'Submitting...' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}
