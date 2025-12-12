# Architecture: AI Brain Dump Synthesis

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    AI Synthesis Modal                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 1: INPUT                                                    │ │   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐│ │   │
│  │  │  │ [🎤]  Large textarea for voice/text input                   ││ │   │
│  │  │  │       useSpeechRecognition hook manages voice               ││ │   │
│  │  │  └─────────────────────────────────────────────────────────────┘│ │   │
│  │  │  [Generate Profile →]                                           │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                              ↓                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 2: PREVIEW                                                  │ │   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐│ │   │
│  │  │  │ Read-only display of synthesized fields                     ││ │   │
│  │  │  │ ProfileField components for each field                      ││ │   │
│  │  │  └─────────────────────────────────────────────────────────────┘│ │   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐│ │   │
│  │  │  │ "Add more context" textarea (optional refinement)           ││ │   │
│  │  │  └─────────────────────────────────────────────────────────────┘│ │   │
│  │  │  [← Back]  [Regenerate]  [Save ✓]                               │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  API Client: synthesize(rawInput, additionalContext?) → SynthesizedEntity   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /api/entity/synthesize
                                    │ { rawInput: string, additionalContext?: string }
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Controller: synthesizeHandler(req, res)                                     │
│    │                                                                         │
│    │  1. Validate rawInput (non-empty string)                               │
│    │  2. Call synthesis service                                             │
│    │  3. Return { entity: SynthesizedEntity }                               │
│    ↓                                                                         │
│  Service: synthesizeEntity(rawInput, additionalContext?)                     │
│    │                                                                         │
│    │  1. Build prompt with schema instructions                              │
│    │  2. Call OpenAI with AbortController timeout (60s)                     │
│    │  3. Parse JSON response                                                │
│    │  4. Return typed entity                                                │
│    ↓                                                                         │
│  OpenAI API (gpt-4-turbo)                                                   │
│    - response_format: { type: 'json_object' }                               │
│    - temperature: 0.3 (consistent synthesis)                                │
│    - System prompt: extraction instructions                                 │
│    - User prompt: raw input + schema                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Initial Synthesis

```
User speaks/types
    ↓
useSpeechRecognition.transcript → textarea.value
    ↓
Click "Generate"
    ↓
POST /api/entity/synthesize { rawInput: "..." }
    ↓
LLM extracts structured fields
    ↓
Return preview JSON (NOT saved to DB)
    ↓
Display in preview step
```

### 2. Iterative Refinement

```
User adds context in refinement textarea
    ↓
Click "Regenerate"
    ↓
POST /api/entity/synthesize {
  rawInput: "Previous profile:\n{JSON}\n\nOriginal input:\n{original}",
  additionalContext: "user's refinement"
}
    ↓
LLM regenerates with context
    ↓
Updated preview
```

### 3. Save

```
User clicks "Save"
    ↓
POST /api/entity (existing create endpoint)
    ↓
Saved to database
    ↓
Modal closes, UI updates
```

## Key Components

### Backend Service

**Purpose:** Transform natural language into structured data via LLM

**Key characteristics:**
- 60-second timeout with AbortController
- gpt-4-turbo model with temperature 0.3
- JSON response format for reliable parsing
- Detailed prompt with exact schema

```typescript
interface SynthesisService<T> {
  synthesize(rawInput: string, additionalContext?: string): Promise<T>
}
```

### Frontend Modal

**Purpose:** 2-step wizard for input → preview → save

**State machine:**
```
'input' ←→ 'preview'
   ↓           ↓
 Close       Save
```

**Key state:**
- `step: 'input' | 'preview'`
- `rawInput: string`
- `additionalContext: string`
- `synthesizedEntity: T | null`
- `synthesizing: boolean`
- `saving: boolean`
- `error: string`

### Voice Input Hook

**Purpose:** Browser native speech recognition with graceful degradation

**Key characteristics:**
- Uses `window.SpeechRecognition` or `window.webkitSpeechRecognition`
- Returns `isSupported` flag for conditional rendering
- Continuous recognition with interim results
- Automatic cleanup on unmount

```typescript
interface SpeechRecognitionHook {
  isListening: boolean
  transcript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}
```

## Error Handling

### Backend

| Error | Response | User Message |
|-------|----------|--------------|
| Empty input | 400 | "rawInput is required" |
| LLM timeout | 500 | "Synthesis timed out. Please try again." |
| LLM error | 500 | Error message from LLM |
| Parse error | 500 | "Synthesis failed" |

### Frontend

| Error | Handling |
|-------|----------|
| Synthesis fails | Show error banner, keep user on input step |
| Save fails | Show error banner, keep user on preview step |
| Voice not supported | Hide mic button, text input always available |
| Voice error | Stop listening, show console warning |

## Security Considerations

1. **Input validation**: Always validate rawInput is non-empty string
2. **Authentication**: Synthesis endpoints require authentication
3. **Rate limiting**: Prevent abuse of LLM calls
4. **Output sanitization**: Don't trust LLM output blindly
5. **No direct database writes**: Synthesis returns preview, user confirms save

## Performance Characteristics

| Operation | Expected Latency |
|-----------|------------------|
| Synthesis | 2-5 seconds |
| Save | < 500ms |
| Voice recognition | Real-time (50-200ms delay) |

## Extensibility Points

1. **Custom schemas**: Change the output interface and prompt
2. **Multiple entity types**: Create separate services for different entities
3. **Custom prompts**: Adjust extraction guidelines per entity type
4. **Streaming**: Could add streaming for long synthesis (not implemented)
5. **History**: Could store synthesis attempts for debugging (not implemented)
