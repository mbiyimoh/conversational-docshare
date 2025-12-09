import type { TestMessage } from '../../types/testing'

/**
 * Strip markdown and JSON formatting for clean preview text
 */
function getPreviewText(content: string, maxLength = 100): string {
  return content
    // Remove markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove JSON-like patterns
    .replace(/[{}[\]"]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength)
}

const TEMPLATE_LABELS: Record<string, { icon: string; label: string }> = {
  identity: { icon: '👤', label: 'Identity/Role' },
  communication: { icon: '💬', label: 'Communication' },
  content: { icon: '📋', label: 'Content' },
  engagement: { icon: '🎯', label: 'Engagement' },
  framing: { icon: '🖼️', label: 'Framing' },
}

interface CommentSidebarProps {
  messages: TestMessage[]
  onScrollToMessage: (messageId: string) => void
  onDeleteComment: (commentId: string) => void
}

export function CommentSidebar({
  messages,
  onScrollToMessage,
  onDeleteComment,
}: CommentSidebarProps) {
  // Get all comments grouped by message
  const messagesWithComments = messages.filter((m) => m.comments.length > 0)
  const totalComments = messagesWithComments.reduce(
    (sum, m) => sum + m.comments.length,
    0
  )

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white sticky top-0">
        <h3 className="font-semibold text-gray-900">Comments</h3>
        <p className="text-sm text-gray-500">
          {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
        </p>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4">
        {messagesWithComments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">💭</div>
            <p className="text-sm text-gray-500">
              No comments yet. Click on an AI response to add feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messagesWithComments.map((message) => (
              <div key={message.id} className="space-y-2">
                {/* Message Preview */}
                <button
                  onClick={() => onScrollToMessage(message.id)}
                  className="w-full text-left p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <div className="text-xs text-gray-500 mb-1">AI Response</div>
                  <div className="text-sm text-gray-700 line-clamp-2">
                    {getPreviewText(message.content)}...
                  </div>
                </button>

                {/* Comments for this message */}
                <div className="ml-3 space-y-2">
                  {message.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-white border border-yellow-200 rounded-lg"
                    >
                      {/* Template Badge */}
                      {comment.templateId && TEMPLATE_LABELS[comment.templateId] && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <span>{TEMPLATE_LABELS[comment.templateId].icon}</span>
                          <span>{TEMPLATE_LABELS[comment.templateId].label}</span>
                        </div>
                      )}

                      {/* Comment Content */}
                      <p className="text-sm text-gray-800">{comment.content}</p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(comment.createdAt)}
                        </span>
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with summary */}
      {totalComments > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="text-xs text-gray-500">
            Feedback on {messagesWithComments.length} AI{' '}
            {messagesWithComments.length === 1 ? 'response' : 'responses'}
          </div>
        </div>
      )}
    </div>
  )
}
