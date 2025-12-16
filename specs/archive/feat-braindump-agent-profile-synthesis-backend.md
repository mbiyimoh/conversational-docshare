# Braindump Agent Profile Synthesis Backend

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-13
**Phase:** 1 of 3 (Backend Only)
**Related:** `docs/ideation/braindump-to-agent-profile-system.md`, `specs/feat-ai-first-profile-creation.md`

---

## Overview

Add backend synthesis system that extracts a structured 12-field AI agent profile from natural language "braindump" input. This replaces the interview-first approach with a voice/text-friendly brain dump experience, including per-field confidence signals and light area tracking to encourage iterative refinement.

This is Phase 1 of a 3-phase implementation:
- **Phase 1 (this spec):** Database schema + backend synthesis service + API endpoint
- **Phase 2:** Frontend braindump modal (5-step wizard)
- **Phase 3:** AgentProfile.tsx updates + interview→12-field mapping

---

## Background/Problem Statement

**Current State:** Users create AI agent profiles through a 5-step interview wizard (`AgentInterview.tsx`) that generates a 5-section profile. This approach:
- Requires decomposing holistic understanding into discrete fields
- Forces question-by-question navigation even when users have complete mental model
- Has no voice input support
- Provides no confidence indicators on generated content
- Requires re-running entire interview to regenerate

**Desired State:** Users can "brain dump" their thoughts naturally (voice or text), and AI extracts a richer 12-field profile with confidence signals. Inferred fields are highlighted to encourage iterative refinement.

**Evidence:**
- User successfully implemented this pattern in another project with positive feedback
- Existing `AudienceProfileAIModal.tsx` already validates this pattern for audience/collaborator profiles
- Research shows voice-first UX reduces friction for conversational input

---

## Goals

- Extract 12-field structured profile from unstructured natural language input
- Return per-field confidence signals (EXPLICIT, INFERRED, ASSUMED)
- Track "light areas" (non-explicit fields) for UI highlighting
- Store raw braindump for future reference/regeneration
- Support iterative refinement via additionalContext parameter
- Maintain backward compatibility with existing 5-section profiles

---

## Non-Goals

- Frontend modal implementation (Phase 2)
- AgentProfile.tsx display updates (Phase 3)
- Interview → 12-field mapping (Phase 3)
- Per-field refinement endpoint (deferred)
- Real-time streaming synthesis
- Automatic migration of existing profiles to 12-field format

---

## Technical Dependencies

### External Libraries/APIs
- **OpenAI API** (existing): `gpt-4-turbo` model via `backend/src/utils/openai.ts`
- **Prisma ORM** (existing): Schema management and database access

### Internal Dependencies
- `backend/src/services/profileSynthesizer.ts` - Pattern reference for LLM calls
- `backend/src/services/profileBrainDumpSynthesizer.ts` - Pattern reference for braindump synthesis
- `backend/src/utils/errors.ts` - Custom error classes (LLMError, ValidationError)
- `backend/src/middleware/errorHandler.ts` - asyncHandler wrapper

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Layer                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  POST /api/projects/:projectId/profile/synthesize                       │
│    ├─ Authentication middleware (existing)                              │
│    ├─ Request validation (manual, pattern from existing controllers)    │
│    └─ synthesizeAgentProfileHandler()                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  synthesizeFromBrainDump(rawInput, additionalContext?)                  │
│    ├─ Build LLM prompt with 12-field schema                             │
│    ├─ Call GPT-4-turbo with JSON response mode                          │
│    ├─ Parse and validate response                                       │
│    ├─ Extract confidence signals per field                              │
│    ├─ Build lightAreas array (non-EXPLICIT fields)                      │
│    └─ Return BrainDumpSynthesisResult                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Database Layer                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  AgentConfig (updated)                                                  │
│    ├─ rawBrainDump: String? @db.Text                                    │
│    ├─ synthesisMode: String? ("voice" | "text" | "interview")           │
│    ├─ lightAreas: String[] (field IDs with low confidence)              │
│    └─ profile: Json (now supports 12-field structure)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

**File:** `backend/prisma/schema.prisma`

Add new fields to `AgentConfig` model:

