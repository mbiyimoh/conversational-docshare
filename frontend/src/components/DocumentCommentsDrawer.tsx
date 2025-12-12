interface DocumentComment {
  id: string
  chunkId: string
  startOffset: number
  endOffset: number
  highlightedText: string
  content: string
  viewerEmail: string | null
  viewerName: string | null
  status: string
  createdAt: string
}

interface DocumentCommentsDrawerProps {
  documentId: string
  comments: DocumentComment[]
  isOpen: boolean
  onCommentClick: (comment: DocumentComment) => void
  onClose: () => void
}

export function DocumentCommentsDrawer({
  comments,
  isOpen,
  onCommentClick,
  onClose,
}: DocumentCommentsDrawerProps) {
  if (!isOpen) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'addressed':
        return 'bg-success/10 text-success'
      case 'dismissed':
        return 'bg-white/5 text-dim'
      default:
        return 'bg-accent/10 text-accent'
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-80 bg-background-elevated border-l border-border shadow-xl z-50 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-medium text-foreground">Comments ({comments.length})</h3>
          <button
            onClick={onClose}
            className="text-dim hover:text-muted transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {comments.length === 0 ? (
            <div className="text-center text-muted py-8">
              No comments yet
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-card-bg rounded-lg border border-border p-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => onCommentClick(comment)}
              >
                {/* Highlighted text */}
                <div className="text-xs text-dim mb-1">
                  "{comment.highlightedText.slice(0, 50)}..."
                </div>

                {/* Comment content */}
                <div className="text-sm text-foreground mb-2">
                  {comment.content}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {comment.viewerName || comment.viewerEmail || 'Anonymous'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded ${getStatusColor(comment.status)}`}
                    >
                      {comment.status}
                    </span>
                    <span className="text-dim">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
