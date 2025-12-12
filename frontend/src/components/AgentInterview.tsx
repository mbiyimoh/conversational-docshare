import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { AgentProfile } from './AgentProfile'
import { Card, Button, Textarea, Badge } from './ui'

interface InterviewData {
  audience?: string
  purpose?: string
  tone?: string
  emphasis?: string
  questions?: string
  [key: string]: string | undefined
}

interface AgentInterviewProps {
  projectId: string
  onComplete?: (action?: 'navigate-to-share' | 'navigate-to-test') => void
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

const LINE_CAP = 10

export function AgentInterview({ projectId, onComplete }: AgentInterviewProps) {
  const [view, setView] = useState<'interview' | 'review'>('interview')
  const [reviewTab, setReviewTab] = useState<'responses' | 'profile'>('responses')
  const [currentStep, setCurrentStep] = useState(0)
  const [interviewData, setInterviewData] = useState<InterviewData>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set())
  const [notification, setNotification] = useState<string | null>(null)

  // Load existing agent config on mount
  useEffect(() => {
    async function loadExistingConfig() {
      try {
        setLoading(true)
        const response = await api.getAgentConfig(projectId)
        const config = response.agentConfig as { interviewData?: InterviewData; status?: string }

        if (config?.interviewData) {
          setInterviewData(config.interviewData)

          // If already complete, show review view
          if (config.status === 'complete') {
            setView('review')
          } else {
            // Find the first unanswered question to resume from
            const questionIds = questions.map(q => q.id)
            let resumeStep = 0
            for (let i = 0; i < questionIds.length; i++) {
              if (config.interviewData[questionIds[i]]) {
                resumeStep = i + 1 // Move past answered questions
              } else {
                break
              }
            }
            // Cap at last question
            setCurrentStep(Math.min(resumeStep, questions.length - 1))
          }
        }
      } catch (err) {
        // No existing config is fine - user just hasn't started yet
        // Only show error if it's not a 404
        if (err instanceof Error && !err.message.includes('not found')) {
          console.error('Failed to load agent config:', err)
        }
      } finally {
        setLoading(false)
      }
    }

    loadExistingConfig()
  }, [projectId])

  // Check for pre-filled recommendation on mount
  useEffect(() => {
    const prefilled = sessionStorage.getItem('prefilled_interview')
    if (prefilled) {
      try {
        const { questionId, value } = JSON.parse(prefilled)

        // Apply value to interview data
        setInterviewData((prev) => ({ ...prev, [questionId]: value }))

        // Find the question index to navigate to
        const questionIndex = questions.findIndex((q) => q.id === questionId)
        if (questionIndex >= 0) {
          setCurrentStep(questionIndex)
        }

        // Clear the prefill data
        sessionStorage.removeItem('prefilled_interview')

        // Show notification to user
        setNotification('Recommendation applied. Review and save when ready.')
        setTimeout(() => setNotification(null), 5000)
      } catch (e) {
        console.error('Failed to parse prefilled interview data:', e)
        sessionStorage.removeItem('prefilled_interview')
      }
    }
  }, [])

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

  const handleAnswerChange = (value: string) => {
    setInterviewData({
      ...interviewData,
      [currentQuestion.id]: value,
    })
  }

