# Viewer Preferences Integration

## Status
Draft

## Authors
Claude | December 19, 2025

## Overview

Integrate viewer preferences (specifically the "depth" preference) into the AI chat pipeline so that responses adapt to the user's selected verbosity level. Currently, viewer preferences are stored in localStorage and applied only to UI theming—they are never sent to the backend or used to influence AI response generation.

## Background/Problem Statement

### Current State
The viewer preferences system is partially implemented:
- **Implemented**: Frontend data model, localStorage persistence, CSS variable theming, preference selector components
- **Gap**: The `depth` preference (`concise` | `balanced` | `detailed`) has NO effect on AI responses

### Data Flow Gap
```
User selects "Concise" depth
    ↓
Stored in localStorage['viewer_preferences']
    ↓
Applied to UI theme/font (works!)
    ↓
User sends chat message
    ↓
POST /api/conversations/:id/messages/stream { message: "..." }
    ↓
Backend builds system prompt WITHOUT depth info
    ↓
AI responds at default verbosity (ignores user preference)
```

### Root Cause
The chat request payload contains only the message text. The `depth` preference is never:
1. Included in the request payload
2. Passed to `buildSystemPrompt()`
3. Incorporated into the AI system prompt

### User Impact
A viewer who selects "Concise" responses still receives lengthy, detailed answers. The preference selector creates false expectations—users believe their choice matters, but it doesn't influence the AI at all.

## Goals

- Pass viewer `depth` preference from frontend to backend in chat requests
- Modify system prompt construction to include depth-aware instructions
- AI responses should noticeably differ based on depth selection:
  - **Concise**: Direct answers, 2-3 sentences, essential info only
  - **Balanced**: Context with key details, moderate length
  - **Detailed**: Comprehensive explanations, examples, thorough coverage

## Non-Goals

- Server-side persistence of viewer preferences (Phase 2)
- Storing preferences in database tied to viewer accounts (Phase 2)
- Custom instructions beyond the depth selector (future feature)
- Font/theme preferences affecting AI (these are purely visual)
- Progressive disclosure "Expand on that" button (separate feature)

## Technical Dependencies

- **Existing Libraries**: No new dependencies required
- **Key Files**:
  - `frontend/src/components/viewer-prefs/viewerPrefsConfig.ts` - Depth type definitions
  - `frontend/src/components/viewer-prefs/useViewerPreferences.ts` - Preference hook
  - `frontend/src/components/ChatInterface.tsx` - Chat message sending
  - `backend/src/controllers/chat.controller.ts` - Chat endpoints
  - `backend/src/services/chatService.ts` - `generateChatCompletion()`, `buildSystemPrompt()`
  - `backend/src/services/contextService.ts` - System prompt construction

## Detailed Design

### 1. Update Chat Request Payload (Frontend)

**File**: `frontend/src/components/ChatInterface.tsx`

```typescript
// Current (line ~171):
body: JSON.stringify({ message: content })

// Updated:
body: JSON.stringify({
  message: content,
  preferences: {
    depth: preferences.depth  // 'concise' | 'balanced' | 'detailed'
  }
})
```

**How to access preferences**: ChatInterface needs access to `useViewerPreferences()` hook. Since SharePage already wraps content in `ViewerPreferencesProvider`, ChatInterface can use the hook directly.

```typescript
// ChatInterface.tsx - Add import and hook
import { useViewerPreferences } from './viewer-prefs/useViewerPreferences'

export function ChatInterface({ ... }) {
  const { preferences } = useViewerPreferences()

  // ... in handleSendMessage:
  body: JSON.stringify({
    message: content,
    preferences: {
      depth: preferences.depth
    }
  })
}
```

### 2. Update Backend Controller to Accept Preferences

**File**: `backend/src/controllers/chat.controller.ts`

```typescript
// In sendMessageStream handler (line ~78):
export const sendMessageStream = async (req: Request, res: Response) => {
  const { conversationId } = req.params
  const { message, preferences } = req.body  // Add preferences extraction

  // Validate preferences (optional, defaults to 'balanced')
  const viewerDepth = preferences?.depth || 'balanced'

  // Pass to service
  await chatService.generateChatCompletion(
    conversation.projectId,
    conversationId,
    message,
    { depth: viewerDepth }  // New options parameter
  )
}
```

### 3. Update Chat Service to Pass Preferences

**File**: `backend/src/services/chatService.ts`

```typescript
// Update function signature (~line 75):
interface ChatOptions {
  depth?: 'concise' | 'balanced' | 'detailed'
}

export async function generateChatCompletion(
  projectId: string,
  conversationId: string,
  userMessage: string,
  options: ChatOptions = {}  // New parameter
): Promise<void> {
  const depth = options.depth || 'balanced'

  // Pass to buildSystemPrompt (~line 138):
  const systemPrompt = await buildSystemPrompt(projectId, { depth })
  // ...
}
```

### 4. Add Depth Instructions to System Prompt

**File**: `backend/src/services/contextService.ts`

