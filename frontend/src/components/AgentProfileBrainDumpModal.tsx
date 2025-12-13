import { useState, useEffect } from 'react'
import { api, BrainDumpSynthesisResponse } from '../lib/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { Button } from './ui'

type Step = 'input' | 'processing' | 'preview'

interface AgentProfileBrainDumpModalProps {
  projectId: string
  onClose: () => void
  onSaved: () => void
  onSwitchToInterview: () => void
}

const FIELD_CATEGORIES = {
  'Identity & Context': ['agentIdentity', 'domainExpertise', 'targetAudience'],
  'Communication & Style': ['toneAndVoice', 'languagePatterns', 'adaptationRules'],
  'Content & Priorities': ['keyTopics', 'avoidanceAreas', 'examplePreferences'],
  'Engagement & Behavior': ['proactiveGuidance', 'framingStrategies', 'successCriteria']
} as const

const FIELD_TITLES: Record<string, string> = {
  agentIdentity: 'Agent Identity',
  domainExpertise: 'Domain Expertise',
  targetAudience: 'Target Audience',
  toneAndVoice: 'Tone & Voice',
  languagePatterns: 'Language Patterns',
  adaptationRules: 'Adaptation Rules',
  keyTopics: 'Key Topics',
  avoidanceAreas: 'Avoidance Areas',
  examplePreferences: 'Example Preferences',
  proactiveGuidance: 'Proactive Guidance',
  framingStrategies: 'Framing Strategies',
  successCriteria: 'Success Criteria'
}

const MIN_INPUT_LENGTH = 50