```prisma
model AgentConfig {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Interview responses (existing - keep for backward compatibility)
  interviewData Json

  // Configuration status (existing)
  status          String @default("incomplete")
  completionLevel Float  @default(0)

  // AI model preferences (existing)
  preferredModel String @default("gpt-4-turbo")
  temperature    Float  @default(0.7)

  // Synthesized profile (existing - structure updated)
  profile            Json?
  profileGeneratedAt DateTime?
  profileSource      String?   // "interview" | "braindump" | "manual"
  profileVersion     Int       @default(1)

  // NEW: Braindump storage
  rawBrainDump   String?  @db.Text  // Original user input for regeneration
  synthesisMode  String?            // "voice" | "text" | "interview"
  lightAreas     String[]           // Field IDs with confidence != EXPLICIT

  // Timestamps (existing)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("agent_configs")
}
```

### TypeScript Type Definitions

**File:** `backend/src/services/profileSynthesizer.ts` (add types)

```typescript
// Confidence levels - qualitative, not numeric
export type ConfidenceLevel = 'EXPLICIT' | 'INFERRED' | 'ASSUMED'

// Individual profile field with confidence tracking
export interface ProfileField {
  id: string
  title: string
  content: string
  confidence: ConfidenceLevel
  isEdited: boolean
  editedAt?: string
  editSource?: 'manual' | 'recommendation'
}

// 12-field profile structure organized by category
export interface AgentProfileV2 {
  fields: {
    // Identity & Context
    agentIdentity: ProfileField
    domainExpertise: ProfileField
    targetAudience: ProfileField
    // Communication & Style
    toneAndVoice: ProfileField
    languagePatterns: ProfileField
    adaptationRules: ProfileField
    // Content & Priorities
    keyTopics: ProfileField
    avoidanceAreas: ProfileField
    examplePreferences: ProfileField
    // Engagement & Behavior
    proactiveGuidance: ProfileField
    framingStrategies: ProfileField
    successCriteria: ProfileField
  }
  generatedAt: string
  source: 'braindump' | 'interview' | 'manual'
  version: 2  // Distinguish from legacy 5-section profiles
}

// Synthesis result returned to frontend
export interface BrainDumpSynthesisResult {
  profile: AgentProfileV2
  lightAreas: string[]  // Field IDs where confidence !== 'EXPLICIT'
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
}

// Field metadata for prompt construction and display
export const PROFILE_FIELD_METADATA: Record<string, { title: string; description: string; category: string }> = {
  agentIdentity: {
    title: 'Agent Identity',
    description: 'Who the agent represents - organization, team, role, mission',
    category: 'Identity & Context'
  },
  domainExpertise: {
    title: 'Domain Expertise',
    description: 'Areas of knowledge, expertise depth, credentials to claim',
    category: 'Identity & Context'
  },
  targetAudience: {
    title: 'Target Audience',
    description: 'Who the agent serves, their characteristics, what they care about',
    category: 'Identity & Context'
  },
  toneAndVoice: {
    title: 'Tone & Voice',
    description: 'Personality, formality level, character traits',
    category: 'Communication & Style'
  },
  languagePatterns: {
    title: 'Language Patterns',
    description: 'Specific phrases, terminology, level of detail, formatting preferences',
    category: 'Communication & Style'
  },
  adaptationRules: {
    title: 'Adaptation Rules',
    description: 'How to adjust for different contexts, question types, or audience signals',
    category: 'Communication & Style'
  },
  keyTopics: {
    title: 'Key Topics',
    description: 'Primary topics to emphasize, tiered by importance',
    category: 'Content & Priorities'
  },
  avoidanceAreas: {
    title: 'Avoidance Areas',
    description: 'Topics to avoid, handle carefully, or redirect',
    category: 'Content & Priorities'
  },
  examplePreferences: {
    title: 'Example Preferences',
    description: 'Use of examples, analogies, data citations, document references',
    category: 'Content & Priorities'
  },
  proactiveGuidance: {
    title: 'Proactive Guidance',
    description: 'Questions to ask, conversation steering, follow-up prompts',
    category: 'Engagement & Behavior'
  },
  framingStrategies: {
    title: 'Framing Strategies',
    description: 'How to position key messages, reframes for common objections',
    category: 'Engagement & Behavior'
  },
  successCriteria: {
    title: 'Success Criteria',
    description: 'What constitutes a good interaction, goals for each conversation',
    category: 'Engagement & Behavior'
  }
}

export const PROFILE_FIELD_IDS = Object.keys(PROFILE_FIELD_METADATA) as Array<keyof AgentProfileV2['fields']>
```

