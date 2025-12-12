import { useState } from 'react'
import { RecommendationApplyModal } from './RecommendationApplyModal'
import { Card } from './ui/card'
import { Badge } from './ui/badge'

interface RecommendationCardProps {
  recommendation: {
    id: string
    type: 'document_update' | 'consideration' | 'follow_up'
    title: string
    description: string
    proposedContent: string | null
    changeHighlight: string | null
    evidenceQuotes: string[]
    reasoning: string
    confidence: number
    impactLevel: 'low' | 'medium' | 'high'
    status: 'pending' | 'approved' | 'rejected' | 'applied'
    targetDocument?: { id: string; filename: string }
    targetSectionId: string | null
  }
  onApply: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}

const typeConfig = {
  document_update: {
    label: 'Document Update',
    variant: 'info' as const,
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  consideration: {
    label: 'Consideration',
    variant: 'warning' as const,
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  follow_up: {
    label: 'Follow-up',
    variant: 'success' as const,
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
}

const impactConfig = {
  low: 'secondary' as const,
  medium: 'warning' as const,
  high: 'destructive' as const,
}

export function RecommendationCard({
  recommendation,
  onApply,
  onDismiss,
}: RecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)

  const config = typeConfig[recommendation.type]

  const handleApply = async () => {
    setIsApplying(true)
    try {
      await onApply(recommendation.id)
    } finally {
      setIsApplying(false)
    }
  }

  const handleDismiss = async () => {
    setIsDismissing(true)
    try {
      await onDismiss(recommendation.id)
    } finally {
      setIsDismissing(false)
    }
  }

  const isPending = recommendation.status === 'pending'

  return (
    <Card className="p-4">
      {/* Header with badges */}
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={config.variant} className="gap-1">
            {config.icon}
            {config.label}
          </Badge>
          <Badge variant="secondary">
            {Math.round(recommendation.confidence * 100)}% Confidence
          </Badge>
          <Badge variant={impactConfig[recommendation.impactLevel]}>
            Impact: {recommendation.impactLevel.toUpperCase()}
          </Badge>
        </div>
        {!isPending && (
          <Badge variant={recommendation.status === 'applied' ? 'success' : 'secondary'}>
            {recommendation.status}
          </Badge>
        )}
      </div>

      {/* Title and Description */}
      <h4 className="font-medium mb-1 text-foreground">{recommendation.title}</h4>
      <p className="text-sm text-muted mb-3">{recommendation.description}</p>

      {/* Target Document */}
      {recommendation.targetDocument && (
        <div className="text-sm text-dim mb-3">
          Target: {recommendation.targetDocument.filename}
          {recommendation.targetSectionId && ` → ${recommendation.targetSectionId}`}
        </div>
      )}

      {/* Expandable Details */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-accent hover:text-accent/80 rounded transition-colors"
      >
        <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-border mt-2">
          {/* Evidence Quotes */}
          {recommendation.evidenceQuotes.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2 text-foreground">Evidence from conversation:</h5>
              <div className="space-y-2">
                {recommendation.evidenceQuotes.map((quote, i) => (
                  <blockquote key={i} className="border-l-2 border-accent/30 pl-3 text-sm italic text-muted">
                    "{quote}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Change */}
          {recommendation.proposedContent && (
            <div>
              <h5 className="text-sm font-medium mb-2 text-foreground">Proposed change:</h5>
              <div className="bg-success/10 border border-success/20 rounded p-3 text-sm whitespace-pre-wrap text-foreground">
                {recommendation.changeHighlight || recommendation.proposedContent}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <h5 className="text-sm font-medium mb-2 text-foreground">Reasoning:</h5>
            <p className="text-sm text-muted">{recommendation.reasoning}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
          {recommendation.targetDocument && (
            <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted hover:bg-white/5 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Document
            </button>
          )}
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted hover:bg-white/5 rounded transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {isDismissing ? 'Dismissing...' : 'Dismiss'}
          </button>
          {recommendation.type === 'document_update' && (
            <button
              onClick={() => setShowApplyModal(true)}
              disabled={isApplying}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent text-background rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isApplying ? 'Applying...' : 'Approve & Apply'}
            </button>
          )}
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <RecommendationApplyModal
          recommendation={recommendation}
          onApply={async () => {
            setShowApplyModal(false)
            await handleApply()
          }}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </Card>
  )
}
