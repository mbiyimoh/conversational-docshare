import { useState, useEffect } from 'react'
import { diffWords } from 'diff'
import { api } from '../lib/api'
import { tipTapToPlainText } from '../lib/tiptapUtils'
import { Button } from './ui'

interface RecommendationApplyModalProps {
  recommendation: {
    id: string
    title: string
    description: string
    proposedContent: string | null
    changeHighlight: string | null
    targetDocument?: { id: string; filename: string }
    targetSectionId: string | null
  }
  onApply: () => void
  onClose: () => void
}

export function RecommendationApplyModal({
  recommendation,
  onApply,
  onClose,
}: RecommendationApplyModalProps) {
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [currentContent, setCurrentContent] = useState<string | null>(null)

  useEffect(() => {
    loadCurrentContent()
  }, [recommendation.targetDocument?.id])

  const loadCurrentContent = async () => {
    if (!recommendation.targetDocument?.id) {
      setLoading(false)
      return
    }

    try {
      setError('')
      // Get the current version content
      const response = await api.getDocumentForEdit(recommendation.targetDocument.id)
      if (response.content) {
        // Extract plain text from TipTap content
        setCurrentContent(tipTapToPlainText(response.content))
      } else {
        setCurrentContent('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load current content')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    setError('')
    try {
      await api.applyRecommendation(recommendation.id)
      onApply()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply recommendation')
    } finally {
      setApplying(false)
    }
  }

  const renderDiff = () => {
    if (!currentContent || !recommendation.proposedContent) {
      return (
        <div className="bg-background-elevated rounded-lg p-4 text-muted">
          <p className="font-medium mb-2">Proposed Content:</p>
          <div className="whitespace-pre-wrap text-sm">
            {recommendation.proposedContent || recommendation.changeHighlight || 'No content preview available'}
          </div>
        </div>
      )
    }

    const diff = diffWords(currentContent, recommendation.proposedContent)

    return (
      <div className="bg-background-elevated rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
        {diff.map((part, i) => (
          <span
            key={i}
            className={
              part.added
                ? 'bg-success/10 text-success'
                : part.removed
                  ? 'bg-destructive/10 text-destructive line-through'
                  : ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card-bg rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Apply Recommendation</h2>
          <p className="text-sm text-dim mt-1">{recommendation.title}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
              <span className="ml-3 text-muted">Loading content...</span>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
          ) : (
            <div className="space-y-4">
              {/* Recommendation Description */}
              <div>
                <h3 className="text-sm font-medium text-dim mb-2">Description</h3>
                <p className="text-sm text-muted">{recommendation.description}</p>
              </div>

              {/* Target Document */}
              {recommendation.targetDocument && (
                <div>
                  <h3 className="text-sm font-medium text-dim mb-2">Target Document</h3>
                  <p className="text-sm text-muted">
                    {recommendation.targetDocument.filename}
                    {recommendation.targetSectionId && (
                      <span className="text-dim"> - Section: {recommendation.targetSectionId}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Diff View */}
              <div>
                <h3 className="text-sm font-medium text-dim mb-2">
                  Proposed Changes
                  {currentContent && (
                    <span className="text-xs font-normal text-dim ml-2">
                      (green = added, red = removed)
                    </span>
                  )}
                </h3>
                {renderDiff()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-background-elevated">
          <Button
            onClick={onClose}
            disabled={applying}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading || applying || !recommendation.proposedContent}
            variant="default"
          >
            {applying ? 'Applying...' : 'Approve & Apply'}
          </Button>
        </div>
      </div>
    </div>
  )
}
