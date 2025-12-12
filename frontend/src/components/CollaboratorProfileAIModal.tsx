import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { ProfileField } from './ProfileField'
import { Button } from './ui'
import type { CollaboratorProfile } from './SavedProfilesSection'

type Step = 'input' | 'preview'

interface SynthesizedCollaboratorProfile {
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: 'direct' | 'gentle' | 'detailed' | 'high-level' | null
}

interface CollaboratorProfileAIModalProps {
  profile: CollaboratorProfile | null
  onClose: () => void
  onSaved: (profile: CollaboratorProfile) => void
  onSwitchToManual: () => void
}

export function CollaboratorProfileAIModal({
  profile,
  onClose,
  onSaved,
  onSwitchToManual
}: CollaboratorProfileAIModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [rawInput, setRawInput] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [synthesizedProfile, setSynthesizedProfile] = useState<SynthesizedCollaboratorProfile | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition()

  const isEditing = !!profile

  useEffect(() => {
    if (transcript) {
      setRawInput(prev => prev + (prev ? ' ' : '') + transcript)
    }
  }, [transcript])

  useEffect(() => {
    if (isEditing && profile) {
      const existingDesc = [
        profile.name && `Name: ${profile.name}`,
        profile.email && `Email: ${profile.email}`,
        profile.description && `Description: ${profile.description}`,
        profile.communicationNotes && `Communication: ${profile.communicationNotes}`,
        profile.expertiseAreas?.length && `Expertise: ${profile.expertiseAreas.join(', ')}`,
        profile.feedbackStyle && `Feedback style: ${profile.feedbackStyle}`,
      ].filter(Boolean).join('\n')
      setRawInput(existingDesc)
    }
  }, [isEditing, profile])

  const handleSynthesize = async () => {
    if (!rawInput.trim()) {
      setError('Please describe this collaborator first')
      return
    }

    setSynthesizing(true)
    setError('')

    try {
      const context = step === 'preview' ? additionalContext : undefined
      const inputToUse = step === 'preview' && synthesizedProfile
        ? `Previous profile:\n${JSON.stringify(synthesizedProfile, null, 2)}\n\nOriginal input:\n${rawInput}`
        : rawInput

      const response = await api.synthesizeCollaboratorProfile(inputToUse, context)
      setSynthesizedProfile(response.profile)
      setAdditionalContext('')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed')
    } finally {
      setSynthesizing(false)
    }
  }

  const handleSave = async () => {
    if (!synthesizedProfile) return

    setSaving(true)
    setError('')

    try {
      const data = {
        name: synthesizedProfile.name,
        email: synthesizedProfile.email || undefined,
        description: synthesizedProfile.description || undefined,
        communicationNotes: synthesizedProfile.communicationNotes || undefined,
        expertiseAreas: synthesizedProfile.expertiseAreas,
        feedbackStyle: synthesizedProfile.feedbackStyle || undefined,
      }

      let result
      if (isEditing && profile) {
        result = await api.updateCollaboratorProfile(profile.id, data)
      } else {
        result = await api.createCollaboratorProfile(data)
      }
      onSaved(result.profile)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-card-bg backdrop-blur-sm border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {step === 'input'
              ? (isEditing ? 'Edit Collaborator Profile' : 'Create Collaborator Profile')
              : 'Review Collaborator Profile'
            }
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
            <p className="text-muted mb-4">
              Describe this collaborator in your own words. You can speak or type.
            </p>

            <div className="relative mb-4">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g., Sarah is our CFO, sarah@company.com. She's an expert in finance and compliance. She prefers direct, detailed feedback and likes to see data backing up recommendations..."
                rows={6}
                className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 pr-12 text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
              <p className="text-sm text-accent mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse"></span>
                Listening... speak now
              </p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={onSwitchToManual}
                className="text-sm text-dim hover:text-muted underline"
              >
                Switch to manual entry
              </button>
              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSynthesize}
                  disabled={synthesizing || !rawInput.trim()}
                  className="flex items-center gap-2"
                >
                  {synthesizing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate Profile →'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && synthesizedProfile && (
          <>
            <div className="mb-4 p-1 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 text-success text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                Profile Generated
              </div>
            </div>

            {/* Profile Preview */}
            <div className="border border-border rounded-lg divide-y divide-border mb-6">
              <ProfileField label="Name" value={synthesizedProfile.name} />
              <ProfileField label="Email" value={synthesizedProfile.email} />
              <ProfileField label="Description" value={synthesizedProfile.description} />
              <ProfileField label="Communication Notes" value={synthesizedProfile.communicationNotes} />
              <div className="px-4 py-3">
                <div className="text-xs font-mono font-medium text-dim uppercase tracking-wide mb-1">
                  Expertise Areas
                </div>
                <div className="flex flex-wrap gap-2">
                  {synthesizedProfile.expertiseAreas.length > 0 ? (
                    synthesizedProfile.expertiseAreas.map((area, i) => (
                      <span key={i} className="px-2 py-1 bg-info/20 text-info rounded text-sm">
                        {area}
                      </span>
                    ))
                  ) : (
                    <span className="text-dim italic">Not specified</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs font-mono font-medium text-dim uppercase tracking-wide mb-1">
                  Feedback Style
                </div>
                <div>
                  {synthesizedProfile.feedbackStyle ? (
                    <span className="px-2 py-1 bg-purple/20 text-purple rounded text-sm capitalize">
                      {synthesizedProfile.feedbackStyle}
                    </span>
                  ) : (
                    <span className="text-dim italic">Not specified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Refinement Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-muted mb-2">
                Want to add more detail? (optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Add any additional context to refine the profile..."
                rows={3}
                className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-muted hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                {additionalContext.trim() && (
                  <Button
                    onClick={handleSynthesize}
                    disabled={synthesizing}
                    variant="outline"
                  >
                    {synthesizing ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save Profile ✓'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
