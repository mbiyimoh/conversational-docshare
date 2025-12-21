# Task Breakdown: Viewer Preferences Integration

Generated: December 19, 2025
Source: specs/feat-viewer-preferences-integration.md

## Overview

Integrate the viewer `depth` preference into the AI chat pipeline so responses adapt to user-selected verbosity. This involves passing preferences from frontend to backend and injecting depth instructions into the system prompt.

---

## Phase 1: Backend Infrastructure

### Task 1.1: Extend ChatCompletionOptions Interface

**Description**: Add `depth` field to existing ChatCompletionOptions interface
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**File**: `backend/src/services/chatService.ts`

**Implementation**:
```typescript
// Update existing ChatCompletionOptions interface (~line 13):
export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  depth?: 'concise' | 'balanced' | 'detailed'  // ADD THIS
}
```

**Acceptance Criteria**:
- [ ] `depth` field added to `ChatCompletionOptions` interface
- [ ] TypeScript compiles without errors
- [ ] Existing code continues to work (depth is optional)

---

### Task 1.2: Add getDepthInstructions Helper Function

**Description**: Create helper function that returns depth-specific instructions for the system prompt
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**File**: `backend/src/services/contextService.ts`

**Implementation**:
```typescript
// Add this helper function (export for testing)
export function getDepthInstructions(depth: 'concise' | 'balanced' | 'detailed'): string {
  const instructions: Record<string, string> = {
    concise: `The viewer prefers CONCISE responses.
- Keep answers to 2-4 sentences when possible
- Lead with the direct answer, skip preamble
- Include only essential information
- Omit examples unless specifically requested
- Use bullet points for multiple items instead of paragraphs
- If asked to elaborate, you may provide more detail`,

    balanced: `The viewer prefers BALANCED responses.
- Provide context alongside the direct answer
- Include key supporting details
- Use examples when they clarify complex points
- Structure with brief paragraphs or organized lists
- Aim for moderate length (4-8 sentences typical)`,

    detailed: `The viewer prefers DETAILED responses.
- Provide comprehensive, thorough explanations
- Include relevant background and context
- Use examples, analogies, and supporting evidence
- Break down complex topics into clear sub-sections
- Don't sacrifice depth for brevity
- Anticipate and address follow-up questions proactively`
  }

  return instructions[depth] || instructions.balanced
}
```

**Acceptance Criteria**:
- [ ] Function returns correct instructions for 'concise'
- [ ] Function returns correct instructions for 'balanced'
- [ ] Function returns correct instructions for 'detailed'
- [ ] Function defaults to 'balanced' for invalid input
- [ ] Function is exported for testing

---

### Task 1.3: Modify buildSystemPrompt to Accept Depth Option

**Description**: Update buildSystemPrompt signature and inject depth instructions into prompt
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**File**: `backend/src/services/contextService.ts`

**Current signature** (~line 33):
```typescript
export async function buildSystemPrompt(projectId: string): Promise<string>
```

**Updated signature**:
```typescript
export async function buildSystemPrompt(
  projectId: string,
  options: { depth?: 'concise' | 'balanced' | 'detailed' } = {}
): Promise<string>
```

**Implementation changes**:
1. Add options parameter with depth
2. Get depth instructions: `const depthInstructions = getDepthInstructions(options.depth || 'balanced')`
3. Insert depth section BEFORE the RESPONSE FORMATTING section

**Prompt structure update**:
```typescript
// Find where RESPONSE FORMATTING section is added and insert depth before it:
// ... existing prompt content ...

## RESPONSE DEPTH PREFERENCE

${depthInstructions}

## RESPONSE FORMATTING (IMPORTANT)
// ... existing formatting section ...
```

**Acceptance Criteria**:
- [ ] Function accepts optional `options` parameter
- [ ] Depth defaults to 'balanced' when not provided
- [ ] Depth instructions appear in system prompt
- [ ] Depth section appears BEFORE RESPONSE FORMATTING section
- [ ] Existing calls without options still work (backward compatible)

---

## Phase 2: Service Layer Integration

### Task 2.1: Update generateChatCompletion to Pass Depth

**Description**: Pass depth from options to buildSystemPrompt call
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1, Task 1.3
**Can run parallel with**: None

**File**: `backend/src/services/chatService.ts`

