# Task Breakdown: Sequential Profile Generation with Progress UI
Generated: 2025-11-28
Source: specs/feat-sequential-profile-generation.md

## Overview

Replace batched profile generation with sequential single-section generation, providing real-time progress feedback via SSE streaming.

## Phase 1: Backend - Single Section Generator

### Task 1.1: Add generateSingleSection() function
**Description**: Create function to generate one profile section at a time
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2 (after interface defined)

**Technical Requirements**:
- Refactor existing batch generation logic to single-section focus
- Use existing `determineInputType()` for structured detection
- Return just the content string, not full profile object
- Use same LLM parameters (gpt-4-turbo, temperature 0.3, max_tokens 4096)

**Implementation**:
```typescript
// backend/src/services/profileSynthesizer.ts

const SECTION_ORDER = ['identityRole', 'communicationStyle', 'contentPriorities', 'engagementApproach', 'keyFramings'] as const
type SectionId = typeof SECTION_ORDER[number]

const SECTION_NAMES: Record<SectionId, string> = {
  identityRole: 'Identity & Role',
  communicationStyle: 'Communication Style',
  contentPriorities: 'Content Priorities',
  engagementApproach: 'Engagement Approach',
  keyFramings: 'Key Framings',
}

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  identityRole: 'Identity & Role - who the agent represents and serves',
  communicationStyle: 'Communication Style - how the agent communicates',
  contentPriorities: 'Content Priorities - what topics/areas to emphasize (PRESERVE ALL TIERS AND STRUCTURE)',
  engagementApproach: 'Engagement Approach - how to guide conversations and what questions to ask',
  keyFramings: 'Key Framings - how to frame/position key messages and reframes',
}

export async function generateSingleSection(
  interviewData: InterviewData,
  sectionId: SectionId,
  isStructured: boolean
): Promise<string> {
  const openai = getOpenAI()

  const structuredInstruction = isStructured
    ? `CRITICAL: The user provided well-structured input with tiers, lists, and frameworks.
       You MUST preserve this structure exactly. Do NOT compress into generic sentences.
       If they provided tiers, keep the tiers. If they provided bullet points, keep them.
       Completeness > brevity. Output can be LONG.`
    : `Synthesize the key points while preserving specific terminology, examples, and metrics.`

  const prompt = `Generate the "${SECTION_NAMES[sectionId]}" section for an AI agent profile.

${structuredInstruction}

INTERVIEW DATA:
- Audience: ${interviewData.audience || 'Not specified'}
- Purpose: ${interviewData.purpose || 'Not specified'}
- Tone: ${interviewData.tone || 'Not specified'}
- Emphasis: ${interviewData.emphasis || 'Not specified'}
- Questions: ${interviewData.questions || 'Not specified'}

SECTION TO GENERATE:
${SECTION_DESCRIPTIONS[sectionId]}

Generate ONLY this section as JSON:
{
  "${sectionId}": "Your detailed content here..."
}

Return valid JSON only.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You generate JSON profile sections. Preserve user terminology exactly. Do not paraphrase specifics.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError(`Failed to generate ${sectionId}: Empty response`)
    }

    const parsed = JSON.parse(content)
    return validateSection(parsed[sectionId])
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError(`Generation of ${sectionId} timed out. Please try again.`)
    }
    throw error
  }
}

// Export constants for use by controller
export { SECTION_ORDER, SECTION_NAMES }
export type { SectionId }
```

**Acceptance Criteria**:
- [ ] Function generates single section content
- [ ] Uses same structured/unstructured detection as batch version
- [ ] Handles timeouts gracefully with section-specific error messages
- [ ] Returns validated content string
- [ ] Exports SECTION_ORDER and SECTION_NAMES for controller use

---

## Phase 2: Backend - SSE Streaming Endpoint

### Task 1.2: Add SSE streaming controller
**Description**: Create streaming endpoint that generates sections sequentially with progress events
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- SSE response headers for streaming
- Progress event types for status, section_start, section_complete, complete, error
- Sequential generation with events between each section
- Save complete profile to database only after all sections succeed
- Proper error handling that sends error event and closes stream

**Implementation**:
```typescript
// backend/src/controllers/agent.controller.ts

// Add type definition at top of file
type ProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'section_start'; sectionId: string; sectionName: string }
  | { type: 'section_complete'; sectionId: string; content: string }
  | { type: 'complete'; profile: AgentProfile }
  | { type: 'error'; message: string }

