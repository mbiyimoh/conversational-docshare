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

const TEMPLATE_LABELS: Record<string, { label: string }> = {
  identity: { label: 'Identity/Role' },
  communication: { label: 'Communication' },
  content: { label: 'Content' },
  engagement: { label: 'Engagement' },
  framing: { label: 'Framing' },
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
    <div className="flex flex-col h-full bg-background-elevated">
      {/* Header */}
      <div className="p-4 border-b border-border sticky top-0 bg-background-elevated">
        <h3 className="text-sm font-medium text-foreground uppercase tracking-wide font-mono">Comments</h3>
        <p className="text-sm text-dim mt-1">
          {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
        </p>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4">
        {messagesWithComments.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto mb-3 w-12 h-12 text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <p className="text-sm text-dim">
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
                  className="w-full text-left p-2 bg-card-bg rounded-lg hover:bg-white/5 transition-colors border border-border"
                >
                  <div className="text-xs text-dim mb-1 font-mono uppercase tracking-wide">AI Response</div>
                  <div className="text-sm text-muted line-clamp-2">
                    {getPreviewText(message.content)}...
                  </div>
                </button>

                {/* Comments for this message */}
                <div className="ml-3 space-y-2">
                  {message.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-card-bg border border-[#d4a54a]/20 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {/* Template Badge */}
                      {comment.templateId && TEMPLATE_LABELS[comment.templateId] && (
                        <div className="flex items-center gap-1 text-xs text-[#d4a54a] mb-1 font-mono uppercase tracking-wide">
                          <span>{TEMPLATE_LABELS[comment.templateId].label}</span>
                        </div>
                      )}

                      {/* Comment Content */}
                      <p className="text-sm text-foreground">{comment.content}</p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-dim">
                          {formatTime(comment.createdAt)}
                        </span>
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="text-xs text-dim hover:text-destructive transition-colors"
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
        <div className="px-4 py-3 border-t border-border bg-background-elevated">
          <div className="text-xs text-dim font-mono uppercase tracking-wide">
            Feedback on {messagesWithComments.length} AI{' '}
            {messagesWithComments.length === 1 ? 'response' : 'responses'}
          </div>
        </div>
      )}
    </div>
  )
}
