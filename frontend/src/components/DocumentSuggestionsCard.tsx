interface DocumentSuggestionsCardProps {
  suggestions: Array<{
    documentId: string
    documentName?: string
    section: string
    suggestion: string
  }>
  onViewDocument: (documentId: string, section: string) => void
}

export function DocumentSuggestionsCard({
  suggestions,
  onViewDocument
}: DocumentSuggestionsCardProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-3">Document Improvement Suggestions</h4>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm text-gray-700">{s.suggestion}</div>
              <div className="text-xs text-gray-500 mt-1">
                {s.documentName || s.documentId} → {s.section}
              </div>
            </div>
            <button
              onClick={() => onViewDocument(s.documentId, s.section)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