### Service Implementation

**File:** `backend/src/services/profileSynthesizer.ts` (add function)

```typescript
import { getOpenAI } from '../utils/openai'
import { LLMError } from '../utils/errors'

// Shared constants - consider moving to backend/src/constants/profile.ts
export const LLM_TIMEOUT_MS = 60000 // 60 seconds
export const MIN_INPUT_LENGTH = 50

/**
 * System prompt for extracting 12-field profile from braindump
 * Uses qualitative confidence signals, not numeric scores
 */
const BRAINDUMP_SYSTEM_PROMPT = `You are an expert at analyzing natural language descriptions and extracting structured AI agent profiles.

Your task: Extract a 12-field agent profile from the user's brain dump with confidence tracking.

## Output Format (JSON)
{
  "fields": {
    "agentIdentity": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "domainExpertise": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "targetAudience": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "toneAndVoice": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "languagePatterns": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "adaptationRules": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "keyTopics": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "avoidanceAreas": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "examplePreferences": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "proactiveGuidance": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "framingStrategies": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "successCriteria": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" }
  }
}

## Field Descriptions
- agentIdentity: Who the agent represents (organization, team, role, mission)
- domainExpertise: Areas of knowledge, expertise depth, credentials to claim
- targetAudience: Who it serves, their characteristics, what they care about
- toneAndVoice: Personality, formality level, character traits
- languagePatterns: Specific phrases, terminology, level of detail, formatting
- adaptationRules: How to adjust for different contexts or question types
- keyTopics: Primary topics to emphasize, tiered by importance if structured
- avoidanceAreas: Topics to avoid, handle carefully, or redirect
- examplePreferences: Use of examples, analogies, data citations
- proactiveGuidance: Questions to ask, conversation steering
- framingStrategies: How to position key messages, reframes
- successCriteria: What constitutes a good interaction

## Confidence Levels
- EXPLICIT: User directly stated this information
- INFERRED: Reasonable inference from context (user implied but didn't state directly)
- ASSUMED: Default/guess based on common patterns (user didn't provide relevant info)

## Guidelines
- Extract specific details mentioned by the user
- Preserve user terminology and examples exactly
- For structured input (tiers, lists), maintain the structure
- Make reasonable inferences and mark them as INFERRED
- Use sensible defaults and mark them as ASSUMED
- Never leave a field empty - always provide meaningful content
- Content should be actionable instructions for an AI agent`

/**
 * Build user prompt with raw input and optional additional context
 */
function buildBrainDumpPrompt(rawInput: string, additionalContext?: string): string {
  let prompt = `Please synthesize an AI agent profile from this brain dump:\n\n${rawInput}`

  if (additionalContext) {
    prompt += `\n\n## Additional Context (user refinements):\n${additionalContext}`
  }

  return prompt
}

/**
 * Calculate overall confidence from individual field confidences
 * Exported for testing
 */
export function calculateOverallConfidence(
  fields: Record<string, { confidence: ConfidenceLevel }>
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const confidences = Object.values(fields).map(f => f.confidence)
  const explicitCount = confidences.filter(c => c === 'EXPLICIT').length
  const assumedCount = confidences.filter(c => c === 'ASSUMED').length

  // HIGH: 8+ explicit, 0-1 assumed
  // MEDIUM: 4-7 explicit, or 2-4 assumed
  // LOW: <4 explicit, or 5+ assumed
  if (explicitCount >= 8 && assumedCount <= 1) return 'HIGH'
  if (assumedCount >= 5 || explicitCount < 4) return 'LOW'
  return 'MEDIUM'
}

/**
 * Extract light areas (fields with non-EXPLICIT confidence)
 * Exported for testing
 */
export function extractLightAreas(
  fields: Record<string, { confidence: ConfidenceLevel }>
): string[] {
  return Object.entries(fields)
    .filter(([_, field]) => field.confidence !== 'EXPLICIT')
    .map(([fieldId]) => fieldId)
}

/**
 * Validate and transform LLM response into typed structure
 */