  const handleComplete = async () => {
    setSaving(true)
    setError('')

    try {
      // Calculate completion level (essential questions: 0-3, optional: 4)
      const essentialAnswers = ['audience', 'purpose', 'tone', 'emphasis'].filter(
        (key) => interviewData[key as keyof InterviewData]
      ).length
      const completionLevel = (essentialAnswers / 4) * 100

      const status = completionLevel >= 75 ? 'complete' : 'incomplete'

      await api.saveAgentConfig(projectId, interviewData, status, completionLevel)

      // Show review view instead of calling onComplete directly
      setView('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleSkipToEnd = async () => {
    await handleComplete()
  }

  const handleEditQuestion = (questionIndex: number) => {
    setCurrentStep(questionIndex)
    setView('interview')
  }

  const handleEditAllResponses = () => {
    setCurrentStep(0)
    setView('interview')
  }

  const toggleAnswerExpanded = (questionId: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  const getDisplayText = (text: string, questionId: string): { displayText: string; isTruncated: boolean } => {
    const lines = text.split('\n')
    if (lines.length <= LINE_CAP || expandedAnswers.has(questionId)) {
      return { displayText: text, isTruncated: false }
    }
    return {
      displayText: lines.slice(0, LINE_CAP).join('\n'),
      isTruncated: true,
    }
  }

  // Show loading state while fetching existing config
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading interview...
          </div>
        </div>
      </div>
    )
  }

  // Notification Toast
  const NotificationToast = notification ? (
    <div className="fixed top-4 right-4 bg-success text-background px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
      {notification}
    </div>
  ) : null

  // Review View with Sub-Tabs
  if (view === 'review') {
    return (
      <div className="mx-auto max-w-3xl">
        {/* Notification Toast */}
        {NotificationToast}

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl text-foreground">
            Your AI Agent Configuration
          </h1>
          <p className="mt-2 text-muted">
            Review your interview responses and the generated agent profile
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div className="border-b border-border mb-6">
          <nav className="flex space-x-8" role="tablist">
            <button
              onClick={() => setReviewTab('responses')}
              role="tab"
              aria-selected={reviewTab === 'responses'}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                reviewTab === 'responses'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground hover:border-border'
              }`}
            >
              Interview Responses
            </button>
            <button
              onClick={() => setReviewTab('profile')}
              role="tab"
              aria-selected={reviewTab === 'profile'}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                reviewTab === 'profile'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground hover:border-border'
              }`}
            >
              Agent Profile
            </button>
          </nav>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Tab content */}
        <div role="tabpanel">
          {reviewTab === 'responses' ? (
            <>
              {/* Answer cards */}
              <div className="space-y-4">
                {questions.map((q, index) => {
                  const answer = interviewData[q.id as keyof InterviewData]
                  const isEssential = index < 4
                  const isEmpty = !answer || answer.trim() === ''

                  return (
                    <Card key={q.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-display text-foreground">{q.question}</h3>
                            {isEssential && (
                              <Badge variant="secondary">Required</Badge>
                            )}
                          </div>
                          {isEmpty ? (
                            <p className="text-dim italic">Not answered</p>
                          ) : (
                            (() => {
                              const { displayText, isTruncated } = getDisplayText(answer, q.id)
                              const isExpanded = expandedAnswers.has(q.id)
                              const showToggle = isTruncated || isExpanded
                              return (
                                <div>
                                  <p className="text-muted whitespace-pre-wrap">{displayText}</p>
                                  {showToggle && (
                                    <button
                                      onClick={() => toggleAnswerExpanded(q.id)}
                                      className="mt-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                                    >
                                      {isExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                </div>
                              )
                            })()
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditQuestion(index)}
                        >
                          Edit
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Tip */}
              <Card className="mt-6 border-accent/30" glow>
                <p className="text-sm text-muted">
                  You can always come back and update these settings later from the AI Agent tab.
                </p>
              </Card>
            </>
          ) : (
            <AgentProfile
              projectId={projectId}
              interviewData={interviewData as Record<string, string>}
              onContinueToTesting={() => {
                if (onComplete) {
                  onComplete('navigate-to-test')
                }
              }}
              onEditInterview={() => {
                setCurrentStep(0)
                setView('interview')
              }}
            />
          )}
        </div>

        {/* Unified action buttons */}
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={handleEditAllResponses}>
            Edit All Responses
          </Button>
          <Button onClick={() => onComplete?.('navigate-to-test')}>
            Continue to Testing
          </Button>
        </div>
      </div>
    )
  }

  // Interview View (existing UI)
  return (
    <div className="mx-auto max-w-2xl">
      {/* Notification Toast */}
      {NotificationToast}

      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm text-muted">
          <span>
            Question {currentStep + 1} of {questions.length}
          </span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card-bg border border-border">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Question card */}
      <Card className="p-8">
        <h2 className="mb-2 font-display text-2xl text-foreground">
          {currentQuestion.question}
        </h2>
        <p className="mb-6 text-muted">{currentQuestion.description}</p>

        <Textarea
          value={interviewData[currentQuestion.id as keyof InterviewData] || ''}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder={currentQuestion.placeholder}
          rows={4}
        />

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>

          <div className="flex gap-2">
            {currentStep >= 3 && (
              <Button
                variant="secondary"
                onClick={handleSkipToEnd}
                disabled={saving}
              >
                Skip & Save
              </Button>
            )}

            {isLastStep ? (
              <Button
                onClick={handleComplete}
                disabled={saving}
                isLoading={saving}
              >
                {saving ? 'Saving...' : 'Complete'}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tips */}
      <Card className="mt-6 border-accent/30" glow>
        <p className="font-display text-foreground">Tip:</p>
        <p className="mt-1 text-sm text-muted">
          The first 4 questions are essential. You can skip the last question if you prefer the AI to respond naturally without proactive questions.
        </p>
      </Card>
    </div>
  )
}
