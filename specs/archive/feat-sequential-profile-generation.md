# Sequential Profile Generation with Progress UI

## Status
Draft

## Authors
Claude | 2025-11-28

## Overview

Replace the current batched profile generation (2 batches for 5 sections) with sequential single-section generation, providing real-time progress feedback to users. Each section is generated independently via streaming/SSE, with UI updates showing exactly what's happening.

## Problem Statement

The current implementation:
1. Generates profile sections in 2 parallel batches (3 + 2 sections)
2. Still risks hitting token limits with very detailed interview responses
3. Shows a generic spinner with no indication of progress
4. User has no visibility into what's happening during the 3-10 second generation time

Users need to see progress during generation to understand the system is working and what step it's on.

## Goals

- Generate each of the 5 profile sections independently (1 API call per section)
- Show real-time progress in the UI as each step completes
- Display progress messages: "Reviewing interview...", "Analyzing responses...", "Generating [Section Name]..."
- Eliminate token limit issues by constraining each call to a single section

## Non-Goals

- Streaming the actual text content character-by-character (just progress updates)
- Cancellation mid-generation
- Partial saves (either all sections complete or none)
- Retry logic for individual failed sections
- Caching individual sections separately

## Technical Approach

### Backend Changes

**New SSE endpoint**: `POST /api/projects/:projectId/agent/profile/generate-stream`

Uses Server-Sent Events to stream progress updates:

```typescript
// Progress event types
type ProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'section_start'; sectionId: string; sectionName: string }
  | { type: 'section_complete'; sectionId: string; content: string }
  | { type: 'complete'; profile: AgentProfile }
  | { type: 'error'; message: string }
```

**Generation sequence**:
1. Send `{ type: 'status', message: 'Reviewing interview responses...' }`
2. Send `{ type: 'status', message: 'Analyzing content structure...' }`
3. For each section in order:
   - Send `{ type: 'section_start', sectionId: 'identityRole', sectionName: 'Identity & Role' }`
   - Call LLM for single section (max_tokens: 4096)
   - Send `{ type: 'section_complete', sectionId: 'identityRole', content: '...' }`
4. Save complete profile to database
5. Send `{ type: 'complete', profile: {...} }`

**Files to modify**:
- `backend/src/services/profileSynthesizer.ts` - Add `generateSingleSection()` function
- `backend/src/controllers/agent.controller.ts` - Add `generateAgentProfileStream()` handler
- `backend/src/routes/agent.routes.ts` - Add new route

### Frontend Changes

**New state for progress tracking**:
```typescript
const [generationStep, setGenerationStep] = useState<string | null>(null)
const [completedSections, setCompletedSections] = useState<string[]>([])
```

**Replace simple spinner with progress UI**:
- Show current status message
- Show checkmarks for completed sections
- Show spinner next to section currently being generated

**Files to modify**:
- `frontend/src/lib/api.ts` - Add `generateAgentProfileStream()` method using EventSource
- `frontend/src/components/AgentProfile.tsx` - Update generating state UI

## Implementation Details

### Backend: Single Section Generator

```typescript
// profileSynthesizer.ts
export async function generateSingleSection(
  interviewData: InterviewData,
  sectionId: string,
  isStructured: boolean
): Promise<string> {
  const sectionDescriptions: Record<string, string> = {
    identityRole: 'Identity & Role - who the agent represents and serves',
    communicationStyle: 'Communication Style - how the agent communicates',
    contentPriorities: 'Content Priorities - what topics/areas to emphasize',
    engagementApproach: 'Engagement Approach - how to guide conversations',
    keyFramings: 'Key Framings - how to frame/position key messages',
  }

  // Generate single section with focused prompt
  // Returns just the content string for that section
}
```

### Backend: SSE Controller