function validateAndTransformResponse(
  parsed: unknown,
  rawInput: string
): BrainDumpSynthesisResult {
  // Type guard for parsed response
  if (!parsed || typeof parsed !== 'object' || !('fields' in parsed)) {
    throw new LLMError('Invalid response structure: missing fields object')
  }

  const response = parsed as { fields: Record<string, { content: string; confidence: string }> }
  const now = new Date().toISOString()

  // Validate all required fields exist
  const missingFields = PROFILE_FIELD_IDS.filter(id => !response.fields[id])
  if (missingFields.length > 0) {
    throw new LLMError(`Missing required fields: ${missingFields.join(', ')}`)
  }

  // Transform to typed structure
  const fields: AgentProfileV2['fields'] = {} as AgentProfileV2['fields']

  for (const fieldId of PROFILE_FIELD_IDS) {
    const rawField = response.fields[fieldId]
    const metadata = PROFILE_FIELD_METADATA[fieldId]

    // Validate confidence level
    const confidence = ['EXPLICIT', 'INFERRED', 'ASSUMED'].includes(rawField.confidence)
      ? rawField.confidence as ConfidenceLevel
      : 'ASSUMED' // Default to ASSUMED if invalid

    fields[fieldId] = {
      id: fieldId,
      title: metadata.title,
      content: rawField.content || `[No content extracted for ${metadata.title}]`,
      confidence,
      isEdited: false
    }
  }

  const lightAreas = extractLightAreas(response.fields)
  const overallConfidence = calculateOverallConfidence(response.fields)

  return {
    profile: {
      fields,
      generatedAt: now,
      source: 'braindump',
      version: 2
    },
    lightAreas,
    overallConfidence,
    rawInput
  }
}

/**
 * Synthesize a 12-field agent profile from natural language braindump
 *
 * @param rawInput - Natural language description from user (voice/text)
 * @param additionalContext - Optional refinement context for regeneration
 * @returns Structured profile with confidence signals
 */
