import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Button } from './ui'

interface SourceMaterialModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface SourceMaterial {
  type: 'braindump' | 'interview'
  braindump?: string
  interviewData?: Record<string, string>
}

const INTERVIEW_QUESTIONS: Record<string, string> = {
  audience: 'Who is your primary audience?',
  purpose: "What's the main purpose of these documents?",
  tone: 'What communication style should the AI use?',
  emphasis: 'What should the AI emphasize?',
  questions: 'What proactive questions should the AI ask?'
}

export function SourceMaterialModal({ projectId, isOpen, onClose }: SourceMaterialModalProps) {
  const [material, setMaterial] = useState<SourceMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) loadSourceMaterial()
  }, [isOpen, projectId])

  const loadSourceMaterial = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getAgentConfig(projectId)
      const config = response.agentConfig as {
        rawBrainDump?: string
        interviewData?: Record<string, string>
        synthesisMode?: string
      }

      if (config.rawBrainDump) {
        setMaterial({ type: 'braindump', braindump: config.rawBrainDump })
      } else if (config.interviewData) {
        setMaterial({ type: 'interview', interviewData: config.interviewData })
      } else {
        setMaterial(null)
      }
    } catch (err) {
      console.error('Failed to load source material:', err)
      setMaterial(null)
      setError('Unable to load source material')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg border border-border p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">
            {material?.type === 'braindump' ? 'Original Brain Dump' : 'Interview Responses'}
          </h2>
          <button
            onClick={onClose}
            className="text-dim hover:text-muted transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
          </div>
        ) : material?.type === 'braindump' ? (
          <div className="p-4 bg-background-elevated rounded-lg">
            <p className="text-muted whitespace-pre-wrap font-body">{material.braindump}</p>
          </div>
        ) : material?.type === 'interview' ? (
          <div className="space-y-4">
            {Object.entries(INTERVIEW_QUESTIONS).map(([key, question]) => (
              <div key={key} className="border border-border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">{question}</h3>
                <p className="text-muted whitespace-pre-wrap">
                  {material.interviewData?.[key] || 'Not answered'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dim text-center py-8">No source material found</p>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
