import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type {
  ProfileRecommendation,
  AnalysisSummary,
  AgentProfile,
} from '../types/recommendation'
import { SECTION_DISPLAY_NAMES } from '../types/recommendation'

interface RecommendationPanelProps {
  projectId: string
  onApplyAll: (profile: AgentProfile, versionNumber: number) => void
  onClose: () => void
}

const TYPE_LABELS = {
  add: { label: 'Add', color: 'bg-green-100 text-green-800' },
  remove: { label: 'Remove', color: 'bg-red-100 text-red-800' },
  modify: { label: 'Modify', color: 'bg-yellow-100 text-yellow-800' },
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
      <div className="bg-white rounded-lg shadow-lg p-6 w-[calc(100vw-4rem)] max-w-6xl mx-auto">
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
          <div className="text-gray-600">Analyzing your testing feedback...</div>
          <div className="text-sm text-gray-400 mt-2">This may take up to 30 seconds</div>
        </div>
      </div>
    )
  }

  // Success screen after applying recommendations
  if (successInfo) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 w-[calc(100vw-4rem)] max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Changes Applied Successfully!
          </h2>
          <p className="text-gray-600 mb-2">
            {successInfo.appliedCount} recommendation{successInfo.appliedCount !== 1 ? 's' : ''} applied to your profile.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Profile updated to version {successInfo.versionNumber}. You can rollback anytime from the profile view.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
            <button
              onClick={handleViewProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Updated Profile
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pendingRecs = recommendations.filter((r) => r.status === 'pending')

  return (
    <div className="bg-white rounded-lg shadow-lg w-[calc(100vw-4rem)] max-w-6xl mx-auto h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Profile Recommendations</h2>
          <p className="text-sm text-gray-500">
            Based on {stats.totalComments} comments across {stats.sessionsAnalyzed} sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRecommendations}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ↻ Regenerate
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {/* Analysis Summary */}
      {!loading && stats.analysisSummary && (
        <div className="px-6 py-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-900">
              {stats.analysisSummary.overview}
            </div>
            {stats.analysisSummary.feedbackThemes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {stats.analysisSummary.feedbackThemes.map((theme) => (
                  <span
                    key={theme}
                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                  >
                    {theme}
                  </span>
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
              <div className="bg-green-50 rounded-lg p-6 border border-green-100">
                <div className="text-green-800 font-medium mb-2">
                  Good news - no changes needed!
                </div>
                <div className="text-sm text-green-700">
                  {stats.analysisSummary.noChangeReason ||
                    'Your current profile already addresses the feedback themes.'}
                </div>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-gray-700 font-medium mb-2">
                  No specific recommendations
                </div>
                <div className="text-sm text-gray-600">
                  {stats.analysisSummary?.noChangeReason ||
                    'Unable to generate specific recommendations from the provided feedback.'}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">
                All recommendations have been processed.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRecs.map((rec) => (
              <div
                key={rec.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* Header with section and type */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {SECTION_DISPLAY_NAMES[rec.targetSection]}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        TYPE_LABELS[rec.type].color
                      }`}
                    >
                      {TYPE_LABELS[rec.type].label}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Dismiss
                  </button>
                </div>

                {/* Summary Bullets */}
                <div className="mb-4">
                  <ul className="space-y-1">
                    {rec.summaryBullets.map((bullet, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Side-by-side Diff */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                    <div className="text-xs font-medium text-red-600 mb-2 uppercase tracking-wide">Before</div>
                    <div className="text-sm text-red-900 whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {rec.previewBefore || <em className="text-gray-400">Empty</em>}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="text-xs font-medium text-green-600 mb-2 uppercase tracking-wide">After</div>
                    <div className="text-sm text-green-900 whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {rec.previewAfter}
                    </div>
                  </div>
                </div>

                {/* Rationale (Expandable) */}
                <button
                  onClick={() =>
                    setExpandedRec(expandedRec === rec.id ? null : rec.id)
                  }
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {expandedRec === rec.id ? '▼' : '▶'} Why this change?
                </button>
                {expandedRec === rec.id && (
                  <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-600">
                    {rec.rationale}
                    {rec.relatedCommentIds.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        Based on {rec.relatedCommentIds.length} related comments
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with Apply All */}
      {pendingRecs.length > 0 && (
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Changes will be applied directly to your profile. You can rollback anytime.
          </p>
          <button
            onClick={handleApplyAll}
            disabled={applying}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {applying && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
            Apply All ({pendingRecs.length})
          </button>
        </div>
      )}
    </div>
  )
}