export async function synthesizeFromBrainDump(
  rawInput: string,
  additionalContext?: string
): Promise<BrainDumpSynthesisResult> {
  const openai = getOpenAI()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const userPrompt = buildBrainDumpPrompt(rawInput, additionalContext)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: BRAINDUMP_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to synthesize profile: Empty response from AI')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new LLMError('Failed to parse AI response as JSON')
    }

    return validateAndTransformResponse(parsed, rawInput)

  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof LLMError) throw error

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new LLMError('Profile synthesis timed out after 60 seconds. Please try again.')
      }

      // OpenAI rate limiting
      if ('status' in error && (error as { status: number }).status === 429) {
        throw new LLMError('Rate limited by AI service. Please try again in a moment.')
      }
    }

    throw new LLMError(
      `Profile synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
```

### Controller Implementation

**File:** `backend/src/controllers/agent.controller.ts` (add handler)

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { ValidationError, NotFoundError } from '../utils/errors'
import { synthesizeFromBrainDump, BrainDumpSynthesisResult, MIN_INPUT_LENGTH } from '../services/profileSynthesizer'

const VALID_SYNTHESIS_MODES = ['voice', 'text']

/**
 * POST /api/projects/:projectId/profile/synthesize
 *
 * Synthesize a 12-field agent profile from natural language braindump.
 * Does NOT save to database - returns preview for user review.
 */
export async function synthesizeAgentProfileHandler(req: Request, res: Response) {
  const { projectId } = req.params
  const { rawInput, additionalContext, synthesisMode } = req.body
  const userId = req.user?.id

  // Validate request body
  if (!rawInput || typeof rawInput !== 'string') {
    throw new ValidationError('rawInput is required and must be a string')
  }

  if (rawInput.trim().length < MIN_INPUT_LENGTH) {
    throw new ValidationError(`rawInput must be at least ${MIN_INPUT_LENGTH} characters`)
  }

  if (additionalContext !== undefined && typeof additionalContext !== 'string') {
    throw new ValidationError('additionalContext must be a string if provided')
  }

  if (synthesisMode && !VALID_SYNTHESIS_MODES.includes(synthesisMode)) {
    throw new ValidationError(`synthesisMode must be one of: ${VALID_SYNTHESIS_MODES.join(', ')}`)
  }

  // Verify project exists and user has access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  // Synthesize profile (does not save)
  const result: BrainDumpSynthesisResult = await synthesizeFromBrainDump(
    rawInput.trim(),
    additionalContext?.trim()
  )

  return res.json({
    success: true,
    ...result,
    synthesisMode: synthesisMode || 'text'
  })
}

/**
 * POST /api/projects/:projectId/profile/save
 *
 * Save a synthesized profile to the database.
 * Called after user reviews and approves the preview.
 */
export async function saveAgentProfileHandler(req: Request, res: Response) {
  const { projectId } = req.params
  const { profile, rawInput, lightAreas, synthesisMode } = req.body
  const userId = req.user?.id

  // Validate required fields
  if (!profile || typeof profile !== 'object') {
    throw new ValidationError('profile is required')
  }

  if (!rawInput || typeof rawInput !== 'string') {
    throw new ValidationError('rawInput is required')
  }

  // Verify project exists and user has access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  // Get current config to increment version
  const existingConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })

  const nextVersion = (existingConfig?.profileVersion || 0) + 1

  // Upsert agent config with new profile
  const agentConfig = await prisma.agentConfig.upsert({
    where: { projectId },
    create: {
      projectId,
      interviewData: {}, // Empty for braindump-created profiles
      status: 'complete',
      completionLevel: 100,
      profile,
      profileGeneratedAt: new Date(),
      profileSource: 'braindump',
      profileVersion: 1,
      rawBrainDump: rawInput,
      synthesisMode: synthesisMode || 'text',
      lightAreas: lightAreas || []
    },
    update: {
      profile,
      profileGeneratedAt: new Date(),
      profileSource: 'braindump',
      profileVersion: nextVersion,
      rawBrainDump: rawInput,
      synthesisMode: synthesisMode || 'text',
      lightAreas: lightAreas || [],
      status: 'complete',
      completionLevel: 100
    }
  })

  return res.json({
    success: true,
    agentConfig: {
      id: agentConfig.id,
      profileVersion: agentConfig.profileVersion,
      profileSource: agentConfig.profileSource,
      profileGeneratedAt: agentConfig.profileGeneratedAt
    }
  })
}
```

### Route Registration

**File:** `backend/src/routes/agent.routes.ts` (add routes)

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  synthesizeAgentProfileHandler,
  saveAgentProfileHandler,
  // ... existing handlers
} from '../controllers/agent.controller'

const router = Router()

// Existing routes...

// NEW: Braindump synthesis routes
router.post(
  '/projects/:projectId/profile/synthesize',
  authenticate,
  asyncHandler(synthesizeAgentProfileHandler)
)

router.post(
  '/projects/:projectId/profile/save',
  authenticate,
  asyncHandler(saveAgentProfileHandler)
)

export default router
```

### API Specification

#### POST /api/projects/:projectId/profile/synthesize

Synthesize a 12-field agent profile from natural language input. Returns preview without saving.

**Request:**
```typescript
{
  rawInput: string      // Min 50 chars, natural language braindump
  additionalContext?: string  // Optional refinement context
  synthesisMode?: 'voice' | 'text'  // Input method for tracking
}
```

**Response (200):**
```typescript
{
  success: true
  profile: {
    fields: {
      agentIdentity: { id, title, content, confidence, isEdited }
      domainExpertise: { ... }
      targetAudience: { ... }
      toneAndVoice: { ... }
      languagePatterns: { ... }
      adaptationRules: { ... }
      keyTopics: { ... }
      avoidanceAreas: { ... }
      examplePreferences: { ... }
      proactiveGuidance: { ... }
      framingStrategies: { ... }
      successCriteria: { ... }
    }
    generatedAt: string  // ISO timestamp
    source: 'braindump'
    version: 2
  }
  lightAreas: string[]  // Field IDs with confidence !== 'EXPLICIT'
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
  synthesisMode: 'voice' | 'text'
}
```

**Error Responses:**
- `400` - Validation error (missing/invalid input)
- `401` - Not authenticated
- `404` - Project not found
- `500` - Synthesis failed (LLM error, timeout)

#### POST /api/projects/:projectId/profile/save

Save a previously synthesized profile to the database.

**Request:**
```typescript
{
  profile: AgentProfileV2  // From synthesis response
  rawInput: string         // Original braindump
  lightAreas: string[]     // From synthesis response
  synthesisMode?: 'voice' | 'text'
}
```

