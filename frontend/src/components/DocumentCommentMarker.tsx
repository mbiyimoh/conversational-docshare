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
      className="bg-yellow-200 hover:bg-yellow-300 cursor-pointer relative inline"
      onClick={onClick}
    >
      {highlightedText}
      {commentCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {commentCount}
        </span>
      )}
    </span>
  )
}
