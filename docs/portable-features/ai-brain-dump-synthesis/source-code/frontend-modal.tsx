/**
 * AI Brain Dump Synthesis - Frontend Modal Component
 *
 * Complete React modal implementing the 2-step wizard:
 * Step 1: Input (voice/text) → Step 2: Preview → Save
 *
 * This example is for an "Audience Profile" entity.
 * Adapt the types, API calls, and preview rendering for your entity.
 *
 * Dependencies:
 * - React 18+
 * - Tailwind CSS
 * - Your API client
 * - useSpeechRecognition hook
 * - ProfileField component
 */

import { useState, useEffect } from 'react'
import { api } from '../lib/api'  // Adapt to your API client
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { ProfileField } from './ProfileField'

// ============================================================================
// Types - Adapt these to your entity
// ============================================================================

type Step = 'input' | 'preview'

interface SynthesizedAudienceProfile {
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: 'open' | 'email' | 'password' | 'domain'
}

// Your existing entity type (from database)
interface AudienceProfile {
  id: string
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: string
}

interface AudienceProfileAIModalProps {
  profile: AudienceProfile | null  // null = create, existing = edit
  onClose: () => void
  onSaved: (profile: AudienceProfile) => void
  onSwitchToManual: () => void
}

// ============================================================================
// Component
// ============================================================================

export function AudienceProfileAIModal({
  profile,
  onClose,
  onSaved,
  onSwitchToManual
}: AudienceProfileAIModalProps) {
  // Step state
  const [step, setStep] = useState<Step>('input')

  // Input state
  const [rawInput, setRawInput] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  // Synthesis state
  const [synthesizedProfile, setSynthesizedProfile] = useState<SynthesizedAudienceProfile | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Voice input hook
  const {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition()

  const isEditing = !!profile

  // ============================================================================
  // Effects
  // ============================================================================

  // Sync voice transcript to input field
  useEffect(() => {
    if (transcript) {
      setRawInput(prev => prev + (prev ? ' ' : '') + transcript)
    }
  }, [transcript])

  // Pre-populate with existing profile description for edit mode
  useEffect(() => {
    if (isEditing && profile) {
      const existingDesc = [
        profile.name && `Name: ${profile.name}`,
        profile.description && `Description: ${profile.description}`,
        profile.audienceDescription && `Audience: ${profile.audienceDescription}`,
        profile.communicationStyle && `Communication: ${profile.communicationStyle}`,
        profile.topicsEmphasis && `Topics: ${profile.topicsEmphasis}`,
      ].filter(Boolean).join('\n')
      setRawInput(existingDesc)
    }
  }, [isEditing, profile])

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSynthesize = async () => {
    if (!rawInput.trim()) {
      setError('Please describe your audience first')
      return
    }

    setSynthesizing(true)
    setError('')

    try {
      // For regeneration, include previous profile in context
      const context = step === 'preview' ? additionalContext : undefined
      const inputToUse = step === 'preview' && synthesizedProfile
        ? `Previous profile:\n${JSON.stringify(synthesizedProfile, null, 2)}\n\nOriginal input:\n${rawInput}`
        : rawInput

      const response = await api.synthesizeAudienceProfile(inputToUse, context)
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
      // Map synthesized profile to API data format
      const data = {
        name: synthesizedProfile.name,
        description: synthesizedProfile.description || undefined,
        audienceDescription: synthesizedProfile.audienceDescription || undefined,
        communicationStyle: synthesizedProfile.communicationStyle || undefined,
        topicsEmphasis: synthesizedProfile.topicsEmphasis || undefined,
        accessType: synthesizedProfile.accessType,
      }

      let result
      if (isEditing && profile) {
        result = await api.updateAudienceProfile(profile.id, data)
      } else {
        result = await api.createAudienceProfile(data)
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

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {step === 'input'
              ? (isEditing ? 'Edit Audience Profile' : 'Create Audience Profile')
              : 'Review Audience Profile'
            }
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* ================================================================ */}
        {/* Step 1: Input                                                    */}
        {/* ================================================================ */}
        {step === 'input' && (
          <>
            <p className="text-gray-600 mb-4">
              Describe this audience in your own words. You can speak or type.
            </p>

            {/* Input Textarea with Voice Button */}
            <div className="relative mb-4">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g., These are my board members - mostly senior executives with finance backgrounds. They care about ROI and risk. Keep things high-level but have detailed data ready if they ask..."
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {/* Voice Button - Only shown if browser supports it */}
              {isSupported && (
                <button
                  onClick={toggleVoice}
                  className={`absolute right-3 top-3 p-2 rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

            {/* Listening Indicator */}
            {isListening && (
              <p className="text-sm text-blue-600 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Listening... speak now
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={onSwitchToManual}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Switch to manual entry
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSynthesize}
                  disabled={synthesizing || !rawInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* Step 2: Preview                                                  */}
        {/* ================================================================ */}
        {step === 'preview' && synthesizedProfile && (
          <>
            {/* Success Banner */}
            <div className="mb-4 p-1 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 text-green-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                Profile Generated
              </div>
            </div>

            {/* Profile Preview - Adapt these fields to your entity */}
            <div className="border rounded-lg divide-y mb-6">
              <ProfileField label="Name" value={synthesizedProfile.name} />
              <ProfileField label="Description" value={synthesizedProfile.description} />
              <ProfileField label="Audience" value={synthesizedProfile.audienceDescription} />
              <ProfileField label="Communication Style" value={synthesizedProfile.communicationStyle} />
              <ProfileField label="Topics to Emphasize" value={synthesizedProfile.topicsEmphasis} />
              <ProfileField label="Access Type" value={synthesizedProfile.accessType} />
            </div>

            {/* Refinement Input - Optional improvement loop */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Want to add more detail? (optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Add any additional context to refine the profile..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                {/* Regenerate button - only shown when additional context is provided */}
                {additionalContext.trim() && (
                  <button
                    onClick={handleSynthesize}
                    disabled={synthesizing}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    {synthesizing ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save Profile ✓'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