**Current code** (~line 138):
```typescript
const systemPrompt = await buildSystemPrompt(projectId)
```

**Updated code**:
```typescript
const depth = options.depth || 'balanced'
const systemPrompt = await buildSystemPrompt(projectId, { depth })
```

**Acceptance Criteria**:
- [ ] Depth is extracted from options with 'balanced' default
- [ ] Depth is passed to buildSystemPrompt
- [ ] Existing functionality preserved when depth not provided

---

## Phase 3: Controller Layer

### Task 3.1: Extract Preferences from Request Body

**Description**: Update chat controller to extract and validate depth preference from request
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: None

**File**: `backend/src/controllers/chat.controller.ts`

**In sendMessageStream handler** (~line 78):

**Current code**:
```typescript
const { message } = req.body
```

**Updated code**:
```typescript
const { message, preferences } = req.body

// Validate depth preference (enum validation)
const validDepths = ['concise', 'balanced', 'detailed']
const viewerDepth = validDepths.includes(preferences?.depth)
  ? preferences.depth
  : 'balanced'
```

**Pass to service call**:
```typescript
// Find the generateChatCompletion call and add depth to options:
await chatService.generateChatCompletion(
  conversation.projectId,
  conversationId,
  message,
  { ...existingOptions, depth: viewerDepth }
)
```

**Acceptance Criteria**:
- [ ] `preferences` extracted from request body
- [ ] Invalid depth values default to 'balanced'
- [ ] Valid depth values are passed to service
- [ ] Existing requests without preferences continue to work

---

## Phase 4: Frontend Integration

### Task 4.1: Send Depth Preference with Chat Messages

**Description**: Update ChatInterface to include depth preference in chat requests
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: None

**File**: `frontend/src/components/ChatInterface.tsx`

**Step 1 - Add import**:
```typescript
import { useViewerPreferences } from './viewer-prefs/useViewerPreferences'
```

**Step 2 - Use hook in component**:
```typescript
export function ChatInterface({ ... }) {
  const { preferences } = useViewerPreferences()
  // ... rest of component
}
```

**Step 3 - Update request payload** (find handleSendMessage, ~line 171):

**Current code**:
```typescript
body: JSON.stringify({ message: content })
```

**Updated code**:
```typescript
body: JSON.stringify({
  message: content,
  preferences: {
    depth: preferences.depth
  }
})
```

**Note**: ChatInterface is rendered within SharePage which already wraps content in ViewerPreferencesProvider, so the hook will have access to preferences.

**Acceptance Criteria**:
- [ ] useViewerPreferences hook imported and used
- [ ] Request payload includes preferences.depth
- [ ] Depth value comes from user's stored preference
- [ ] Messages still send successfully
- [ ] No TypeScript errors

---

## Phase 5: Testing

### Task 5.1: Unit Tests for getDepthInstructions

**Description**: Add unit tests for the depth instructions helper
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.2
**Can run parallel with**: Task 5.2

**File**: `backend/src/services/__tests__/contextService.test.ts`

**Implementation**:
```typescript
describe('getDepthInstructions', () => {
  it('returns concise instructions for concise depth', () => {
    const result = getDepthInstructions('concise')
    expect(result).toContain('CONCISE')
    expect(result).toContain('2-4 sentences')
  })

  it('returns balanced instructions for balanced depth', () => {
    const result = getDepthInstructions('balanced')
    expect(result).toContain('BALANCED')
    expect(result).toContain('moderate length')
  })

  it('returns detailed instructions for detailed depth', () => {
    const result = getDepthInstructions('detailed')
    expect(result).toContain('DETAILED')
    expect(result).toContain('comprehensive')
  })

  it('defaults to balanced when depth is invalid', () => {
    const result = getDepthInstructions('invalid' as any)
    expect(result).toContain('BALANCED')
  })
})
```

**Acceptance Criteria**:
- [ ] All 4 test cases pass
- [ ] Tests verify actual content, not just non-empty strings

---

### Task 5.2: Unit Tests for buildSystemPrompt with Depth

**Description**: Add tests verifying depth is included in system prompt
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.3
**Can run parallel with**: Task 5.1

**File**: `backend/src/services/__tests__/contextService.test.ts`

