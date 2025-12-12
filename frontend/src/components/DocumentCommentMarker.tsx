interface DocumentCommentMarkerProps {
  highlightedText: string
  commentCount: number
  onClick: () => void
}

export function DocumentCommentMarker({
  highlightedText,
  commentCount,
  onClick,
}: DocumentCommentMarkerProps) {
  return (
    <span
      className="bg-accent/20 hover:bg-accent/30 cursor-pointer relative inline transition-colors"
      onClick={onClick}
    >
      {highlightedText}
      {commentCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-accent text-background text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {commentCount}
        </span>
      )}
    </span>
  )
}
