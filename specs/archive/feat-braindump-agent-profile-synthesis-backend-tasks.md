# Task Breakdown: Braindump Agent Profile Synthesis Backend

**Generated:** 2025-12-13
**Source:** specs/feat-braindump-agent-profile-synthesis-backend.md
**Total Tasks:** 5
**Estimated Parallel Opportunities:** Tasks 1.1 can run alone; Tasks 2.1-2.3 can run in parallel after 1.1

---

## Overview

Implement backend synthesis system that extracts a structured 12-field AI agent profile from natural language "braindump" input, with per-field confidence signals and light area tracking.

---

## Phase 1: Foundation

### Task 1.1: Database Schema Migration
**Description:** Add new fields to AgentConfig model for braindump storage and light areas tracking
**Size:** Small
**Priority:** High (blocking)
**Dependencies:** None
**Can run parallel with:** None (must complete first)

**Technical Requirements:**
- Add `rawBrainDump` field (String? @db.Text) for storing original user input
- Add `synthesisMode` field (String?) for tracking input method: "voice" | "text" | "interview"
- Add `lightAreas` field (String[]) for storing field IDs with non-EXPLICIT confidence
- Maintain backward compatibility with existing fields

**Implementation:**

File: `backend/prisma/schema.prisma`

Add to AgentConfig model (after profileVersion field):
```prisma
  // NEW: Braindump storage
  rawBrainDump   String?  @db.Text  // Original user input for regeneration
  synthesisMode  String?            // "voice" | "text" | "interview"
  lightAreas     String[]           // Field IDs with confidence != EXPLICIT
```

**Commands to run:**
```bash
cd backend && npm run db:push
```

**Acceptance Criteria:**
- [ ] Schema migration runs successfully with `npm run db:push`
- [ ] New fields appear in database without affecting existing data
- [ ] Existing AgentConfig records remain intact
- [ ] lightAreas defaults to empty array for existing records

---

## Phase 2: Core Implementation

### Task 2.1: TypeScript Types and Constants
**Description:** Add type definitions for 12-field profile structure, confidence levels, and field metadata
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None initially, but 2.2 and 2.3 can follow immediately

**Technical Requirements:**
- Define ConfidenceLevel type: 'EXPLICIT' | 'INFERRED' | 'ASSUMED'
- Define ProfileField interface with id, title, content, confidence, isEdited, editedAt, editSource
- Define AgentProfileV2 interface with 12 fields organized by category
- Define BrainDumpSynthesisResult interface
- Define PROFILE_FIELD_METADATA constant with titles, descriptions, and categories
- Export MIN_INPUT_LENGTH and LLM_TIMEOUT_MS constants

**Implementation:**

File: `backend/src/services/profileSynthesizer.ts` (add at top of file)

```typescript
// Shared constants
export const LLM_TIMEOUT_MS = 60000 // 60 seconds
export const MIN_INPUT_LENGTH = 50

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
  version: 2
}

// Synthesis result returned to frontend
export interface BrainDumpSynthesisResult {
  profile: AgentProfileV2
  lightAreas: string[]
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

**Acceptance Criteria:**
- [ ] All types compile without TypeScript errors
- [ ] PROFILE_FIELD_METADATA contains all 12 fields
- [ ] Constants are exported and importable from other files

---

### Task 2.2: Synthesis Service Function
**Description:** Implement synthesizeFromBrainDump function with LLM call, validation, and confidence extraction
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.3 (after 2.1 completes)

**Technical Requirements:**
- Build system prompt with 12-field schema and confidence guidelines
- Call GPT-4-turbo with JSON response mode, temperature 0.3
- 60-second timeout with AbortController
- Parse and validate LLM response
- Extract confidence signals per field
- Build lightAreas array from non-EXPLICIT fields
- Calculate overall confidence (HIGH/MEDIUM/LOW)
- Handle errors: timeout, rate limiting, invalid JSON

**Implementation:**

File: `backend/src/services/profileSynthesizer.ts` (add functions)

```typescript
import { getOpenAI } from '../utils/openai'
import { LLMError } from '../utils/errors'

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