**Implementation**:
```typescript
describe('buildSystemPrompt with depth', () => {
  it('includes depth instructions in prompt', async () => {
    const prompt = await buildSystemPrompt(mockProjectId, { depth: 'concise' })
    expect(prompt).toContain('RESPONSE DEPTH PREFERENCE')
    expect(prompt).toContain('CONCISE')
  })

  it('places depth section before formatting section', async () => {
    const prompt = await buildSystemPrompt(mockProjectId, { depth: 'detailed' })
    const depthIndex = prompt.indexOf('RESPONSE DEPTH PREFERENCE')
    const formattingIndex = prompt.indexOf('RESPONSE FORMATTING')
    expect(depthIndex).toBeLessThan(formattingIndex)
  })

  it('defaults to balanced when no depth provided', async () => {
    const prompt = await buildSystemPrompt(mockProjectId)
    expect(prompt).toContain('BALANCED')
  })
})
```

**Acceptance Criteria**:
- [ ] Tests verify depth section is included
- [ ] Tests verify section ordering
- [ ] Tests verify default behavior

---

### Task 5.3: Unit Tests for Chat Controller Depth Extraction

**Description**: Add tests for controller preference extraction
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: Task 5.1, Task 5.2

**File**: `backend/src/controllers/__tests__/chat.controller.test.ts`

**Implementation**:
```typescript
describe('sendMessageStream', () => {
  it('extracts depth preference from request body', async () => {
    const req = mockRequest({
      params: { conversationId: 'conv-123' },
      body: {
        message: 'Hello',
        preferences: { depth: 'concise' }
      }
    })

    await sendMessageStream(req, res)

    expect(chatService.generateChatCompletion).toHaveBeenCalledWith(
      expect.any(String),
      'conv-123',
      'Hello',
      expect.objectContaining({ depth: 'concise' })
    )
  })

  it('defaults to balanced when no preference provided', async () => {
    const req = mockRequest({
      params: { conversationId: 'conv-123' },
      body: { message: 'Hello' }
    })

    await sendMessageStream(req, res)

    expect(chatService.generateChatCompletion).toHaveBeenCalledWith(
      expect.any(String),
      'conv-123',
      'Hello',
      expect.objectContaining({ depth: 'balanced' })
    )
  })
})
```

**Acceptance Criteria**:
- [ ] Tests verify preference extraction
- [ ] Tests verify default behavior
- [ ] Tests mock service appropriately

---

## Phase 6: Documentation

### Task 6.1: Update CLAUDE.md with Integration Pattern

**Description**: Document the viewer preferences integration in CLAUDE.md
**Size**: Small
**Priority**: Low
**Dependencies**: All implementation tasks complete
**Can run parallel with**: None

**File**: `CLAUDE.md`

**Add section**:
```markdown
## Viewer Preferences Integration

**What:** Viewer preferences (depth) are sent with chat messages to customize AI response verbosity.

**Data Flow:**
- Frontend: `useViewerPreferences()` hook → preferences state
- Chat Request: `{ message, preferences: { depth } }`
- Backend: Extract depth → pass to `buildSystemPrompt()` → AI adapts

**Depth Levels:**
- `concise`: 2-4 sentences, direct answers
- `balanced`: Context with key details, moderate length
- `detailed`: Comprehensive explanations, examples

**Key Files:**
- `frontend/src/components/ChatInterface.tsx` - Sends preferences
- `backend/src/services/contextService.ts` - Adds depth instructions to prompt
```

**Acceptance Criteria**:
- [ ] Section added to CLAUDE.md
- [ ] Data flow documented
- [ ] Key files listed

---

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| 1: Backend Infrastructure | 1.1, 1.2, 1.3 | 1.1 and 1.2 can run parallel |
| 2: Service Layer | 2.1 | 1.1, 1.3 |
| 3: Controller Layer | 3.1 | 2.1 |
| 4: Frontend | 4.1 | 3.1 |
| 5: Testing | 5.1, 5.2, 5.3 | Respective implementation tasks |
| 6: Documentation | 6.1 | All implementation |

**Total Tasks**: 10
**Critical Path**: 1.1 → 1.3 → 2.1 → 3.1 → 4.1
**Parallel Opportunities**: Tasks 1.1 + 1.2, Tasks 5.1 + 5.2 + 5.3