Add a new section to the system prompt that instructs the AI on response depth:

```typescript
// In buildSystemPrompt function (~line 33):
export async function buildSystemPrompt(
  projectId: string,
  options: { depth?: 'concise' | 'balanced' | 'detailed' } = {}
): Promise<string> {
  const depth = options.depth || 'balanced'

  // Existing prompt building...

  // Add depth instructions section (insert before RESPONSE FORMATTING):
  const depthInstructions = getDepthInstructions(depth)

  return `
${existingPromptContent}

## RESPONSE DEPTH PREFERENCE

${depthInstructions}

## RESPONSE FORMATTING (IMPORTANT)
${existingFormattingSection}
`
}

// New helper function:
function getDepthInstructions(depth: 'concise' | 'balanced' | 'detailed'): string {
  const instructions = {
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

  return instructions[depth]
}
```

### 5. Type Definitions

**File**: `backend/src/services/chatService.ts` (extend existing interface)

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

**Note**: Do NOT create a new types file. The `ChatCompletionOptions` interface already exists in `chatService.ts` and should be extended.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ViewerPreferencesProvider                                       │
│  ├─ preferences.depth: 'concise' | 'balanced' | 'detailed'      │
│  └─ stored in localStorage                                       │
│           │                                                      │
│           ▼                                                      │
│  ChatInterface                                                   │
│  ├─ useViewerPreferences() → { preferences }                    │
│  └─ handleSendMessage()                                         │
│           │                                                      │
│           ▼                                                      │
│  POST /api/conversations/:id/messages/stream                     │
│  { message: "...", preferences: { depth: "concise" } }          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  chat.controller.ts                                              │
│  ├─ Extract: { message, preferences } from req.body             │
│  └─ Pass depth to chatService                                   │
│           │                                                      │
│           ▼                                                      │
│  chatService.ts                                                  │
│  ├─ generateChatCompletion(projectId, convId, msg, { depth })   │
│  └─ Pass depth to buildSystemPrompt()                           │
│           │                                                      │
│           ▼                                                      │
│  contextService.ts                                               │
│  ├─ buildSystemPrompt(projectId, { depth })                     │
│  ├─ getDepthInstructions(depth) → instruction text              │
│  └─ Insert into system prompt before formatting section         │
│           │                                                      │
│           ▼                                                      │
│  System Prompt to OpenAI:                                        │
│  "...                                                            │
│   ## RESPONSE DEPTH PREFERENCE                                   │
│   The viewer prefers CONCISE responses.                          │
│   - Keep answers to 2-4 sentences...                            │
│   ..."                                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## User Experience

### Before (Current)
1. Viewer opens share page
2. Completes preferences onboarding, selects "Concise"
3. Asks: "What is this document about?"
4. Receives: Long, detailed 3-paragraph response
5. Frustration: "I said I wanted concise answers!"

### After (With Integration)
1. Viewer opens share page
2. Completes preferences onboarding, selects "Concise"
3. Asks: "What is this document about?"
4. Receives: "This document outlines TradeBlock's IP decision framework for determining revenue allocation between consulting engagements. It covers threshold questions, decision tiers, and implementation guidelines."
5. Satisfaction: Response matches preference

### Depth Comparison Example

**Question**: "What are the decision tiers in this document?"

**Concise Response**:
> There are 3 tiers: Tier 1 (TradeBlock Revenue) at 70-100%, Tier 2 (Shared Revenue) at 40-70%, and Tier 3 (33 Strategies Revenue) at 0-40%. Each tier depends on answers to threshold questions about business connection and involvement.

**Balanced Response**:
> The document defines 3 decision tiers for revenue allocation:
>
> - **Tier 1 (TradeBlock Revenue)**: 70-100% allocation when TradeBlock directly introduced the client AND actively facilitates the engagement
> - **Tier 2 (Shared Revenue)**: 40-70% when there's partial involvement
> - **Tier 3 (33 Strategies Revenue)**: 0-40% when the opportunity would exist without TradeBlock
>
> Tier selection is based on answers to threshold questions Q2A, Q2B, and Q2C.

**Detailed Response**:
> The IP Decision Framework establishes 3 tiers for allocating consulting revenue between TradeBlock and 33 Strategies:
>
> **Tier 1 - TradeBlock Revenue (70-100%)**
> This tier applies when TradeBlock receives the lion's share of revenue. The trigger conditions are: YES to Q2A (direct business connection) AND either YES to Q2B (active involvement) OR NO to Q2C (opportunity wouldn't exist without TradeBlock).
> - Revenue Allocation: 70-100% of Net Consulting Revenue
> - IP Ownership: 33 Strategies retains tool IP
> - Stability: Allocation locked for 12 months from initial engagement
>
> **Tier 2 - Shared Revenue (40-70%)**
> [continues with full details for each tier, examples, edge cases...]

## Testing Strategy

### Unit Tests

**File**: `backend/src/services/__tests__/contextService.test.ts`

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
})
```

**File**: `backend/src/controllers/__tests__/chat.controller.test.ts`

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
      { depth: 'concise' }
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
      { depth: 'balanced' }
    )
  })
})
```