export function AgentProfileBrainDumpModal({
  projectId,
  onClose,
  onSaved,
  onSwitchToInterview
}: AgentProfileBrainDumpModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [rawInput, setRawInput] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [synthesisResult, setSynthesisResult] = useState<BrainDumpSynthesisResponse | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition()

  // Sync voice transcript to input
  useEffect(() => {
    if (transcript) {
      setRawInput(prev => prev + (prev ? ' ' : '') + transcript)
    }
  }, [transcript])

  const handleSynthesize = async () => {
    const trimmedInput = rawInput.trim()
    if (trimmedInput.length < MIN_INPUT_LENGTH) {
      setError(`Please provide at least ${MIN_INPUT_LENGTH} characters`)
      return
    }

    setSynthesizing(true)
    setError('')
    setStep('processing')

    try {
      const context = additionalContext.trim() || undefined
      const response = await api.synthesizeAgentProfile(projectId, trimmedInput, context)
      setSynthesisResult(response)
      setAdditionalContext('')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed')
      setStep('input')
    } finally {
      setSynthesizing(false)
    }
  }

  const handleRegenerate = async () => {
    if (!additionalContext.trim()) return
    await handleSynthesize()
  }

  const handleSave = async () => {
    if (!synthesisResult) return

    setSaving(true)
    setError('')

    try {
      await api.saveAgentProfileV2(projectId, {
        profile: synthesisResult.profile,
        rawInput: synthesisResult.rawInput,
        lightAreas: synthesisResult.lightAreas,
        synthesisMode: synthesisResult.synthesisMode
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const toggleVoice = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  const charCount = rawInput.trim().length
  const isValid = charCount >= MIN_INPUT_LENGTH

  const getConfidenceBadge = (confidence: 'EXPLICIT' | 'INFERRED' | 'ASSUMED') => {
    switch (confidence) {
      case 'EXPLICIT':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-success/10 text-success font-mono">Explicit</span>
      case 'INFERRED':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-mono">Inferred</span>
      case 'ASSUMED':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-dim/20 text-dim font-mono">Assumed</span>
    }
  }

  const getOverallConfidenceBanner = (confidence: 'HIGH' | 'MEDIUM' | 'LOW') => {
    const styles = {
      HIGH: 'bg-success/10 border-success/20 text-success',
      MEDIUM: 'bg-accent/10 border-accent/20 text-accent',
      LOW: 'bg-destructive/10 border-destructive/20 text-destructive'
    }
    const labels = {
      HIGH: 'High Confidence - Most fields explicitly mentioned',
      MEDIUM: 'Medium Confidence - Some fields inferred from context',
      LOW: 'Low Confidence - Many fields assumed from defaults'
    }
    return (
      <div className={`mb-6 p-3 rounded-lg border ${styles[confidence]}`}>
        <div className="flex items-center gap-2 text-sm font-medium font-body">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          {labels[confidence]}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-lg bg-card-bg backdrop-blur-sm border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground font-serif">
            {step === 'input' && 'Describe Your AI Agent'}
            {step === 'processing' && 'Analyzing Your Description...'}
            {step === 'preview' && 'Review AI Agent Profile'}
          </h2>
          <button onClick={onClose} className="text-dim hover:text-muted transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>
        )}

        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <p className="text-muted mb-4 font-body">
              Describe your AI agent in your own words. Tell us about its personality, expertise, how it should communicate, and what topics it should focus on.
            </p>

            <div className="relative mb-4">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g., This AI represents our investor relations team. It should be professional but approachable, focus on our growth metrics and market position, and always be transparent about risks. When discussing financials, use precise numbers but explain them in accessible terms..."
                rows={8}
                className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 pr-12 text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 font-body resize-none"
              />
              {isSupported && (
                <button
                  onClick={toggleVoice}
                  className={`absolute right-3 top-3 p-2 rounded-full transition-colors ${
                    isListening
                      ? 'bg-destructive/20 text-destructive animate-pulse'
                      : 'bg-white/5 text-muted hover:bg-white/10'
                  }`}
                  title={isListening ? 'Stop recording' : 'Start voice input'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
              )}
            </div>

            {isListening && (
              <p className="text-sm text-accent mb-4 flex items-center gap-2 font-body">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse"></span>
                Listening... speak now
              </p>
            )}

            <div className="flex items-center justify-between mb-6">
              <span className={`text-sm font-mono ${isValid ? 'text-accent' : 'text-dim'}`}>
                {charCount} / {MIN_INPUT_LENGTH} min
              </span>
              <button
                onClick={onSwitchToInterview}
                className="text-sm text-dim hover:text-muted underline font-body"
              >
                Switch to guided interview
              </button>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleSynthesize}
                disabled={!isValid}
                variant="default"
              >
                Generate Profile
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="py-12 text-center">
            <div className="mb-6">
              <svg className="w-12 h-12 mx-auto animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <p className="text-lg text-foreground font-serif mb-2">Analyzing your description...</p>
            <p className="text-muted font-body">Extracting structured profile from your input</p>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && synthesisResult && (
          <>
            {getOverallConfidenceBanner(synthesisResult.overallConfidence)}

            {/* Profile Fields by Category */}
            <div className="space-y-6 mb-6">
              {Object.entries(FIELD_CATEGORIES).map(([category, fieldIds]) => (
                <div key={category}>
                  <h3 className="text-sm font-mono text-accent uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {fieldIds.map((fieldId) => {
                      const field = synthesisResult.profile.fields[fieldId as keyof typeof synthesisResult.profile.fields]
                      const isLight = synthesisResult.lightAreas.includes(fieldId)
                      return (
                        <div
                          key={fieldId}
                          className={`p-4 ${isLight ? 'border-l-2 border-l-accent bg-accent/5' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground font-body">
                              {FIELD_TITLES[fieldId]}
                            </span>
                            {getConfidenceBadge(field.confidence)}
                          </div>
                          <p className="text-muted text-sm font-body leading-relaxed">
                            {field.content}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Refinement Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-muted mb-2 font-body">
                Want to refine the profile? Add more context:
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="e.g., Actually, the agent should be more formal with executives. Also emphasize our sustainability initiatives..."
                rows={3}
                className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 font-body"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-muted hover:text-foreground font-body transition-colors"
              >
                Back
              </button>
              <div className="flex gap-3">
                {additionalContext.trim() && (
                  <Button
                    onClick={handleRegenerate}
                    disabled={synthesizing}
                    variant="outline"
                  >
                    {synthesizing ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  variant="default"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
