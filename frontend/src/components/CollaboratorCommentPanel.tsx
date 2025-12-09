import { useState } from 'react'

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
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-80"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header with highlighted text preview */}
      <div className="px-4 py-3 border-b bg-yellow-50">
        <div className="text-xs text-gray-500 mb-1">Commenting on:</div>
        <div className="text-sm text-gray-700 italic line-clamp-2">
          "{selectedText}"
        </div>
      </div>

      {/* Comment input */}
      <div className="p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your comment..."
          className="w-full h-24 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        {error && (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  )
}