/**
 * Generate AI agent profile with streaming progress
 * POST /api/projects/:projectId/agent/profile/generate-stream
 */
export async function generateAgentProfileStream(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Unauthorized' } })
    return
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    res.status(404).json({ error: { message: 'Project not found' } })
    return
  }

  if (project.ownerId !== req.user.userId) {
    res.status(403).json({ error: { message: 'You do not own this project' } })
    return
  }

  // Get agent config with interview data
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    res.status(404).json({ error: { message: 'Agent configuration not found' } })
    return
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  res.flushHeaders()

  const sendEvent = (data: ProgressEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const interviewData = agentConfig.interviewData as InterviewData
    const inputType = determineInputType(interviewData)
    const isStructured = inputType === 'structured'

    // Initial status messages
    sendEvent({ type: 'status', message: 'Reviewing interview responses...' })
    await new Promise(resolve => setTimeout(resolve, 500))

    sendEvent({ type: 'status', message: 'Analyzing content structure...' })
    await new Promise(resolve => setTimeout(resolve, 500))

    // Generate sections sequentially
    const sections: Record<string, string> = {}

    for (const sectionId of SECTION_ORDER) {
      sendEvent({
        type: 'section_start',
        sectionId,
        sectionName: SECTION_NAMES[sectionId]
      })

      const content = await generateSingleSection(interviewData, sectionId, isStructured)
      sections[sectionId] = content

      sendEvent({
        type: 'section_complete',
        sectionId,
        content
      })
    }

    // Build complete profile
    const now = new Date().toISOString()
    const profile: AgentProfile = {
      sections: {
        identityRole: {
          id: 'identityRole',
          title: 'Identity & Role',
          content: sections.identityRole,
          isEdited: false,
        },
        communicationStyle: {
          id: 'communicationStyle',
          title: 'Communication Style',
          content: sections.communicationStyle,
          isEdited: false,
        },
        contentPriorities: {
          id: 'contentPriorities',
          title: 'Content Priorities',
          content: sections.contentPriorities,
          isEdited: false,
        },
        engagementApproach: {
          id: 'engagementApproach',
          title: 'Engagement Approach',
          content: sections.engagementApproach,
          isEdited: false,
        },
        keyFramings: {
          id: 'keyFramings',
          title: 'Key Framings',
          content: sections.keyFramings,
          isEdited: false,
        },
      },
      generatedAt: now,
      source: 'interview',
    }

    // Save to database
    await prisma.agentConfig.update({
      where: { projectId },
      data: {
        profile: JSON.parse(JSON.stringify(profile)),
        profileGeneratedAt: new Date(),
        profileSource: 'interview',
      },
    })

    // Send complete event
    sendEvent({ type: 'complete', profile })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed'
    sendEvent({ type: 'error', message })
  } finally {
    res.end()
  }
}
```

**Acceptance Criteria**:
- [ ] SSE headers set correctly (Content-Type, Cache-Control, Connection)
- [ ] Status events sent before generation starts
- [ ] section_start event sent before each section generation
- [ ] section_complete event sent after each section completes
- [ ] Profile saved to database after all sections complete
- [ ] complete event sent with full profile
- [ ] error event sent on any failure, stream closes cleanly

---

### Task 1.3: Add streaming route
**Description**: Register the new SSE endpoint route
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**Implementation**:
```typescript
// backend/src/routes/agent.routes.ts

// Add import
import { generateAgentProfileStream } from '../controllers/agent.controller'

// Add route (before the PATCH route)
router.post(
  '/projects/:projectId/agent/profile/generate-stream',
  authenticate,
  asyncHandler(generateAgentProfileStream)
)
```

**Acceptance Criteria**:
- [ ] Route registered at correct path
- [ ] Authentication middleware applied
- [ ] Route accessible via POST request

---

## Phase 3: Frontend - SSE Client

### Task 2.1: Install fetch-event-source package
**Description**: Add @microsoft/fetch-event-source for POST SSE with auth headers
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1, 1.2, 1.3

**Implementation**:
```bash
cd frontend && npm install @microsoft/fetch-event-source
```

**Acceptance Criteria**:
- [ ] Package installed and in package.json
- [ ] No peer dependency warnings

---

### Task 2.2: Add generateAgentProfileStream() API method
**Description**: Create streaming API client method using fetch-event-source
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 1.2, 1.3

**Implementation**:
```typescript
// frontend/src/lib/api.ts

