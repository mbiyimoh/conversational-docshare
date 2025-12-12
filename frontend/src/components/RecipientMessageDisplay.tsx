interface RecipientMessageDisplayProps {
  message: {
    content: string
    viewerName?: string | null
    viewerEmail?: string | null
    createdAt: string
  }
}

export function RecipientMessageDisplay({ message }: RecipientMessageDisplayProps) {
  const senderIdentity = message.viewerName || message.viewerEmail || 'Viewer'

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-accent/10 rounded-full flex-shrink-0">
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h4 className="font-medium text-foreground">
              Message from {senderIdentity}
            </h4>
            <span className="text-sm text-accent">
              {formatDate(message.createdAt)}
            </span>
          </div>
          <p className="text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  )
}