**Response (200):**
```typescript
{
  success: true
  agentConfig: {
    id: string
    profileVersion: number
    profileSource: 'braindump'
    profileGeneratedAt: string
  }
}
```

---

## User Experience

### Synthesis Flow (Backend Perspective)

```
1. Frontend collects braindump (voice/text)
   ↓
2. POST /synthesize with rawInput
   ↓
3. Backend calls GPT-4-turbo
   - 60 second timeout
   - JSON response mode
   - Extract 12 fields + confidence
   ↓
4. Return preview to frontend
   - lightAreas highlighted in UI
   - User can add refinement context
   ↓
5. (Optional) POST /synthesize again with additionalContext
   ↓
6. User approves → POST /save
   ↓
7. Profile stored in database
```

### Iterative Refinement

The `additionalContext` parameter enables refinement without starting over:

```
Initial synthesis:
  rawInput: "I work with investors, keep it professional..."
  → Profile with some INFERRED/ASSUMED fields

Refinement:
  rawInput: (same)
  additionalContext: "I forgot to mention we focus on SaaS metrics"
  → Updated profile with more EXPLICIT fields
```

---

## Testing Strategy

### Unit Tests

**File:** `backend/src/services/__tests__/profileSynthesizer.braindump.test.ts`

```typescript
import { synthesizeFromBrainDump, calculateOverallConfidence, extractLightAreas } from '../profileSynthesizer'

describe('synthesizeFromBrainDump', () => {
  // Purpose: Verify synthesis returns all 12 fields from natural language input
  it('should return profile with all 12 fields from natural language input', async () => {
    const rawInput = `
      I'm the AI assistant for Acme Corp's investor relations team.
      We work with board members and Series A investors who care about ROI.
      Keep things professional but approachable. Focus on revenue growth and churn metrics.
      Always cite specific data from documents when possible.
    `

    const result = await synthesizeFromBrainDump(rawInput)

    expect(result.profile.fields).toHaveProperty('agentIdentity')
    expect(result.profile.fields).toHaveProperty('domainExpertise')
    expect(result.profile.fields).toHaveProperty('targetAudience')
    // ... verify all 12 fields
    expect(Object.keys(result.profile.fields)).toHaveLength(12)
  })

  // Purpose: Verify each field has valid confidence level
  it('should include valid confidence level for each field', async () => {
    const rawInput = 'Professional assistant for tech startup, working with investors'

    const result = await synthesizeFromBrainDump(rawInput)

    const validConfidences = ['EXPLICIT', 'INFERRED', 'ASSUMED']
    for (const field of Object.values(result.profile.fields)) {
      expect(validConfidences).toContain(field.confidence)
    }
  })

  // Purpose: Verify lightAreas correctly identifies non-explicit fields
  it('should populate lightAreas with non-EXPLICIT field IDs', async () => {
    const rawInput = 'Help with investor questions' // Sparse input

    const result = await synthesizeFromBrainDump(rawInput)

    // With sparse input, most fields should be inferred/assumed
    expect(result.lightAreas.length).toBeGreaterThan(0)

    // Verify lightAreas match non-EXPLICIT fields
    for (const fieldId of result.lightAreas) {
      expect(result.profile.fields[fieldId].confidence).not.toBe('EXPLICIT')
    }
  })

  // Purpose: Verify additionalContext modifies synthesis output
  it('should incorporate additionalContext in refinement', async () => {
    const rawInput = 'AI assistant for company meetings'
    const additionalContext = 'We specifically focus on quarterly board meetings with financial data'

    const initial = await synthesizeFromBrainDump(rawInput)
    const refined = await synthesizeFromBrainDump(rawInput, additionalContext)

    // Refined should have different/more specific content
    expect(refined.profile.fields.targetAudience.content).not.toBe(
      initial.profile.fields.targetAudience.content
    )
  })

  // Purpose: Verify validation rejects empty/short input
  it('should throw validation error for input under 50 characters', async () => {
    await expect(synthesizeFromBrainDump('Too short'))
      .rejects.toThrow()
  })
})

describe('calculateOverallConfidence', () => {
  // Purpose: Verify HIGH confidence threshold
  it('should return HIGH when 8+ fields are EXPLICIT with 0-1 ASSUMED', () => {
    const fields = {
      field1: { confidence: 'EXPLICIT' },
      field2: { confidence: 'EXPLICIT' },
      field3: { confidence: 'EXPLICIT' },
      field4: { confidence: 'EXPLICIT' },
      field5: { confidence: 'EXPLICIT' },
      field6: { confidence: 'EXPLICIT' },
      field7: { confidence: 'EXPLICIT' },
      field8: { confidence: 'EXPLICIT' },
      field9: { confidence: 'INFERRED' },
      field10: { confidence: 'INFERRED' },
      field11: { confidence: 'INFERRED' },
      field12: { confidence: 'ASSUMED' }
    }

    expect(calculateOverallConfidence(fields)).toBe('HIGH')
  })

  // Purpose: Verify LOW confidence threshold
  it('should return LOW when 5+ fields are ASSUMED', () => {
    const fields = {
      field1: { confidence: 'EXPLICIT' },
      field2: { confidence: 'EXPLICIT' },
      field3: { confidence: 'EXPLICIT' },
      field4: { confidence: 'ASSUMED' },
      field5: { confidence: 'ASSUMED' },
      field6: { confidence: 'ASSUMED' },
      field7: { confidence: 'ASSUMED' },
      field8: { confidence: 'ASSUMED' },
      field9: { confidence: 'INFERRED' },
      field10: { confidence: 'INFERRED' },
      field11: { confidence: 'INFERRED' },
      field12: { confidence: 'INFERRED' }
    }

    expect(calculateOverallConfidence(fields)).toBe('LOW')
  })
})

describe('extractLightAreas', () => {
  // Purpose: Verify light areas extraction excludes EXPLICIT fields
  it('should return only non-EXPLICIT field IDs', () => {
    const fields = {
      agentIdentity: { confidence: 'EXPLICIT' },
      domainExpertise: { confidence: 'INFERRED' },
      targetAudience: { confidence: 'ASSUMED' }
    }

    const lightAreas = extractLightAreas(fields)

    expect(lightAreas).toContain('domainExpertise')
    expect(lightAreas).toContain('targetAudience')
    expect(lightAreas).not.toContain('agentIdentity')
  })
})
```

