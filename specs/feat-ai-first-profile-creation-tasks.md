# Task Breakdown: AI-First Profile Creation

Generated: 2025-12-09
Source: specs/feat-ai-first-profile-creation.md

## Overview

Replace form-based audience/collaborator profile creation with a voice-friendly "brain dump" experience. Users describe their audience or collaborator naturally (via voice or text), AI synthesizes the input into structured profile fields, and users can iteratively refine before saving.

## Phase 1: Core Synthesis (Backend)

### Task 1.1: Create profileBrainDumpSynthesizer Service

**Description**: Build the core synthesis service that converts natural language to structured profile data
**Size**: Large
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**Technical Requirements**:
- Follow existing profileSynthesizer.ts patterns (timeout, temperature 0.3, JSON response format)
- Use gpt-4-turbo model consistent with codebase
- 60-second timeout with AbortController
- Support both audience and collaborator profile types
- Handle additional context for iterative refinement

**File to create**: `backend/src/services/profileBrainDumpSynthesizer.ts`

**Complete Implementation**:
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

**Acceptance Criteria**:
- [ ] Service file created at correct location
- [ ] Both synthesizeAudienceProfile and synthesizeCollaboratorProfile exported
- [ ] Uses 60-second timeout with AbortController
- [ ] Uses gpt-4-turbo model with temperature 0.3
- [ ] Returns properly typed interfaces
- [ ] Handles timeout errors gracefully
- [ ] Supports additionalContext for refinement

---

### Task 1.2: Add Synthesis Controller Handlers

**Description**: Add HTTP handlers for synthesis endpoints to existing controllers
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**File to modify**: `backend/src/controllers/audienceProfile.controller.ts`

**Code to add**:
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

**File to modify**: `backend/src/controllers/collaboratorProfile.controller.ts`

**Code to add**:
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

**Acceptance Criteria**:
- [ ] Handlers added to both controllers
- [ ] Input validation returns 400 for empty rawInput
- [ ] Error handling returns 500 with message
- [ ] Exports handlers for route registration

---

### Task 1.3: Register Synthesis Routes

**Description**: Add route registrations for synthesis endpoints
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**File to modify**: `backend/src/routes/audienceProfile.routes.ts`

**Code to add**:
```typescript
import { synthesizeAudienceProfileHandler } from '../controllers/audienceProfile.controller'

router.post('/audience-profiles/synthesize', authenticate, asyncHandler(synthesizeAudienceProfileHandler))
```

**File to modify**: `backend/src/routes/collaboratorProfile.routes.ts`

**Code to add**:
```typescript
import { synthesizeCollaboratorProfileHandler } from '../controllers/collaboratorProfile.controller'

router.post('/collaborator-profiles/synthesize', authenticate, asyncHandler(synthesizeCollaboratorProfileHandler))
```

**Acceptance Criteria**:
- [ ] Routes registered with authentication middleware
- [ ] POST /api/audience-profiles/synthesize works
- [ ] POST /api/collaborator-profiles/synthesize works
- [ ] Returns 401 for unauthenticated requests

---

### Task 1.4: Backend Unit Tests

**Description**: Write unit tests for synthesis service
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, 1.3

**File to create**: `backend/src/services/__tests__/profileBrainDumpSynthesizer.test.ts`

**Complete Implementation**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { synthesizeAudienceProfile, synthesizeCollaboratorProfile } from '../profileBrainDumpSynthesizer'

