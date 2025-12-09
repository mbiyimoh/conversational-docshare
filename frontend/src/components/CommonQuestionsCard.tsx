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
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-3">Common Questions</h4>
      <div className="space-y-3">
        {questions.slice(0, 5).map((q, i) => (
          <div key={i} className="flex items-start justify-between">
            <span className="text-sm text-gray-600">{q.pattern}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2 whitespace-nowrap">
              {q.frequency}x
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
