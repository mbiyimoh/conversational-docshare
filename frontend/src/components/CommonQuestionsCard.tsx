interface CommonQuestionsCardProps {
  questions: Array<{
    pattern: string
    frequency: number
    documents: string[]
  }>
}

export function CommonQuestionsCard({ questions }: CommonQuestionsCardProps) {
  if (questions.length === 0) return null

  return (
    <div className="bg-card-bg border border-border rounded-lg p-4">
      <h4 className="font-medium text-foreground mb-3">Common Questions</h4>
      <div className="space-y-3">
        {questions.slice(0, 5).map((q, i) => (
          <div key={i} className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <span className="text-accent text-sm font-mono">Q{i + 1}:</span>
              <span className="text-sm text-muted">{q.pattern}</span>
            </div>
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full ml-2 whitespace-nowrap font-mono">
              {q.frequency}x
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