// Note: These are integration tests that call the real OpenAI API
// Run sparingly to avoid API costs

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
    }, 30000)

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
    }, 60000)

    // Purpose: Verify all expected fields are returned
    it('should return all required fields', async () => {
      const result = await synthesizeAudienceProfile(
        'Technical engineers evaluating our API'
      )
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('description')
      expect(result).toHaveProperty('audienceDescription')
      expect(result).toHaveProperty('communicationStyle')
      expect(result).toHaveProperty('topicsEmphasis')
      expect(result).toHaveProperty('accessType')
    }, 30000)
  })

  describe('synthesizeCollaboratorProfile', () => {
    // Purpose: Verify email extraction from natural language
    it('should extract email if mentioned', async () => {
      const result = await synthesizeCollaboratorProfile(
        'John Smith, john@example.com, our CFO'
      )
      expect(result.email).toBe('john@example.com')
    }, 30000)

    // Purpose: Verify expertise areas are extracted as array
    it('should extract expertise areas as array', async () => {
      const result = await synthesizeCollaboratorProfile(
        'Sarah, expert in finance, legal, and operations'
      )
      expect(Array.isArray(result.expertiseAreas)).toBe(true)
      expect(result.expertiseAreas.length).toBeGreaterThan(0)
    }, 30000)

    // Purpose: Verify feedbackStyle enum is respected
    it('should return valid feedbackStyle enum or null', async () => {
      const result = await synthesizeCollaboratorProfile(
        'Mike prefers direct feedback'
      )
      expect(
        result.feedbackStyle === null ||
        ['direct', 'gentle', 'detailed', 'high-level'].includes(result.feedbackStyle)
      ).toBe(true)
    }, 30000)
  })
})
```

**Acceptance Criteria**:
- [ ] Tests cover audience profile synthesis
- [ ] Tests cover collaborator profile synthesis
- [ ] Tests verify field extraction
- [ ] Tests verify additional context refinement
- [ ] Tests have appropriate timeouts (30-60s)
- [ ] All tests pass

---

## Phase 2: AI Modals (Frontend)

### Task 2.1: Create useSpeechRecognition Hook

**Description**: Build React hook for browser native speech recognition
**Size**: Medium
**Priority**: High
**Dependencies**: None (can start parallel with Phase 1)
**Can run parallel with**: Task 1.1-1.4

**File to create**: `frontend/src/hooks/useSpeechRecognition.ts`

**Complete Implementation**:
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

**Acceptance Criteria**:
- [ ] Hook file created at correct location
- [ ] Returns isSupported flag for graceful degradation
- [ ] startListening/stopListening work correctly
- [ ] Transcript updates in real-time
- [ ] resetTranscript clears state
- [ ] TypeScript declarations for global SpeechRecognition

---

### Task 2.2: Add API Client Methods

**Description**: Add synthesis methods to frontend API client
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.3 (routes must exist)
**Can run parallel with**: Task 2.1

**File to modify**: `frontend/src/lib/api.ts`

**Code to add** (add interfaces and methods to API class):
```typescript
// Add these interfaces near other interfaces
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

// Add these methods to the API class
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

**Acceptance Criteria**:
- [ ] Interfaces added matching backend types
- [ ] synthesizeAudienceProfile method works
- [ ] synthesizeCollaboratorProfile method works
- [ ] Proper TypeScript typing

---

### Task 2.3: Create AudienceProfileAIModal Component

**Description**: Build the primary AI-powered modal for audience profile creation/editing
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**File to create**: `frontend/src/components/AudienceProfileAIModal.tsx`

**Complete Implementation**: (Full component from spec - 300+ lines)
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

**Acceptance Criteria**:
- [ ] Modal renders with max-w-2xl width
- [ ] Input step shows textarea + mic button
- [ ] Voice input works when supported
- [ ] "Listening..." indicator shows during recording
- [ ] Generate Profile button calls synthesis API
- [ ] Preview step shows all synthesized fields
- [ ] Refinement textarea allows additional context
- [ ] Regenerate button works
- [ ] Save button creates/updates profile
- [ ] "Switch to manual entry" link works
- [ ] Loading spinners during synthesis/save
- [ ] Error states display properly
- [ ] Edit mode pre-populates with existing profile data

---

### Task 2.4: Create CollaboratorProfileAIModal Component

**Description**: Build AI-powered modal for collaborator profile creation/editing
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: Task 2.3

**File to create**: `frontend/src/components/CollaboratorProfileAIModal.tsx`

**Technical Requirements**:
- Same pattern as AudienceProfileAIModal
- Different fields: name, email, description, communicationNotes, expertiseAreas, feedbackStyle
- expertiseAreas displays as comma-separated list or pills
- feedbackStyle shows as badge/chip

