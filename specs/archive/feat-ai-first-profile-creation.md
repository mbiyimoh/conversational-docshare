# AI-First Profile Creation

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-09
**Related:** `docs/ideation/ai-first-profile-creation.md`, `specs/feat-saved-audience-collaborator-profiles.md`

---

## Overview

Replace form-based audience/collaborator profile creation with a voice-friendly "brain dump" experience. Users describe their audience or collaborator naturally (via voice or text), AI synthesizes the input into structured profile fields, and users can iteratively refine with additional context before saving.

This establishes the **"AI-assisted manual editing"** pattern - distinct from the Dojo recommendation system which auto-generates profile updates from test comments.

---

## Background/Problem Statement

**Current State:** Users create audience and collaborator profiles by manually filling out 5-6 form fields (name, description, communication style, etc.). This requires decomposing their holistic understanding into discrete fields, which is:
- Tedious and friction-heavy
- Doesn't capture the rich mental model users have
- Particularly painful on mobile or when users want to quickly capture thoughts

**Desired State:** Users can "brain dump" their thoughts about an audience or collaborator (ideally via voice), and AI extracts the structured profile data. This:
- Reduces friction dramatically
- Captures richer context from natural language
- Aligns with mobile-first, voice-first user expectations
- Follows existing synthesis patterns in the codebase (profileSynthesizer.ts)

---

## Goals

- Enable natural language (voice or text) input for profile creation
- AI synthesizes unstructured input into structured profile fields
- Users can review, refine, and iterate before saving
- Same experience for both creating new profiles and editing existing ones
- Provide fallback to manual form if synthesis fails or user prefers
- Follow existing codebase patterns for consistency

---

## Non-Goals

- Custom voice transcription service (browser native API is sufficient)
- Changes to AudienceProfile/CollaboratorProfile database models
- Inline editing of individual synthesized fields in the AI flow
- Real-time streaming synthesis (full response is acceptable)
- Saving draft/incomplete profiles
- Integration with Dojo recommendation system (separate workflow)

---

## Technical Dependencies

### External Libraries/APIs
- **Browser SpeechRecognition API**: Native browser API, no additional dependencies
  - Fallback: `webkitSpeechRecognition` for Safari/Chrome compatibility
  - No polyfill needed - graceful degradation if unsupported
- **OpenAI API**: Already used via `backend/src/utils/openai.ts`
  - Model: `gpt-4-turbo` (consistent with profileSynthesizer.ts)

### Internal Dependencies
- `backend/src/services/profileSynthesizer.ts` - Pattern reference for LLM synthesis
- `backend/src/services/audienceSynthesis.ts` - Pattern reference for incremental refinement
- `frontend/src/components/SavedProfilesSection.tsx` - Component to modify
- `frontend/src/lib/api.ts` - API client to extend
- Existing Prisma models: `AudienceProfile`, `CollaboratorProfile`

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND                                    │
├─────────────────────────────────────────────────────────────────┤
│  SavedProfilesSection.tsx                                       │
│    ├─ AudienceProfileAIModal.tsx (NEW)                         │
│    │    ├─ Step 1: BrainDumpInput (voice/text)                 │
│    │    ├─ Step 2: ProfilePreview (read-only + refine)         │
│    │    └─ Fallback: AudienceProfileFormModal (existing form)  │
│    └─ CollaboratorProfileAIModal.tsx (NEW)                     │
│         ├─ Step 1: BrainDumpInput (voice/text)                 │
│         ├─ Step 2: ProfilePreview (read-only + refine)         │
│         └─ Fallback: CollaboratorProfileFormModal (existing)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND                                     │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/audience-profiles/synthesize                         │
│  POST /api/collaborator-profiles/synthesize                     │
│    └─ profileBrainDumpSynthesizer.ts (NEW)                     │
│         ├─ synthesizeAudienceProfile(rawInput, additionalContext)│
│         └─ synthesizeCollaboratorProfile(rawInput, additionalContext)│
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. INPUT PHASE
   User speaks/types → SpeechRecognition API → textarea value

2. SYNTHESIS PHASE
   rawInput → POST /synthesize → LLM extracts fields → preview JSON (not saved)

3. REFINEMENT PHASE (optional, repeatable)
   preview + additionalContext → POST /synthesize → updated preview

4. SAVE PHASE
   confirmed profile → POST /api/audience-profiles (existing) → saved to DB
