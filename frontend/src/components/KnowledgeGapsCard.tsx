interface KnowledgeGapsCardProps {
  gaps: Array<{
    topic: string
    severity: string
    suggestion: string
  }>
}

export function KnowledgeGapsCard({ gaps }: KnowledgeGapsCardProps) {
  if (gaps.length === 0) return null

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-3">Knowledge Gaps</h4>
      <div className="space-y-3">
        {gaps.slice(0, 5).map((gap, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(gap.severity)}`}>
                {gap.severity}
              </span>
              <span className="text-sm font-medium text-gray-700">{gap.topic}</span>
            </div>
            <p className="text-xs text-gray-500 ml-12">{gap.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