function buildBrainDumpPrompt(rawInput: string, additionalContext?: string): string {
  let prompt = `Please synthesize an AI agent profile from this brain dump:\n\n${rawInput}`
  if (additionalContext) {
    prompt += `\n\n## Additional Context (user refinements):\n${additionalContext}`
  }
  return prompt
}

export function calculateOverallConfidence(
  fields: Record<string, { confidence: ConfidenceLevel }>
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const confidences = Object.values(fields).map(f => f.confidence)
  const explicitCount = confidences.filter(c => c === 'EXPLICIT').length
  const assumedCount = confidences.filter(c => c === 'ASSUMED').length

  if (explicitCount >= 8 && assumedCount <= 1) return 'HIGH'
  if (assumedCount >= 5 || explicitCount < 4) return 'LOW'
  return 'MEDIUM'
}

export function extractLightAreas(
  fields: Record<string, { confidence: ConfidenceLevel }>
): string[] {
  return Object.entries(fields)
    .filter(([_, field]) => field.confidence !== 'EXPLICIT')
    .map(([fieldId]) => fieldId)
}

function validateAndTransformResponse(
  parsed: unknown,
  rawInput: string
): BrainDumpSynthesisResult {
  if (!parsed || typeof parsed !== 'object' || !('fields' in parsed)) {
    throw new LLMError('Invalid response structure: missing fields object')
  }

  const response = parsed as { fields: Record<string, { content: string; confidence: string }> }
  const now = new Date().toISOString()

  const missingFields = PROFILE_FIELD_IDS.filter(id => !response.fields[id])
  if (missingFields.length > 0) {
    throw new LLMError(`Missing required fields: ${missingFields.join(', ')}`)
  }

  const fields: AgentProfileV2['fields'] = {} as AgentProfileV2['fields']

  for (const fieldId of PROFILE_FIELD_IDS) {
    const rawField = response.fields[fieldId]
    const metadata = PROFILE_FIELD_METADATA[fieldId]

    const confidence = ['EXPLICIT', 'INFERRED', 'ASSUMED'].includes(rawField.confidence)
      ? rawField.confidence as ConfidenceLevel
      : 'ASSUMED'

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

**Acceptance Criteria:**
- [ ] synthesizeFromBrainDump returns profile with all 12 fields
- [ ] Each field includes valid confidence level (EXPLICIT/INFERRED/ASSUMED)
- [ ] lightAreas correctly identifies non-EXPLICIT fields
- [ ] 60-second timeout properly aborts request
- [ ] Rate limiting errors handled gracefully
- [ ] Invalid JSON from LLM throws descriptive error

---

### Task 2.3: Controller and Routes
**Description:** Add synthesizeAgentProfileHandler and saveAgentProfileHandler with route registration
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1, Task 2.2
**Can run parallel with:** Task 2.2 (after 2.1 completes)

**Technical Requirements:**
- synthesizeAgentProfileHandler: Validates input, calls service, returns preview (no save)
- saveAgentProfileHandler: Validates profile, upserts to database with version increment
- Manual validation (not Zod) following existing controller patterns
- Authentication middleware on both routes
- Project ownership verification

**Implementation:**

File: `backend/src/controllers/agent.controller.ts` (add handlers)

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { ValidationError, NotFoundError } from '../utils/errors'
import { synthesizeFromBrainDump, BrainDumpSynthesisResult, MIN_INPUT_LENGTH } from '../services/profileSynthesizer'

const VALID_SYNTHESIS_MODES = ['voice', 'text']

export async function synthesizeAgentProfileHandler(req: Request, res: Response) {
  const { projectId } = req.params
  const { rawInput, additionalContext, synthesisMode } = req.body
  const userId = req.user?.id

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

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

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

export async function saveAgentProfileHandler(req: Request, res: Response) {
  const { projectId } = req.params
  const { profile, rawInput, lightAreas, synthesisMode } = req.body
  const userId = req.user?.id

  if (!profile || typeof profile !== 'object') {
    throw new ValidationError('profile is required')
  }

  if (!rawInput || typeof rawInput !== 'string') {
    throw new ValidationError('rawInput is required')
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  const existingConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })

  const nextVersion = (existingConfig?.profileVersion || 0) + 1

  const agentConfig = await prisma.agentConfig.upsert({
    where: { projectId },
    create: {
      projectId,
      interviewData: {},
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

File: `backend/src/routes/agent.routes.ts` (add routes - find existing router, add these)

```typescript
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
```

**Acceptance Criteria:**
- [ ] POST /synthesize returns 200 with profile for valid input
- [ ] POST /synthesize returns 400 for input under 50 characters
- [ ] POST /synthesize returns 401 for unauthenticated requests
- [ ] POST /synthesize returns 404 for non-existent or unauthorized project
- [ ] POST /save persists profile to database
- [ ] POST /save increments profileVersion on updates

---

## Phase 3: Testing

### Task 3.1: Unit and Integration Tests
**Description:** Add tests for synthesis service and API endpoints
**Size:** Medium
**Priority:** High
**Dependencies:** Tasks 2.1, 2.2, 2.3
**Can run parallel with:** None (final task)

**Technical Requirements:**
- Unit tests for calculateOverallConfidence and extractLightAreas
- Integration tests for /synthesize and /save endpoints
- Test authentication, validation, and error handling
- Mock OpenAI calls where appropriate

**Implementation:**

File: `backend/src/services/__tests__/profileSynthesizer.braindump.test.ts`

```typescript
import { calculateOverallConfidence, extractLightAreas } from '../profileSynthesizer'

describe('calculateOverallConfidence', () => {
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

  it('should return MEDIUM for mixed confidence', () => {
    const fields = {
      field1: { confidence: 'EXPLICIT' },
      field2: { confidence: 'EXPLICIT' },
      field3: { confidence: 'EXPLICIT' },
      field4: { confidence: 'EXPLICIT' },
      field5: { confidence: 'EXPLICIT' },
      field6: { confidence: 'INFERRED' },
      field7: { confidence: 'INFERRED' },
      field8: { confidence: 'INFERRED' },
      field9: { confidence: 'INFERRED' },
      field10: { confidence: 'ASSUMED' },
      field11: { confidence: 'ASSUMED' },
      field12: { confidence: 'ASSUMED' }
    }

    expect(calculateOverallConfidence(fields)).toBe('MEDIUM')
  })
})

describe('extractLightAreas', () => {
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

  it('should return empty array when all fields are EXPLICIT', () => {
    const fields = {
      agentIdentity: { confidence: 'EXPLICIT' },
      domainExpertise: { confidence: 'EXPLICIT' }
    }

    const lightAreas = extractLightAreas(fields)

    expect(lightAreas).toEqual([])
  })
})
```

**Acceptance Criteria:**
- [ ] All unit tests pass
- [ ] calculateOverallConfidence tests cover HIGH, MEDIUM, LOW thresholds
- [ ] extractLightAreas correctly filters non-EXPLICIT fields
- [ ] Integration tests verify API authentication and validation

---

## Execution Strategy

### Recommended Order
1. **Task 1.1** (Schema) - Must complete first
2. **Task 2.1** (Types) - After schema, before service
3. **Task 2.2** (Service) - After types
4. **Task 2.3** (Controller/Routes) - After service
5. **Task 3.1** (Tests) - After all implementation

### Parallel Opportunities
- After Task 1.1 completes: Task 2.1 can start immediately
- After Task 2.1 completes: Tasks 2.2 and 2.3 can start in parallel (2.3 just needs types)

### Risk Assessment
- **LLM Response Variability:** Mitigated by validation and fallback confidence levels
- **Schema Migration:** Low risk, additive fields only
- **Backward Compatibility:** Maintained via optional fields and version tracking
