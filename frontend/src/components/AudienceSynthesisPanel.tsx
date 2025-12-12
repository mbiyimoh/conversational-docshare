import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Card } from './ui'
import { SynthesisVersionSelector } from './SynthesisVersionSelector'
import { CommonQuestionsCard } from './CommonQuestionsCard'
import { KnowledgeGapsCard } from './KnowledgeGapsCard'
import { DocumentSuggestionsCard } from './DocumentSuggestionsCard'

interface AudienceSynthesis {
  id: string
  version: number
  overview: string
  commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
  knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
  documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
  sentimentTrend: string
  insights: string[]
  conversationCount: number
  totalMessages: number
  dateRangeFrom: string
  dateRangeTo: string
  createdAt: string
}

interface VersionMeta {
  id: string
  version: number
  conversationCount: number
  createdAt: string
}

interface AudienceSynthesisPanelProps {
  projectId: string
  onNavigateToDocument?: (documentId: string, sectionId: string) => void
}

export function AudienceSynthesisPanel({ projectId, onNavigateToDocument }: AudienceSynthesisPanelProps) {
  const [synthesis, setSynthesis] = useState<AudienceSynthesis | null>(null)
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [synthResponse, versionsResponse] = await Promise.all([
        api.getAudienceSynthesis(projectId),
        api.getAudienceSynthesisVersions(projectId)
      ])

      setSynthesis(synthResponse.synthesis)
      setVersions(versionsResponse.versions)
      if (synthResponse.synthesis) {
        setSelectedVersion(synthResponse.synthesis.version)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load synthesis')
    } finally {
      setLoading(false)
    }
  }

  const loadVersion = async (version: number) => {
    try {
      setLoading(true)
      const response = await api.getAudienceSynthesisVersion(projectId, version)
      setSynthesis(response.synthesis)
      setSelectedVersion(version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    try {
      setRegenerating(true)
      setError('')
      const response = await api.regenerateAudienceSynthesis(projectId)
      setSynthesis(response.synthesis)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  const getSentimentIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↗'
      case 'declining':
        return '↘'
      default:
        return '→'
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-card-bg rounded w-1/3"></div>
          <div className="h-20 bg-card-bg rounded"></div>
        </div>
      </Card>
    )
  }

  if (!synthesis) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Audience Insights</h3>
        <div className="text-center py-8 text-muted">
          <p className="mb-4">No synthesis available yet.</p>
          <p className="text-sm">
            Insights will appear after multiple conversations with 5+ messages.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="mt-4 px-4 py-2 bg-accent text-background rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {regenerating ? 'Generating...' : 'Generate Now'}
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Audience Insights</h3>
          <p className="text-sm text-muted">
            <span className="text-accent font-display">{synthesis.conversationCount}</span> conversations • <span className="text-accent font-display">{synthesis.totalMessages}</span> messages
          </p>
        </div>
        <div className="flex items-center gap-3">
          {versions.length > 0 && (
            <SynthesisVersionSelector
              versions={versions}
              currentVersion={selectedVersion!}
              onSelect={loadVersion}
            />
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-background-elevated disabled:opacity-50 transition-colors text-foreground"
          >
            {regenerating ? 'Regenerating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Overview */}
      <div className="px-6 py-4 border-b border-border">
        <h4 className="text-sm font-medium text-muted mb-2">Overview</h4>
        <p className="text-foreground">{synthesis.overview}</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted">
            Sentiment: <span className="text-accent">{getSentimentIcon(synthesis.sentimentTrend)} {synthesis.sentimentTrend}</span>
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-6 grid md:grid-cols-2 gap-6">
        <CommonQuestionsCard questions={synthesis.commonQuestions} />
        <KnowledgeGapsCard gaps={synthesis.knowledgeGaps} />
      </div>

      {/* Document Suggestions */}
      {synthesis.documentSuggestions.length > 0 && (
        <div className="px-6 pb-6">
          <DocumentSuggestionsCard
            suggestions={synthesis.documentSuggestions}
            onViewDocument={(documentId, section) => {
              if (onNavigateToDocument) {
                onNavigateToDocument(documentId, section)
              }
            }}
          />
        </div>
      )}

      {/* Insights */}
      {synthesis.insights.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-medium text-muted mb-2">Key Insights</h4>
          <ul className="space-y-2">
            {synthesis.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-accent">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