### Integration Tests

**File:** `backend/src/controllers/__tests__/agent.profile.synthesis.test.ts`

```typescript
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../utils/prisma'

describe('POST /api/projects/:projectId/profile/synthesize', () => {
  let authToken: string
  let projectId: string

  beforeEach(async () => {
    // Setup test user and project
    // ...
  })

  // Purpose: Verify authenticated users can synthesize profiles
  it('should return synthesized profile for authenticated user', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/profile/synthesize`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rawInput: 'I am an AI assistant for Acme Corp helping board members understand quarterly financials. Keep it professional.',
        synthesisMode: 'text'
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.profile.fields).toBeDefined()
    expect(response.body.lightAreas).toBeDefined()
    expect(response.body.overallConfidence).toMatch(/^(HIGH|MEDIUM|LOW)$/)
  })

  // Purpose: Verify unauthenticated requests are rejected
  it('should reject unauthenticated requests', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/profile/synthesize`)
      .send({ rawInput: 'Test input for synthesis' })

    expect(response.status).toBe(401)
  })

  // Purpose: Verify validation catches short input
  it('should return 400 for input under 50 characters', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/profile/synthesize`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rawInput: 'Too short' })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('50 characters')
  })

  // Purpose: Verify project ownership check
  it('should return 404 for project user does not own', async () => {
    const response = await request(app)
      .post('/api/projects/nonexistent-id/profile/synthesize')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rawInput: 'Valid input that is definitely over fifty characters long' })

    expect(response.status).toBe(404)
  })
})