```typescript
// agent.controller.ts
export async function generateAgentProfileStream(req: Request, res: Response) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendEvent = (data: ProgressEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    sendEvent({ type: 'status', message: 'Reviewing interview responses...' })
    // ... generate sections sequentially
  } catch (error) {
    sendEvent({ type: 'error', message: error.message })
  } finally {
    res.end()
  }
}
```

### Frontend: Progress UI

```tsx
// AgentProfile.tsx - generating state
if (generating) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <div className="text-gray-600 font-medium">{generationStep}</div>

        {/* Section progress list */}
        <div className="mt-6 space-y-2 text-sm">
          {sectionOrder.map((section) => (
            <div key={section.id} className="flex items-center gap-2">
              {completedSections.includes(section.id) ? (
                <CheckIcon className="h-4 w-4 text-green-500" />
              ) : currentSection === section.id ? (
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-gray-300" />
              )}
              <span className={completedSections.includes(section.id) ? 'text-green-600' : 'text-gray-500'}>
                {section.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Frontend: SSE API Call with fetch-event-source

```typescript
// api.ts
import { fetchEventSource } from '@microsoft/fetch-event-source'

generateAgentProfileStream(
  projectId: string,
  onProgress: (event: ProgressEvent) => void
): Promise<AgentProfile> {
  return new Promise((resolve, reject) => {
    let finalProfile: AgentProfile | null = null

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
          const data = JSON.parse(event.data)
          onProgress(data)

          if (data.type === 'complete') {
            finalProfile = data.profile
          } else if (data.type === 'error') {
            throw new Error(data.message)
          }
        },
        onclose: () => {
          if (finalProfile) {
            resolve(finalProfile)
          } else {
            reject(new Error('Connection closed without completion'))
          }
        },
        onerror: (err) => {
          reject(err)
        },
      }
    )
  })
}
```

## Testing Approach

### Key Scenarios to Test

1. **Happy path**: All 5 sections generate successfully in sequence
2. **Error mid-generation**: LLM fails on section 3 - should return error, not partial profile
3. **SSE connection**: Events are received in order on frontend
4. **UI updates**: Each status message and section completion updates the UI

### Test Files
- `backend/src/services/__tests__/profileSynthesizer.test.ts` - Add tests for `generateSingleSection()`
- `backend/src/controllers/__tests__/agent.profile.test.ts` - Add SSE endpoint test

## User Experience

### Progress Flow

1. User clicks "Complete" on interview OR "Regenerate profile"
2. UI shows: Spinner + "Reviewing interview responses..."
3. After ~500ms: "Analyzing content structure..."
4. For each section (3-8 seconds each):
   - Show section name with spinner: "Generating Identity & Role..."
   - On complete: Checkmark appears, move to next
5. All complete: Profile displays

### Progress Messages

| Step | Message |
|------|---------|
| Start | "Reviewing interview responses..." |
| Analysis | "Analyzing content structure..." |
| Section 1 | "Generating Identity & Role..." |
| Section 2 | "Generating Communication Style..." |
| Section 3 | "Generating Content Priorities..." |
| Section 4 | "Generating Engagement Approach..." |
| Section 5 | "Generating Key Framings..." |

## Dependencies

- **Frontend**: Add `@microsoft/fetch-event-source` package for POST SSE with auth headers

## Open Questions

None - auth handling resolved using `@microsoft/fetch-event-source`.

## Future Improvements

- **Cancellation support**: Allow user to cancel mid-generation
- **Partial saves**: Save each section as it completes, allow resuming
- **Retry failed sections**: If one section fails, retry just that section
- **Parallel with progress**: Generate in parallel but still show progress (harder to sequence UI)
- **Section-level regeneration**: Regenerate just one section without re-running whole profile
- **Estimated time remaining**: Show "~15 seconds remaining" based on sections left
- **Character-by-character streaming**: Stream actual content as it generates (more complex)

## References

- Current implementation: `backend/src/services/profileSynthesizer.ts`
- SSE in Express: Native `res.write()` with proper headers
- EventSource MDN: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