**Complete Implementation**: (Adapt AudienceProfileAIModal with these differences)
```typescript
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {step === 'input'
              ? (isEditing ? 'Edit Collaborator Profile' : 'Create Collaborator Profile')
              : 'Review Collaborator Profile'
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
              Describe this collaborator in your own words. You can speak or type.
            </p>

            <div className="relative mb-4">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g., Sarah is our CFO, sarah@company.com. She's an expert in finance and compliance. She prefers direct, detailed feedback and likes to see data backing up recommendations..."
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
              <ProfileField label="Email" value={synthesizedProfile.email} />
              <ProfileField label="Description" value={synthesizedProfile.description} />
              <ProfileField label="Communication Notes" value={synthesizedProfile.communicationNotes} />
              <div className="px-4 py-3">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Expertise Areas
                </div>
                <div className="flex flex-wrap gap-2">
                  {synthesizedProfile.expertiseAreas.length > 0 ? (
                    synthesizedProfile.expertiseAreas.map((area, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {area}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Feedback Style
                </div>
                <div>
                  {synthesizedProfile.feedbackStyle ? (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm capitalize">
                      {synthesizedProfile.feedbackStyle}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </div>
              </div>
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

**Acceptance Criteria**:
- [ ] Modal renders with max-w-2xl width
- [ ] Same UX as AudienceProfileAIModal
- [ ] expertiseAreas shows as pills/chips
- [ ] feedbackStyle shows as badge
- [ ] Edit mode pre-populates correctly
- [ ] Save creates/updates collaborator profile

---

### Task 2.5: Integrate AI Modals into SavedProfilesSection

**Description**: Update SavedProfilesSection to use AI modals with manual fallback
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.3, Task 2.4
**Can run parallel with**: None

**File to modify**: `frontend/src/components/SavedProfilesSection.tsx`

**Changes to make**:
1. Add imports for new AI modals
2. Add state for modal mode (ai | manual)
3. Update modal rendering to conditionally show AI or manual modal
4. Reset modal mode on close

**Code changes**:
```typescript
// Add imports at top
import { AudienceProfileAIModal } from './AudienceProfileAIModal'
import { CollaboratorProfileAIModal } from './CollaboratorProfileAIModal'

// Add state (inside component)
const [audienceModalMode, setAudienceModalMode] = useState<'ai' | 'manual'>('ai')
const [collaboratorModalMode, setCollaboratorModalMode] = useState<'ai' | 'manual'>('ai')

// Update modal rendering for audience profiles
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

// Update modal rendering for collaborator profiles (same pattern)
{showCollaboratorModal && (
  collaboratorModalMode === 'ai' ? (
    <CollaboratorProfileAIModal
      profile={editingCollaboratorProfile}
      onClose={() => {
        setShowCollaboratorModal(false)
        setEditingCollaboratorProfile(null)
        setCollaboratorModalMode('ai')
      }}
      onSaved={handleCollaboratorProfileSaved}
      onSwitchToManual={() => setCollaboratorModalMode('manual')}
    />
  ) : (
    <CollaboratorProfileModal
      profile={editingCollaboratorProfile}
      onClose={() => {
        setShowCollaboratorModal(false)
        setEditingCollaboratorProfile(null)
        setCollaboratorModalMode('ai')
      }}
      onSaved={handleCollaboratorProfileSaved}
    />
  )
)}
```

**Acceptance Criteria**:
- [ ] AI modal shows by default for new profiles
- [ ] AI modal shows by default for editing profiles
- [ ] "Switch to manual" shows form modal
- [ ] Modal mode resets to 'ai' on close
- [ ] All existing functionality preserved

---

## Phase 3: Polish & Testing

### Task 3.1: E2E Tests

**Description**: Write Playwright E2E tests for AI profile creation
**Size**: Medium
**Priority**: Medium
**Dependencies**: All Phase 1 and Phase 2 tasks
**Can run parallel with**: Task 3.2

**File to create**: `e2e/ai-profile-creation.spec.ts`

**Complete Implementation**:
```typescript
import { test, expect } from '@playwright/test'

