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
        return 'bg-green-100 text-green-800'
      case 'dismissed':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-yellow-100 text-yellow-800'
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
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No comments yet
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => onCommentClick(comment)}
              >
                {/* Highlighted text */}
                <div className="text-xs text-gray-500 mb-1">
                  "{comment.highlightedText.slice(0, 50)}..."
                </div>

                {/* Comment content */}
                <div className="text-sm text-gray-800 mb-2">
                  {comment.content}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {comment.viewerName || comment.viewerEmail || 'Anonymous'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded ${getStatusColor(comment.status)}`}
                    >
                      {comment.status}
                    </span>
                    <span className="text-gray-400">
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