import { fetchEventSource } from '@microsoft/fetch-event-source'

// Add type definitions
export type ProfileProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'section_start'; sectionId: string; sectionName: string }
  | { type: 'section_complete'; sectionId: string; content: string }
  | { type: 'complete'; profile: AgentProfile }
  | { type: 'error'; message: string }

// Add method to ApiClient class
async generateAgentProfileStream(
  projectId: string,
  onProgress: (event: ProfileProgressEvent) => void
): Promise<AgentProfile> {
  return new Promise((resolve, reject) => {
    let finalProfile: AgentProfile | null = null
    let hasError = false

    fetchEventSource(
      `${this.baseUrl}/api/projects/${projectId}/agent/profile/generate-stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
        onmessage: (event) => {
          if (!event.data) return

          try {
            const data = JSON.parse(event.data) as ProfileProgressEvent
            onProgress(data)

            if (data.type === 'complete') {
              finalProfile = data.profile
            } else if (data.type === 'error') {
              hasError = true
              reject(new Error(data.message))
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e)
          }
        },
        onclose: () => {
          if (!hasError && finalProfile) {
            resolve(finalProfile)
          } else if (!hasError) {
            reject(new Error('Connection closed without completion'))
          }
        },
        onerror: (err) => {
          hasError = true
          reject(err instanceof Error ? err : new Error('SSE connection failed'))
        },
      }
    )
  })
}
```

**Acceptance Criteria**:
- [ ] Method uses fetchEventSource with POST
- [ ] Auth header included in request
- [ ] Calls onProgress for each event
- [ ] Resolves with profile on complete event
- [ ] Rejects with error on error event or connection failure

---

## Phase 4: Frontend - Progress UI

### Task 2.3: Update AgentProfile.tsx with progress UI
**Description**: Replace generic spinner with progress indicator showing each section
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: None

**Implementation**:
```tsx
// frontend/src/components/AgentProfile.tsx

// Add imports
import { ProfileProgressEvent } from '../lib/api'

// Update state declarations (near top of component)
const [generationStep, setGenerationStep] = useState<string>('')
const [currentSection, setCurrentSection] = useState<string | null>(null)
const [completedSections, setCompletedSections] = useState<string[]>([])

// Add section order constant
const sectionOrder = [
  { id: 'identityRole', name: 'Identity & Role' },
  { id: 'communicationStyle', name: 'Communication Style' },
  { id: 'contentPriorities', name: 'Content Priorities' },
  { id: 'engagementApproach', name: 'Engagement Approach' },
  { id: 'keyFramings', name: 'Key Framings' },
]

// Update generateProfile function
const generateProfile = async (force: boolean = false) => {
  try {
    setGenerating(true)
    setError('')
    setGenerationStep('Starting...')
    setCurrentSection(null)
    setCompletedSections([])

    const handleProgress = (event: ProfileProgressEvent) => {
      switch (event.type) {
        case 'status':
          setGenerationStep(event.message)
          break
        case 'section_start':
          setCurrentSection(event.sectionId)
          setGenerationStep(`Generating ${event.sectionName}...`)
          break
        case 'section_complete':
          setCompletedSections(prev => [...prev, event.sectionId])
          break
      }
    }

    const profile = await api.generateAgentProfileStream(projectId, handleProgress)
    setProfile(profile)
    showNotification('Profile generated successfully')
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to generate profile')
  } finally {
    setGenerating(false)
    setGenerationStep('')
    setCurrentSection(null)
    setCompletedSections([])
  }
}

// Replace the generating state UI (the if (generating) block)
if (generating) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <div className="text-gray-600 font-medium mb-6">{generationStep}</div>

        {/* Section progress list */}
        <div className="space-y-3 w-full max-w-xs">
          {sectionOrder.map((section) => {
            const isCompleted = completedSections.includes(section.id)
            const isCurrent = currentSection === section.id
            const isPending = !isCompleted && !isCurrent

            return (
              <div key={section.id} className="flex items-center gap-3">
                {isCompleted ? (
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                )}
                <span className={
                  isCompleted ? 'text-green-600 font-medium' :
                  isCurrent ? 'text-blue-600 font-medium' :
                  'text-gray-400'
                }>
                  {section.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Status messages displayed during initial phase
- [ ] Section list shows all 5 sections
- [ ] Completed sections show green checkmark
- [ ] Current section shows spinner
- [ ] Pending sections show gray circle
- [ ] State resets after generation completes or fails

---

## Phase 5: Testing

### Task 3.1: Add unit tests for generateSingleSection
**Description**: Test the single section generator function
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.3, Task 3.2

**Implementation**:
```typescript
// backend/src/services/__tests__/profileSynthesizer.test.ts

// Add to existing test file
describe('generateSingleSection', () => {
  it('should generate a single section successfully', async () => {
    mockOpenAIInstance.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              identityRole: 'Your agent represents your company to board members.',
            }),
          },
        },
      ],
    } as never)

    const result = await generateSingleSection(
      { audience: 'Board members', purpose: 'Quarterly reporting' },
      'identityRole',
      false
    )

    expect(result).toBe('Your agent represents your company to board members.')
    expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(1)
  })

  it('should throw error on empty response', async () => {
    mockOpenAIInstance.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: null } }],
    } as never)

    await expect(
      generateSingleSection({ audience: 'Test' }, 'identityRole', false)
    ).rejects.toThrow('Failed to generate identityRole: Empty response')
  })

  it('should use structured mode when isStructured is true', async () => {
    mockOpenAIInstance.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ contentPriorities: 'Detailed content...' }),
          },
        },
      ],
    } as never)

    await generateSingleSection({ emphasis: 'Tier 1: Critical items...' }, 'contentPriorities', true)

    const callArgs = mockOpenAIInstance.chat.completions.create.mock.calls[0][0]
    expect(callArgs.messages[1].content).toContain('CRITICAL: The user provided well-structured input')
  })
})
```

**Acceptance Criteria**:
- [ ] Test single section generation success
- [ ] Test empty response error handling
- [ ] Test structured mode prompt inclusion

---

### Task 3.2: Add integration test for SSE endpoint
**Description**: Test the streaming endpoint with mocked LLM
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 1.2, 1.3
**Can run parallel with**: Task 2.3, Task 3.1

**Implementation**:
```typescript
// backend/src/controllers/__tests__/agent.profile.test.ts

