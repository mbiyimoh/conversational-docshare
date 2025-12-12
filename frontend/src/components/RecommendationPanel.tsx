import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type {
  ProfileRecommendation,
  AnalysisSummary,
  AgentProfile,
} from '../types/recommendation'
import { SECTION_DISPLAY_NAMES } from '../types/recommendation'
import { Card, Button, Badge } from './ui'
import { RefreshCw, X, ChevronRight, ChevronDown } from 'lucide-react'

interface RecommendationPanelProps {
  projectId: string
  onApplyAll: (profile: AgentProfile, versionNumber: number) => void
  onClose: () => void
}

const TYPE_LABELS = {
  add: { label: 'Add', variant: 'success' as const },
  remove: { label: 'Remove', variant: 'destructive' as const },
  modify: { label: 'Modify', variant: 'warning' as const },
}

export function RecommendationPanel({
  projectId,
  onApplyAll,
  onClose,
}: RecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<ProfileRecommendation[]>([])
  const [setId, setSetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<{
    totalComments: number
    sessionsAnalyzed: number
    analysisSummary?: AnalysisSummary
  }>({ totalComments: 0, sessionsAnalyzed: 0 })
  const [expandedRec, setExpandedRec] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    versionNumber: number
    appliedCount: number
    profile: AgentProfile
  } | null>(null)

  useEffect(() => {
    loadRecommendations()
  }, [projectId])

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getRecommendations(projectId)
      setRecommendations(response.recommendations)
      setSetId(response.setId)
      setStats({
        totalComments: response.totalComments,
        sessionsAnalyzed: response.sessionsAnalyzed,
        analysisSummary: response.analysisSummary,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyAll = async () => {
    if (!setId) return

    try {
      setApplying(true)
      setError('')
      const pendingCount = recommendations.filter(r => r.status === 'pending').length
      const result = await api.applyAllRecommendations(projectId, setId)
      setSuccessInfo({
        versionNumber: result.version.number,
        appliedCount: pendingCount,
        profile: result.profile,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply recommendations')
    } finally {
      setApplying(false)
    }
  }

  const handleViewProfile = () => {
    if (successInfo) {
      onApplyAll(successInfo.profile, successInfo.versionNumber)
    }
  }

  const handleDismiss = async (recId: string) => {
    try {
      await api.dismissRecommendation(projectId, recId)
      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === recId ? { ...r, status: 'dismissed' as const } : r
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss recommendation')
    }
  }

  if (loading) {
    return (
      <Card className="p-6 w-[calc(100vw-4rem)] max-w-6xl mx-auto">
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mb-4" />
          <div className="text-muted">Analyzing your testing feedback...</div>
          <div className="text-sm text-dim mt-2">This may take up to 30 seconds</div>
        </div>
      </Card>
    )
  }

  // Success screen after applying recommendations
  if (successInfo) {
    return (
      <Card className="p-8 w-[calc(100vw-4rem)] max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-xl text-foreground mb-2">
            Changes Applied Successfully!
          </h2>
          <p className="text-muted mb-2">
            {successInfo.appliedCount} recommendation{successInfo.appliedCount !== 1 ? 's' : ''} applied to your profile.
          </p>
          <p className="text-sm text-dim mb-6">
            Profile updated to version {successInfo.versionNumber}. You can rollback anytime from the profile view.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleViewProfile}>
              View Updated Profile
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const pendingRecs = recommendations.filter((r) => r.status === 'pending')

  return (
    <div className="bg-card-bg border border-border rounded-lg shadow-lg w-[calc(100vw-4rem)] max-w-6xl mx-auto h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-foreground">Profile Recommendations</h2>
          <p className="text-sm text-muted">
            Based on {stats.totalComments} comments across {stats.sessionsAnalyzed} sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadRecommendations}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Regenerate
          </Button>
          <button onClick={onClose} className="text-dim hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Analysis Summary */}
      {!loading && stats.analysisSummary && (
        <div className="px-6 py-4">
          <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
            <div className="text-sm text-foreground">
              {stats.analysisSummary.overview}
            </div>
            {stats.analysisSummary.feedbackThemes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {stats.analysisSummary.feedbackThemes.map((theme) => (
                  <Badge key={theme} variant="secondary">
                    {theme}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {pendingRecs.length === 0 ? (
          <div className="text-center py-8">
            {recommendations.length === 0 && stats.analysisSummary?.configAlignment === 'good' ? (
              <div className="bg-success/10 rounded-lg p-6 border border-success/30">
                <div className="text-success font-medium mb-2">
                  Good news - no changes needed!
                </div>
                <div className="text-sm text-muted">
                  {stats.analysisSummary.noChangeReason ||
                    'Your current profile already addresses the feedback themes.'}
                </div>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="bg-background-elevated rounded-lg p-6">
                <div className="text-foreground font-medium mb-2">
                  No specific recommendations
                </div>
                <div className="text-sm text-muted">
                  {stats.analysisSummary?.noChangeReason ||
                    'Unable to generate specific recommendations from the provided feedback.'}
                </div>
              </div>
            ) : (
              <p className="text-muted">
                All recommendations have been processed.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRecs.map((rec) => (
              <Card
                key={rec.id}
                className="p-4 hover:border-accent/50 transition-all"
              >
                {/* Header with section and type */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-foreground">
                      {SECTION_DISPLAY_NAMES[rec.targetSection]}
                    </span>
                    <Badge variant={TYPE_LABELS[rec.type].variant}>
                      {TYPE_LABELS[rec.type].label}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(rec.id)}
                    className="text-dim hover:text-foreground"
                  >
                    Dismiss
                  </Button>
                </div>

                {/* Summary Bullets */}
                <div className="mb-4">
                  <ul className="space-y-1">
                    {rec.summaryBullets.map((bullet, idx) => (
                      <li key={idx} className="text-sm text-muted flex items-start gap-2">
                        <span className="text-accent mt-0.5">•</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Side-by-side Diff */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
                    <div className="text-xs font-medium text-destructive mb-2 uppercase tracking-wide font-mono">Before</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {rec.previewBefore || <em className="text-dim">Empty</em>}
                    </div>
                  </div>
                  <div className="bg-success/10 rounded-lg p-4 border border-success/20">
                    <div className="text-xs font-medium text-success mb-2 uppercase tracking-wide font-mono">After</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {rec.previewAfter}
                    </div>
                  </div>
                </div>

                {/* Rationale (Expandable) */}
                <button
                  onClick={() =>
                    setExpandedRec(expandedRec === rec.id ? null : rec.id)
                  }
                  className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
                >
                  {expandedRec === rec.id ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Why this change?
                </button>
                {expandedRec === rec.id && (
                  <div className="mt-2 p-3 bg-background-elevated rounded text-sm text-muted">
                    {rec.rationale}
                    {rec.relatedCommentIds.length > 0 && (
                      <div className="mt-2 text-xs text-dim">
                        Based on {rec.relatedCommentIds.length} related comments
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer with Apply All */}
      {pendingRecs.length > 0 && (
        <div className="px-6 py-4 border-t border-border bg-background-elevated flex items-center justify-between">
          <p className="text-xs text-dim">
            Changes will be applied directly to your profile. You can rollback anytime.
          </p>
          <Button
            onClick={handleApplyAll}
            disabled={applying}
            isLoading={applying}
          >
            Apply All ({pendingRecs.length})
          </Button>
        </div>
      )}
    </div>
  )
}