### Integration Tests

**File**: `backend/src/controllers/__tests__/chat.integration.test.ts`

```typescript
describe('Chat with viewer preferences', () => {
  // Purpose: Verify end-to-end flow from HTTP request to system prompt inclusion
  it('includes depth preference in system prompt sent to OpenAI', async () => {
    const openAISpy = jest.spyOn(openai.chat.completions, 'create')

    await request(app)
      .post(`/api/conversations/${testConversationId}/messages/stream`)
      .send({
        message: 'What is this about?',
        preferences: { depth: 'concise' }
      })

    expect(openAISpy).toHaveBeenCalled()
    const callArgs = openAISpy.mock.calls[0][0]
    const systemMessage = callArgs.messages.find(m => m.role === 'system')
    expect(systemMessage.content).toContain('CONCISE')
    expect(systemMessage.content).toContain('2-4 sentences')
  })
})
```

### E2E Tests (Playwright)

**File**: `frontend/e2e/viewer-preferences-chat.spec.ts`

```typescript
test.describe('Viewer preferences affect chat responses', () => {
  // Purpose: Verify that depth preference is sent to backend when chatting
  test('sends depth preference with chat message', async ({ page }) => {
    // Navigate to share page
    await page.goto('/s/test-share-slug')

    // Complete onboarding with "Concise" selection
    await page.click('[data-testid="depth-concise"]')
    await page.click('[data-testid="continue-button"]')
    // ... complete remaining onboarding steps

    // Intercept chat API call
    const chatRequest = page.waitForRequest(request =>
      request.url().includes('/messages/stream') &&
      request.method() === 'POST'
    )

    // Send a chat message
    await page.fill('[data-testid="chat-input"]', 'What is this document about?')
    await page.click('[data-testid="send-button"]')

    // Verify preferences were included
    const request = await chatRequest
    const body = JSON.parse(request.postData() || '{}')
    expect(body.preferences).toEqual({ depth: 'concise' })
  })
})
```

## Performance Considerations

**Impact**: Minimal
- Adding ~100 characters to the system prompt (depth instructions)
- No additional API calls
- No database changes
- Preference already loaded in frontend state

**No Mitigation Needed**: The change adds negligible overhead.

## Security Considerations

**Input Validation**: The `depth` parameter should be validated server-side:

```typescript
const validDepths = ['concise', 'balanced', 'detailed']
const depth = validDepths.includes(preferences?.depth)
  ? preferences.depth
  : 'balanced'
```

**Risk Level**: Low
- Depth is an enum, not free-form text
- Invalid values default to 'balanced'
- No injection risk since value is used for string selection, not interpolation

## Documentation

### Updates Required

1. **CLAUDE.md**: Add section documenting viewer preferences integration pattern
2. **API Documentation**: Update chat endpoint to document `preferences` parameter

### CLAUDE.md Addition

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

## Implementation Phases

### Phase 1: Core Integration (This Spec)
1. Update `ChatInterface.tsx` to send `preferences.depth` with messages
2. Update `chat.controller.ts` to extract and pass depth
3. Update `chatService.ts` - extend `ChatCompletionOptions` interface and use depth in `generateChatCompletion()`
4. Update `contextService.ts` with `getDepthInstructions()` helper and modify `buildSystemPrompt()` signature
5. Add depth section to system prompt
6. Add unit tests for new functions
7. Manual verification with all 3 depth levels

**Implementation Note**: `generateChatCompletionWithSummary()` at ~line 274 in `chatService.ts` also calls `buildSystemPrompt()`. For Phase 1, this is used by Testing Dojo where depth preferences don't apply (creator testing). No changes needed there.

### Phase 2: Server-Side Persistence (Future Spec)
- Store viewer preferences in database
- Associate with viewer email/account
- Remember preferences across sessions
- Sync preferences from localStorage to server

### Phase 3: Advanced Preferences (Future Spec)
- Custom instructions field
- Progressive disclosure "Expand on that" button
- Per-conversation depth override
- Preference analytics for creators

## Open Questions

1. **Should depth be stored per-conversation?**
   - Current: Use current preference for all messages
   - Alternative: Store depth at conversation creation, maintain consistency
   - Recommendation: Defer to Phase 2, use current preference for now

2. **Should we add a UI indicator showing active depth?**
   - Small badge in chat header showing "Concise mode" etc.
   - Recommendation: Nice-to-have, not in scope for this spec

3. **How to handle mid-conversation depth changes?**
   - Current: New preference applies to new messages only
   - Recommendation: This is fine, no special handling needed

## References

- **Viewer Preferences Config**: `frontend/src/components/viewer-prefs/viewerPrefsConfig.ts`
- **Chat Service**: `backend/src/services/chatService.ts`
- **Context Service**: `backend/src/services/contextService.ts`
- **Chat Controller**: `backend/src/controllers/chat.controller.ts`
- **System Prompt Structure**: See `contextService.ts:33-132` for current format
