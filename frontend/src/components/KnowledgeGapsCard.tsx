import { Card, Badge } from './ui'

interface KnowledgeGapsCardProps {
  gaps: Array<{
    topic: string
    severity: string
    suggestion: string
  }>
}

export function KnowledgeGapsCard({ gaps }: KnowledgeGapsCardProps) {
  if (gaps.length === 0) return null

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive' as const
      case 'medium':
        return 'warning' as const
      default:
        return 'secondary' as const
    }
  }

  return (
    <Card className="p-4">
      <h4 className="font-medium text-foreground mb-3">Knowledge Gaps</h4>
      <div className="space-y-3">
        {gaps.slice(0, 5).map((gap, i) => (
          <div key={i} className="flex items-start gap-2">
            <Badge variant={getSeverityVariant(gap.severity)} className="mt-0.5">
              {gap.severity}
            </Badge>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground mb-1">{gap.topic}</div>
              <p className="text-sm text-muted">{gap.suggestion}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
