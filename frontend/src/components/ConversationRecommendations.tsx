import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { RecommendationCard } from './RecommendationCard'

interface Recommendation {
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

interface ConversationRecommendationsProps {
  conversationId: string
  projectId: string
  onApply?: (recommendationId: string) => void
}

export function ConversationRecommendations({
  conversationId,
  projectId: _projectId,
  onApply,
}: ConversationRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRecommendations()
  }, [conversationId])

  async function loadRecommendations() {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getConversationRecommendations(conversationId)
      setRecommendations(response.recommendations || [])
    } catch (err) {
      console.error('Failed to load recommendations:', err)
      setError('Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(id: string) {
    try {
      await api.applyRecommendation(id)
      await loadRecommendations()
      onApply?.(id)
    } catch (err) {
      console.error('Failed to apply recommendation:', err)
    }
  }

  async function handleDismiss(id: string) {
    try {
      await api.dismissConversationRecommendation(id)
      await loadRecommendations()
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-500">
        {error}
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="w-8 h-8 mx-auto mb-2 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <p>No recommendations for this conversation</p>
      </div>
    )
  }

  const pendingCount = recommendations.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Recommendations ({recommendations.length})
        </h3>
        {pendingCount > 0 && (
          <span className="text-sm text-gray-500">
            {pendingCount} pending review
          </span>
        )}
      </div>

      <div className="space-y-4">
        {recommendations.map((rec) => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onApply={handleApply}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  )
}