// Add to existing test file
describe('generateAgentProfileStream', () => {
  it('should stream progress events in correct order', async () => {
    // Mock the generateSingleSection to return quickly
    jest.spyOn(profileSynthesizer, 'generateSingleSection')
      .mockResolvedValue('Generated content')

    const response = await request(app)
      .post(`/api/projects/${testProject.id}/agent/profile/generate-stream`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Accept', 'text/event-stream')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')

    // Parse SSE events from response body
    const events = response.text
      .split('\n\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.replace('data: ', '')))

    // Verify event sequence
    expect(events[0]).toMatchObject({ type: 'status', message: 'Reviewing interview responses...' })
    expect(events[1]).toMatchObject({ type: 'status', message: 'Analyzing content structure...' })
    expect(events[2]).toMatchObject({ type: 'section_start', sectionId: 'identityRole' })
    // ... more sections
    expect(events[events.length - 1]).toMatchObject({ type: 'complete' })
  })

  it('should send error event on LLM failure', async () => {
    jest.spyOn(profileSynthesizer, 'generateSingleSection')
      .mockRejectedValue(new Error('LLM timeout'))

    const response = await request(app)
      .post(`/api/projects/${testProject.id}/agent/profile/generate-stream`)
      .set('Authorization', `Bearer ${authToken}`)

    const events = response.text
      .split('\n\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.replace('data: ', '')))

    const errorEvent = events.find(e => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent.message).toContain('LLM timeout')
  })
})
```

**Acceptance Criteria**:
- [ ] Test verifies SSE headers
- [ ] Test parses event stream correctly
- [ ] Test verifies event order
- [ ] Test verifies error event on failure

---

## Summary

| Phase | Tasks | Est. Size | Can Parallelize |
|-------|-------|-----------|-----------------|
| Phase 1: Backend | 1.1, 1.2, 1.3 | Large | 1.1 alone, then 1.2→1.3 |
| Phase 2: Frontend SSE | 2.1, 2.2 | Medium | 2.1 in parallel with Phase 1 |
| Phase 3: Frontend UI | 2.3 | Medium | After 2.2 |
| Phase 4: Testing | 3.1, 3.2 | Small | Both in parallel after deps |

**Total Tasks**: 7
**Critical Path**: 1.1 → 1.2 → 1.3 → 2.2 → 2.3

**Parallel Execution Opportunities**:
- Task 2.1 (npm install) can run immediately
- Tasks 3.1 and 3.2 can run in parallel once their deps are done