```

### Backend Implementation

#### New Service: `backend/src/services/profileBrainDumpSynthesizer.ts`

```typescript
import { getOpenAI } from '../utils/openai'
import { LLMError } from '../utils/errors'

const LLM_TIMEOUT_MS = 60000
const openai = getOpenAI()

// Types matching existing Prisma models
export interface SynthesizedAudienceProfile {
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: 'open' | 'email' | 'password' | 'domain'
}

export interface SynthesizedCollaboratorProfile {
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: 'direct' | 'gentle' | 'detailed' | 'high-level' | null
}

/**
 * Synthesize audience profile from natural language input
 * Follows profileSynthesizer.ts patterns for LLM calls
 */
export async function synthesizeAudienceProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesizedAudienceProfile> {
  const prompt = buildAudiencePrompt(rawInput, additionalContext)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You extract structured audience profile data from natural language descriptions.
Return valid JSON matching the exact schema provided. Infer reasonable defaults when information is missing.`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to synthesize profile: Empty response')
    }

    return JSON.parse(content) as SynthesizedAudienceProfile
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Profile synthesis timed out. Please try again.')
    }
    throw error
  }
}

function buildAudiencePrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT (user provided refinements):\n${additionalContext}`
    : ''

  return `Extract an audience profile from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "name": "Short descriptive name for this audience (e.g., 'Board Members', 'Series A Investors')",
  "description": "Brief description of this audience type",
  "audienceDescription": "Detailed description of who they are, their background, what they care about",
  "communicationStyle": "How the AI should communicate with this audience (tone, formality, detail level)",
  "topicsEmphasis": "Topics and areas to emphasize when talking to this audience",
  "accessType": "open" | "email" | "password" | "domain" (infer from context, default to "password")
}

Guidelines:
- Extract specific details mentioned by the user
- Infer reasonable defaults for missing fields
- Keep name short and descriptive (2-4 words)
- Make communicationStyle actionable for an AI agent
- accessType should be "password" unless user mentions specific access requirements`
}

/**
 * Synthesize collaborator profile from natural language input
 */
export async function synthesizeCollaboratorProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesizedCollaboratorProfile> {
  const prompt = buildCollaboratorPrompt(rawInput, additionalContext)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You extract structured collaborator profile data from natural language descriptions.
Return valid JSON matching the exact schema provided. Infer reasonable defaults when information is missing.`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to synthesize profile: Empty response')
    }

    return JSON.parse(content) as SynthesizedCollaboratorProfile
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Profile synthesis timed out. Please try again.')
    }
    throw error
  }
}

function buildCollaboratorPrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT (user provided refinements):\n${additionalContext}`
    : ''

  return `Extract a collaborator profile from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "name": "Person's name or role identifier",
  "email": "Email address if mentioned, otherwise null",
  "description": "Brief description of this person/role",
  "communicationNotes": "How to communicate with this person (preferences, style)",
  "expertiseAreas": ["array", "of", "expertise", "areas"],
  "feedbackStyle": "direct" | "gentle" | "detailed" | "high-level" | null
}

Guidelines:
- Extract specific details mentioned by the user
- Infer reasonable defaults for missing fields
- expertiseAreas should be an array of strings
- feedbackStyle should match one of the enum values or null if unclear`
}
```

#### New Controller Endpoints

Add to `backend/src/controllers/audienceProfile.controller.ts`:

```typescript
import { synthesizeAudienceProfile } from '../services/profileBrainDumpSynthesizer'