describe('POST /api/projects/:projectId/profile/save', () => {
  // Purpose: Verify profile is persisted correctly
  it('should save profile and increment version', async () => {
    // First create a profile
    const synthesisResponse = await request(app)
      .post(`/api/projects/${projectId}/profile/synthesize`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rawInput: '...' })

    // Then save it
    const saveResponse = await request(app)
      .post(`/api/projects/${projectId}/profile/save`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        profile: synthesisResponse.body.profile,
        rawInput: synthesisResponse.body.rawInput,
        lightAreas: synthesisResponse.body.lightAreas,
        synthesisMode: 'text'
      })

    expect(saveResponse.status).toBe(200)
    expect(saveResponse.body.agentConfig.profileVersion).toBe(1)

    // Verify in database
    const config = await prisma.agentConfig.findUnique({
      where: { projectId }
    })
    expect(config?.profileSource).toBe('braindump')
    expect(config?.rawBrainDump).toBeDefined()
    expect(config?.lightAreas).toEqual(synthesisResponse.body.lightAreas)
  })
})
```

### E2E Tests (Deferred to Phase 2)

E2E tests will be added in Phase 2 when the frontend modal is implemented.

---

## Performance Considerations

### LLM Latency
- **Issue:** GPT-4-turbo synthesis takes 5-15 seconds
- **Mitigation:**
  - 60-second timeout prevents hung requests
  - Frontend shows progress indicator (Phase 2)
  - Response cached in rawBrainDump for regeneration without re-synthesis

### Token Usage
- **Issue:** 12-field extraction requires substantial output tokens
- **Mitigation:**
  - max_tokens: 4096 (sufficient for detailed fields)
  - JSON response mode reduces formatting tokens
  - Temperature 0.3 for consistent extraction

### Database Impact
- **Issue:** lightAreas array stored per config
- **Mitigation:**
  - Array is small (max 12 strings)
  - Indexed for efficient queries if needed later

---

## Security Considerations

### Input Validation
- Minimum 50 character input prevents abuse
- String type validation on all inputs
- No HTML/script injection risk (JSON storage)

### Authentication
- All endpoints require valid JWT token
- Project ownership verified before synthesis
- User can only save to their own projects

### LLM Safety
- System prompt constrains output format
- JSON response mode prevents arbitrary text injection
- No user input directly executed

### Rate Limiting (Recommended)
- Consider adding rate limiting to synthesis endpoint
- Suggested: 10 requests per minute per user
- Prevents LLM cost abuse

---

## Documentation

### Updates Required
- `CLAUDE.md`: Add "Braindump Agent Profile System" section documenting:
  - New 12-field profile structure
  - synthesisMode and lightAreas fields
  - API endpoints for synthesis
- API documentation: New endpoints
- Developer guide: Profile creation patterns

---

## Implementation Phases

### Phase 1: This Spec (Backend)
1. Database schema migration
2. Service function implementation
3. Controller and routes
4. Unit and integration tests

### Phase 2: Frontend Modal (Separate Spec)
- 5-step wizard modal
- Voice input integration
- Light areas highlighting
- Iterative refinement UX

### Phase 3: Profile Display (Separate Spec)
- AgentProfile.tsx updates for 12 fields
- Confidence badges on saved profiles
- Interview → 12-field mapping

---

## Decisions (Resolved)

1. **Rate limiting:** Should synthesis endpoint have explicit rate limiting beyond standard API limits?
   - **Decision:** Yes, 10 req/min/user (implement in Phase 2 with frontend)

2. **Profile migration:** Should existing 5-section profiles be auto-migrated to 12-field format?
   - **Decision:** No, keep backward compatible. Migration can be manual or triggered by user.

3. **Timeout handling:** Should failed synthesis attempts be logged for debugging?
   - **Decision:** Yes, log to application logs with anonymized input snippet.

4. **Frontend API client methods:** Should `frontend/src/lib/api.ts` be updated with methods for the new endpoints?
   - **Decision:** Deferred to Phase 2. Frontend API methods will be added when the braindump modal is implemented.

5. **LLM call abstraction:** Should the LLM call pattern be extracted into a shared utility (similar pattern exists in `profileBrainDumpSynthesizer.ts`)?
   - **Decision:** No. The patterns differ enough (prompts, validation, post-processing) that an abstraction would add complexity without significant benefit. Revisit if a third synthesis type is added.

---

## References

- Ideation document: `docs/ideation/braindump-to-agent-profile-system.md`
- Existing synthesis pattern: `backend/src/services/profileSynthesizer.ts`
- Braindump pattern: `backend/src/services/profileBrainDumpSynthesizer.ts`
- Previous AI-first spec: `specs/feat-ai-first-profile-creation.md`
- OpenAI JSON mode: https://platform.openai.com/docs/guides/structured-outputs
