import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Card, Button, Textarea } from './ui'

interface AgentInterviewModalProps {
  projectId: string
  onClose: () => void
  onComplete: () => void
}

const questions = [
  {
    id: 'audience',
    question: "Who is your primary audience?",
    placeholder: "e.g., Board members, Investors, Technical team members",
    description: "Who will be asking questions about these documents?",
  },
  {
    id: 'purpose',
    question: "What's the main purpose of these documents?",
    placeholder: "e.g., Quarterly strategic planning, Technical documentation",
    description: "What are these documents meant to accomplish?",
  },
  {
    id: 'tone',
    question: "What communication style should the AI use?",
    placeholder: "e.g., Professional but approachable, Formal and technical",
    description: "How should the AI communicate with your audience?",
  },
  {
    id: 'emphasis',
    question: "What should the AI emphasize?",
    placeholder: "e.g., Key metrics, risks, strategic recommendations",
    description: "What topics or areas are most important?",
  },
  {
    id: 'questions',
    question: "What proactive questions should the AI ask?",
    placeholder: "e.g., How does this align with your objectives?",
    description: "Questions to help guide the conversation (optional)",
  },
]

export function AgentInterviewModal({ projectId, onClose, onComplete }: AgentInterviewModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [interviewData, setInterviewData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadExisting() {
      try {
        const response = await api.getAgentConfig(projectId)
        const config = response.agentConfig as { interviewData?: Record<string, string> }
        if (config?.interviewData) {
          setInterviewData(config.interviewData)
        }
      } catch {
        // No existing data - start fresh
      }
    }
    loadExisting()
  }, [projectId])

  const currentQuestion = questions[currentStep]
  const isLastStep = currentStep === questions.length - 1
  const progress = ((currentStep + 1) / questions.length) * 100

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    setError('')

    try {
      const essentialAnswers = ['audience', 'purpose', 'tone', 'emphasis'].filter(
        (key) => interviewData[key]
      ).length
      const completionLevel = (essentialAnswers / 4) * 100
      const status = completionLevel >= 75 ? 'complete' : 'incomplete'

      await api.saveAgentConfig(projectId, interviewData, status, completionLevel)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">Configure Your AI Agent</h2>
          <button onClick={onClose} className="text-dim hover:text-muted transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-muted">
            <span>Question {currentStep + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background-elevated border border-border">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Question */}
        <Card className="p-6 mb-6">
          <h3 className="font-display text-xl text-foreground mb-2">{currentQuestion.question}</h3>
          <p className="text-muted mb-4">{currentQuestion.description}</p>
          <Textarea
            value={interviewData[currentQuestion.id] || ''}
            onChange={(e) => setInterviewData({ ...interviewData, [currentQuestion.id]: e.target.value })}
            placeholder={currentQuestion.placeholder}
            rows={4}
          />
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
            Back
          </Button>
          <div className="flex gap-2">
            {isLastStep ? (
              <Button onClick={handleComplete} disabled={saving} isLoading={saving}>
                {saving ? 'Saving...' : 'Complete'}
              </Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