export async function synthesizeAudienceProfileHandler(req: Request, res: Response) {
  const { rawInput, additionalContext } = req.body

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    const profile = await synthesizeAudienceProfile(rawInput, additionalContext)
    return res.json({ profile })
  } catch (error) {
    console.error('Audience profile synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}
```

Add to `backend/src/controllers/collaboratorProfile.controller.ts`:

```typescript
import { synthesizeCollaboratorProfile } from '../services/profileBrainDumpSynthesizer'

export async function synthesizeCollaboratorProfileHandler(req: Request, res: Response) {
  const { rawInput, additionalContext } = req.body

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    const profile = await synthesizeCollaboratorProfile(rawInput, additionalContext)
    return res.json({ profile })
  } catch (error) {
    console.error('Collaborator profile synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}
```

#### New Routes

Add to `backend/src/routes/audienceProfile.routes.ts`:

```typescript
router.post('/audience-profiles/synthesize', authenticate, asyncHandler(synthesizeAudienceProfileHandler))
```

Add to `backend/src/routes/collaboratorProfile.routes.ts`:

```typescript
router.post('/collaborator-profiles/synthesize', authenticate, asyncHandler(synthesizeCollaboratorProfileHandler))
```

### Frontend Implementation

#### API Client Additions

Add to `frontend/src/lib/api.ts`:

```typescript
interface SynthesizedAudienceProfile {
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: 'open' | 'email' | 'password' | 'domain'
}

interface SynthesizedCollaboratorProfile {
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: 'direct' | 'gentle' | 'detailed' | 'high-level' | null
}

async synthesizeAudienceProfile(rawInput: string, additionalContext?: string) {
  return this.request<{ profile: SynthesizedAudienceProfile }>(
    '/api/audience-profiles/synthesize',
    {
      method: 'POST',
      body: JSON.stringify({ rawInput, additionalContext })
    }
  )
}

async synthesizeCollaboratorProfile(rawInput: string, additionalContext?: string) {
  return this.request<{ profile: SynthesizedCollaboratorProfile }>(
    '/api/collaborator-profiles/synthesize',
    {
      method: 'POST',
      body: JSON.stringify({ rawInput, additionalContext })
    }
  )
}
```

#### Voice Input Hook

Create `frontend/src/hooks/useSpeechRecognition.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'

interface SpeechRecognitionHook {
  isListening: boolean
  transcript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Check browser support
  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const isSupported = !!SpeechRecognitionAPI

  useEffect(() => {
    if (!isSupported) return

    const recognition = new SpeechRecognitionAPI!()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript
      }
      setTranscript(finalTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [isSupported])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  }
}

// Type declarations for SpeechRecognition API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
```

#### New Component: AudienceProfileAIModal

Create `frontend/src/components/AudienceProfileAIModal.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { AudienceProfile } from './SavedProfilesSection'

type Step = 'input' | 'preview'

interface SynthesizedAudienceProfile {
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: 'open' | 'email' | 'password' | 'domain'
}

interface AudienceProfileAIModalProps {
  profile: AudienceProfile | null  // null = create, existing = edit
  onClose: () => void
  onSaved: (profile: AudienceProfile) => void
  onSwitchToManual: () => void
}

export function AudienceProfileAIModal({
  profile,
  onClose,
  onSaved,
  onSwitchToManual
}: AudienceProfileAIModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [rawInput, setRawInput] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [synthesizedProfile, setSynthesizedProfile] = useState<SynthesizedAudienceProfile | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition()

  const isEditing = !!profile

  // Sync voice transcript to input
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

  const handleSynthesize = async () => {
    if (!rawInput.trim()) {
      setError('Please describe your audience first')
      return
    }

    setSynthesizing(true)
    setError('')

    try {
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

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <p className="text-gray-600 mb-4">
              Describe this audience in your own words. You can speak or type.
            </p>

            <div className="relative mb-4">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g., These are my board members - mostly senior executives with finance backgrounds. They care about ROI and risk. Keep things high-level but have detailed data ready if they ask..."
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
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

            {isListening && (
              <p className="text-sm text-blue-600 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Listening... speak now
              </p>
            )}

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

        {/* Step 2: Preview */}
        {step === 'preview' && synthesizedProfile && (
          <>
            <div className="mb-4 p-1 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 text-green-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                Profile Generated
              </div>
            </div>

            {/* Profile Preview */}
            <div className="border rounded-lg divide-y mb-6">
              <ProfileField label="Name" value={synthesizedProfile.name} />
              <ProfileField label="Description" value={synthesizedProfile.description} />
              <ProfileField label="Audience" value={synthesizedProfile.audienceDescription} />
              <ProfileField label="Communication Style" value={synthesizedProfile.communicationStyle} />
              <ProfileField label="Topics to Emphasize" value={synthesizedProfile.topicsEmphasis} />
              <ProfileField label="Access Type" value={synthesizedProfile.accessType} />
            </div>

            {/* Refinement Input */}
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

function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-gray-900">
        {value || <span className="text-gray-400 italic">Not specified</span>}
      </div>
    </div>
  )
}
```

#### New Component: CollaboratorProfileAIModal

Create `frontend/src/components/CollaboratorProfileAIModal.tsx` with the same pattern as `AudienceProfileAIModal.tsx`, but adapted for collaborator fields (name, email, description, communicationNotes, expertiseAreas, feedbackStyle).

#### Modified: SavedProfilesSection.tsx

Update to use new AI modals with fallback to existing form modals:

```typescript
// Add imports
import { AudienceProfileAIModal } from './AudienceProfileAIModal'
import { CollaboratorProfileAIModal } from './CollaboratorProfileAIModal'

// Add state for modal mode
const [audienceModalMode, setAudienceModalMode] = useState<'ai' | 'manual'>('ai')
const [collaboratorModalMode, setCollaboratorModalMode] = useState<'ai' | 'manual'>('ai')

// Update modal rendering
{showAudienceModal && (
  audienceModalMode === 'ai' ? (
    <AudienceProfileAIModal
      profile={editingAudienceProfile}
      onClose={() => {
        setShowAudienceModal(false)
        setEditingAudienceProfile(null)
        setAudienceModalMode('ai') // Reset for next time
      }}
      onSaved={handleAudienceProfileSaved}
      onSwitchToManual={() => setAudienceModalMode('manual')}
    />
  ) : (
    <AudienceProfileModal
      profile={editingAudienceProfile}
      onClose={() => {
        setShowAudienceModal(false)
        setEditingAudienceProfile(null)
        setAudienceModalMode('ai')
      }}
      onSaved={handleAudienceProfileSaved}
    />
  )
)}
```

---

## User Experience

### Create New Profile Flow

1. User clicks "+ New Audience Profile" on Dashboard
2. AI modal opens with large textarea + mic button
3. User speaks or types description naturally
4. User clicks "Generate Profile →"
5. Modal shows synthesized profile fields (read-only)
6. User can optionally add refinement context and regenerate
7. User clicks "Save Profile ✓" to save
8. Profile appears in list

### Edit Existing Profile Flow

1. User clicks edit icon on existing profile card
2. AI modal opens pre-populated with existing profile data as text
3. User modifies description or adds new context
4. Same synthesis → review → save flow
5. Profile updated in list

### Fallback to Manual Entry

1. User clicks "Switch to manual entry" link at bottom of input step
2. Modal switches to existing form-based modal
3. User fills fields manually
4. Save works as before

---

## Testing Strategy

### Unit Tests

**Backend Service Tests** (`backend/src/services/__tests__/profileBrainDumpSynthesizer.test.ts`):

```typescript
describe('profileBrainDumpSynthesizer', () => {
  describe('synthesizeAudienceProfile', () => {
    // Purpose: Verify LLM extracts structured fields from natural language
    it('should extract name and description from simple input', async () => {
      const result = await synthesizeAudienceProfile(
        'Board members who care about ROI'
      )
      expect(result.name).toBeTruthy()
      expect(typeof result.name).toBe('string')
      expect(result.accessType).toMatch(/^(open|email|password|domain)$/)
    })

    // Purpose: Verify additional context modifies output
    it('should incorporate additional context into synthesis', async () => {
      const initial = await synthesizeAudienceProfile('investors')
      const refined = await synthesizeAudienceProfile(
        'investors',
        'They are specifically Series A VCs focused on B2B SaaS'
      )
      // Refined should have more specific content
      expect(refined.audienceDescription?.length).toBeGreaterThan(
        initial.audienceDescription?.length ?? 0
      )
    })

    // Purpose: Verify error handling on empty input
    it('should throw on empty input', async () => {
      await expect(synthesizeAudienceProfile('')).rejects.toThrow()
    })
  })

  describe('synthesizeCollaboratorProfile', () => {
    // Purpose: Verify email extraction from natural language
    it('should extract email if mentioned', async () => {
      const result = await synthesizeCollaboratorProfile(
        'John Smith, john@example.com, our CFO'
      )
      expect(result.email).toBe('john@example.com')
    })

    // Purpose: Verify expertise areas are extracted as array
    it('should extract expertise areas as array', async () => {
      const result = await synthesizeCollaboratorProfile(
        'Sarah, expert in finance, legal, and operations'
      )
      expect(Array.isArray(result.expertiseAreas)).toBe(true)
      expect(result.expertiseAreas.length).toBeGreaterThan(0)
    })
  })
})
```

### Integration Tests

**API Endpoint Tests** (`backend/src/controllers/__tests__/audienceProfile.synthesis.test.ts`):

```typescript
describe('POST /api/audience-profiles/synthesize', () => {
  // Purpose: Verify authenticated users can synthesize profiles
  it('should return synthesized profile for authenticated user', async () => {
    const response = await request(app)
      .post('/api/audience-profiles/synthesize')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rawInput: 'Board members focused on governance' })

    expect(response.status).toBe(200)
    expect(response.body.profile).toBeDefined()
    expect(response.body.profile.name).toBeTruthy()
  })

  // Purpose: Verify unauthenticated requests are rejected
  it('should reject unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/audience-profiles/synthesize')
      .send({ rawInput: 'test' })

    expect(response.status).toBe(401)
  })

  // Purpose: Verify validation on empty input
  it('should return 400 for empty rawInput', async () => {
    const response = await request(app)
      .post('/api/audience-profiles/synthesize')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rawInput: '' })

    expect(response.status).toBe(400)
  })
})
```

### E2E Tests

**Playwright Tests** (`e2e/ai-profile-creation.spec.ts`):

```typescript
import { test, expect } from '@playwright/test'

test.describe('AI Profile Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    // Login
  })

  // Purpose: Verify complete create flow works end-to-end
  test('should create audience profile via AI synthesis', async ({ page }) => {
    await page.click('text=+ New Audience Profile')

    // Input step
    await page.fill('textarea', 'My board members are senior executives focused on ROI')
    await page.click('text=Generate Profile')

    // Preview step
    await expect(page.locator('text=Profile Generated')).toBeVisible()
    await expect(page.locator('text=Name')).toBeVisible()

    // Save
    await page.click('text=Save Profile')

    // Verify in list
    await expect(page.locator('[data-testid="saved-profiles-section"]')).toContainText('board')
  })

  // Purpose: Verify voice button appears when supported
  test('should show voice input button', async ({ page }) => {
    await page.click('text=+ New Audience Profile')
    // Voice button should be visible (even if not functional in test)
    await expect(page.locator('button[title*="voice"]')).toBeVisible()
  })

  // Purpose: Verify fallback to manual works
  test('should allow switching to manual entry', async ({ page }) => {
    await page.click('text=+ New Audience Profile')
    await page.click('text=Switch to manual entry')

    // Should show form fields
    await expect(page.locator('input[id="ap-name"]')).toBeVisible()
  })
})
```

---

## Performance Considerations

### LLM Latency
- **Issue**: Synthesis calls may take 2-5 seconds
- **Mitigation**:
  - Show loading spinner during synthesis
  - 60-second timeout prevents hanging
  - Error handling with user-friendly messages

### Voice Recognition
- **Issue**: Browser API quality varies
- **Mitigation**:
  - Graceful degradation if unsupported
  - Visual feedback during listening
  - Manual text input always available

---

## Security Considerations

### Input Validation
- Sanitize rawInput before sending to LLM
- Validate additionalContext length (prevent prompt injection)
- Rate limit synthesis endpoints (prevent abuse)

### Authentication
- All synthesis endpoints require authentication
- User can only save profiles to their own account

### LLM Safety
- System prompts constrain output format
- JSON response format prevents arbitrary text injection
- Output validated before returning to client

---

## Documentation

### Updates Required
- `CLAUDE.md`: Add "AI-First Profile Creation" section documenting the pattern
- `frontend/src/hooks/useSpeechRecognition.ts`: JSDoc comments for hook usage
- API documentation: New synthesis endpoints

---

## Implementation Phases

### Phase 1: Core Synthesis (Backend)
- Create `profileBrainDumpSynthesizer.ts` service
- Add synthesis endpoints to controllers
- Add routes
- Unit tests for service

### Phase 2: AI Modals (Frontend)
- Create `useSpeechRecognition` hook
- Create `AudienceProfileAIModal.tsx`
- Create `CollaboratorProfileAIModal.tsx`
- Integrate into `SavedProfilesSection.tsx`

### Phase 3: Polish & Testing
- E2E tests
- Error handling refinement
- Voice input UX polish
- Documentation updates

---

## Open Questions

None - all clarifications resolved during ideation.

---

## References

- Ideation document: `docs/ideation/ai-first-profile-creation.md`
- Pattern reference: `backend/src/services/profileSynthesizer.ts`
- Incremental refinement pattern: `backend/src/services/audienceSynthesis.ts`
- Original profiles spec: `specs/feat-saved-audience-collaborator-profiles.md`
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