test.describe('AI Profile Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    // Login with test credentials
    await page.fill('input[type="email"]', 'mbiyimoh@gmail.com')
    await page.fill('input[type="password"]', 'MGinfinity09!')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test.describe('Audience Profiles', () => {
    // Purpose: Verify complete create flow works end-to-end
    test('should create audience profile via AI synthesis', async ({ page }) => {
      await page.click('text=+ New Audience Profile')

      // Input step
      await expect(page.locator('h2:text("Create Audience Profile")')).toBeVisible()
      await page.fill('textarea', 'My board members are senior executives focused on ROI and governance')
      await page.click('text=Generate Profile')

      // Wait for synthesis (may take a few seconds)
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })
      await expect(page.locator('text=Name')).toBeVisible()

      // Save
      await page.click('text=Save Profile')

      // Verify in list
      await expect(page.locator('[data-testid="saved-profiles-section"]')).toContainText('board', { ignoreCase: true })
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

    // Purpose: Verify edit flow pre-populates
    test('should edit existing profile with AI', async ({ page }) => {
      // First create a profile
      await page.click('text=+ New Audience Profile')
      await page.fill('textarea', 'Test audience')
      await page.click('text=Generate Profile')
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })
      await page.click('text=Save Profile')

      // Now edit it
      await page.click('[data-testid="edit-audience-profile"]')

      // Should show Edit title
      await expect(page.locator('h2:text("Edit Audience Profile")')).toBeVisible()
      // Should have pre-populated text
      await expect(page.locator('textarea')).not.toBeEmpty()
    })
  })

  test.describe('Collaborator Profiles', () => {
    // Purpose: Verify collaborator create flow
    test('should create collaborator profile via AI synthesis', async ({ page }) => {
      await page.click('text=+ New Collaborator')

      await page.fill('textarea', 'Sarah is our CFO, expert in finance and compliance')
      await page.click('text=Generate Profile')

      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })
      await page.click('text=Save Profile')

      await expect(page.locator('[data-testid="saved-profiles-section"]')).toContainText('Sarah', { ignoreCase: true })
    })

    // Purpose: Verify expertise areas display correctly
    test('should display expertise areas as pills', async ({ page }) => {
      await page.click('text=+ New Collaborator')
      await page.fill('textarea', 'John expert in design, engineering, and marketing')
      await page.click('text=Generate Profile')

      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })
      // Expertise should show as pills
      await expect(page.locator('.bg-blue-100')).toBeVisible()
    })
  })
})
```

**Acceptance Criteria**:
- [ ] Tests cover audience profile creation
- [ ] Tests cover collaborator profile creation
- [ ] Tests verify voice button visibility
- [ ] Tests verify manual fallback
- [ ] Tests verify edit flow
- [ ] All tests pass in CI

---

### Task 3.2: Update CLAUDE.md Documentation

**Description**: Add AI-First Profile Creation section to CLAUDE.md
**Size**: Small
**Priority**: Low
**Dependencies**: All implementation tasks
**Can run parallel with**: Task 3.1

**File to modify**: `CLAUDE.md`

**Content to add** (after Profile Recommendation System section):
```markdown
---

## AI-First Profile Creation

**What:** Voice-friendly brain dump to structured profiles. Users describe audiences/collaborators naturally via voice or text, AI synthesizes to structured fields.

**Files:**
- `backend/src/services/profileBrainDumpSynthesizer.ts` - LLM synthesis service
- `frontend/src/components/AudienceProfileAIModal.tsx` - AI modal for audiences
- `frontend/src/components/CollaboratorProfileAIModal.tsx` - AI modal for collaborators
- `frontend/src/hooks/useSpeechRecognition.ts` - Browser speech recognition hook

**Pattern:** "AI-assisted manual editing" - distinct from Dojo recommendation system:
- This feature: User brain dumps → AI synthesizes → user refines → save
- Dojo: AI analyzes test comments → generates recommendations → user approves

**APIs:**
- `POST /api/audience-profiles/synthesize` - preview synthesis (not saved)
- `POST /api/collaborator-profiles/synthesize` - preview synthesis (not saved)

**Key Implementation Notes:**
- Uses browser native SpeechRecognition API (graceful degradation)
- 60-second LLM timeout matches profileSynthesizer.ts pattern
- Supports iterative refinement with additionalContext parameter
- "Switch to manual entry" fallback available
```

**Acceptance Criteria**:
- [ ] Documentation added to correct location in CLAUDE.md
- [ ] Pattern distinction clearly explained
- [ ] API endpoints documented
- [ ] Key files listed

---

## Execution Summary

### Total Tasks: 10

### By Phase:
- **Phase 1 (Backend)**: 4 tasks
- **Phase 2 (Frontend)**: 5 tasks
- **Phase 3 (Polish)**: 2 tasks

### Parallel Execution Opportunities:
- Tasks 2.1 can run parallel with 1.1-1.4 (no backend dependency for hook)
- Tasks 2.3 and 2.4 can run in parallel (independent modals)
- Tasks 3.1 and 3.2 can run in parallel

### Critical Path:
1.1 → 1.2 → 1.3 → 2.2 → 2.3/2.4 → 2.5 → 3.1

### Estimated Execution Order:
1. Task 1.1 + Task 2.1 (parallel)
2. Task 1.2
3. Task 1.3 + Task 1.4 (parallel)
4. Task 2.2
5. Task 2.3 + Task 2.4 (parallel)
6. Task 2.5
7. Task 3.1 + Task 3.2 (parallel)
