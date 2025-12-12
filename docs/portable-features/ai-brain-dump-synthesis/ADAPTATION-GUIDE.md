# Adaptation Guide: AI Brain Dump Synthesis

This guide explains how to adapt the AI Brain Dump Synthesis feature for your specific entity types and schema.

## Overview of Adaptation Steps

1. **Define your output schema** - What structured data do you want to extract?
2. **Customize the LLM prompts** - Guide the AI to extract your specific fields
3. **Create the frontend modal** - Adapt the UI for your entity's preview
4. **Wire up routes and API** - Connect frontend to backend

---

## Step 1: Define Your Output Schema

The first step is defining what structured data you want to extract from natural language.

### Example: Event Profile

```typescript
// Your output interface
interface SynthesizedEventProfile {
  title: string
  description: string | null
  eventType: 'conference' | 'workshop' | 'meetup' | 'webinar'
  targetAudience: string | null
  keyTopics: string[]
  estimatedDuration: string | null
  format: 'in-person' | 'virtual' | 'hybrid' | null
}
```

### Schema Design Guidelines

1. **Required vs Optional**: Use `| null` for optional fields
2. **Enums**: Use union types for constrained values (the AI respects these)
3. **Arrays**: Use `string[]` for multi-value fields like tags or topics
4. **Keep it flat**: Nested objects work but simple flat structures synthesize more reliably

---

## Step 2: Customize the LLM Prompts

The prompt is the heart of accurate synthesis. Copy and modify the pattern from `backend-service.ts`.

### Prompt Template Structure

```typescript
function buildYourEntityPrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT (user provided refinements):\n${additionalContext}`
    : ''

  return `Extract a [YOUR ENTITY TYPE] from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "field1": "Description of what to extract for field1",
  "field2": "Description for field2 (use null if not mentioned)",
  "enumField": "value1" | "value2" | "value3",
  "arrayField": ["item1", "item2"]
}

Guidelines:
- For enumField: Explain when to use each value
- arrayField should be an array of strings, even if empty
- Infer reasonable defaults if specific information isn't provided
- If a field cannot be determined, use null`
}
```

### Prompt Best Practices

1. **Be explicit about the JSON schema** - Show exact structure with descriptions
2. **Explain enum values** - Tell the AI when to use each option
3. **Handle unknowns** - Tell the AI to use `null` when information is missing
4. **Give examples in the schema comments** - e.g., `"Short title (2-5 words, e.g., 'Board Review Q4')"`

### Common Prompt Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Vague field descriptions | AI guesses wrong | Be specific about what to extract |
| Missing enum guidance | AI uses wrong enum values | Explain when to use each value |
| No null handling | AI makes up data | Explicitly say "use null if not mentioned" |
| Too many nested objects | Unreliable parsing | Keep structure flat |

---

## Step 3: Create the Frontend Modal

Copy `frontend-modal.tsx` as your starting point. Key areas to customize:

### 1. Interface & State Types

```typescript
// Change the synthesized entity type
interface SynthesizedYourEntity {
  // Your fields here
}

// Update the component props
interface YourEntityAIModalProps {
  entity: YourEntity | null  // null = create, existing = edit
  onClose: () => void
  onSaved: (entity: YourEntity) => void
  onSwitchToManual: () => void
}
```

### 2. Preview Step Rendering

The preview step needs to display your synthesized fields appropriately:

```tsx
{/* For simple string fields */}
<ProfileField label="Title" value={synthesizedEntity.title} />

{/* For arrays - render as pills */}
<div className="px-4 py-3">
  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
    Topics
  </div>
  <div className="flex flex-wrap gap-2">
    {synthesizedEntity.keyTopics.length > 0 ? (
      synthesizedEntity.keyTopics.map((topic, i) => (
        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
          {topic}
        </span>
      ))
    ) : (
      <span className="text-gray-400 italic">Not specified</span>
    )}
  </div>
</div>

{/* For enums - render as badge */}
<div className="px-4 py-3">
  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
    Event Type
  </div>
  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm capitalize">
    {synthesizedEntity.eventType}
  </span>
</div>
```

### 3. Save Handler

Map synthesized data to your save API:

```typescript
const handleSave = async () => {
  if (!synthesizedEntity) return

  setSaving(true)
  setError('')

  try {
    const data = {
      title: synthesizedEntity.title,
      description: synthesizedEntity.description || undefined,
      eventType: synthesizedEntity.eventType,
      // ... map all fields
    }

    let result
    if (isEditing && entity) {
      result = await api.updateYourEntity(entity.id, data)
    } else {
      result = await api.createYourEntity(data)
    }
    onSaved(result.entity)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save')
  } finally {
    setSaving(false)
  }
}
```

---

## Step 4: Wire Up Routes and API

### Backend Route

```typescript
// routes/yourEntity.routes.ts
import { synthesizeYourEntityHandler } from '../controllers/yourEntity.controller'

router.post('/your-entities/synthesize', authenticate, asyncHandler(synthesizeYourEntityHandler))
```

### Backend Controller Handler

```typescript
// controllers/yourEntity.controller.ts
export async function synthesizeYourEntityHandler(req: Request, res: Response) {
  const { rawInput, additionalContext } = req.body

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    const entity = await synthesizeYourEntity(rawInput, additionalContext)
    return res.json({ entity })
  } catch (error) {
    console.error('Synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}
```

### Frontend API Client

```typescript
// lib/api.ts
async synthesizeYourEntity(rawInput: string, additionalContext?: string) {
  return this.request<{ entity: SynthesizedYourEntity }>(
    '/api/your-entities/synthesize',
    {
      method: 'POST',
      body: JSON.stringify({ rawInput, additionalContext }),
    }
  )
}
```

---

## Complete Example: Meeting Notes Synthesis

Here's a complete example of synthesizing meeting notes:

### Schema

```typescript
interface SynthesizedMeetingNotes {
  title: string
  date: string | null
  attendees: string[]
  keyDecisions: string[]
  actionItems: Array<{ task: string; owner: string | null; dueDate: string | null }>
  nextSteps: string | null
  mood: 'positive' | 'neutral' | 'tense' | null
}
```

### Prompt

```typescript
function buildMeetingNotesPrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT:\n${additionalContext}`
    : ''

  return `Extract structured meeting notes from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "title": "Meeting title (e.g., 'Q4 Planning Review', 'Product Sync')",
  "date": "Date of meeting if mentioned (ISO format YYYY-MM-DD), null if not mentioned",
  "attendees": ["Name 1", "Name 2"],
  "keyDecisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    { "task": "What needs to be done", "owner": "Person responsible or null", "dueDate": "YYYY-MM-DD or null" }
  ],
  "nextSteps": "Summary of what happens next, or null",
  "mood": "positive" | "neutral" | "tense" | null
}

Guidelines:
- Extract all mentioned people as attendees
- Action items should be specific and actionable
- For mood: "positive" if successful/optimistic, "tense" if disagreements/concerns raised, "neutral" otherwise
- If no action items are mentioned, use empty array []
- Infer meeting title from context if not explicitly stated`
}
```

---

## Testing Your Adaptation

### 1. Test the Prompt Directly

Before building the full UI, test your prompt with raw API calls:

```bash
curl -X POST http://localhost:4000/api/your-entities/synthesize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"rawInput": "We had a meeting with John and Sarah about the product launch. John will handle marketing by Friday."}'
```

### 2. Edge Cases to Test

| Test Case | Expected Behavior |
|-----------|-------------------|
| Minimal input | AI infers reasonable defaults |
| Very detailed input | All fields populated correctly |
| Missing optional fields | Returns null for those fields |
| Conflicting information | AI picks most reasonable interpretation |
| Non-English input | Works if model supports the language |

### 3. Prompt Iteration

If synthesis results aren't accurate:

1. Check which fields are wrong
2. Add more specific guidance in the prompt for those fields
3. Include examples in the field descriptions
4. Test again with varied inputs

---

## Optional Enhancements

### Streaming Responses

For very long synthesis times (>3s), consider streaming:

```typescript
// Backend: Return partial progress
response.write(`data: {"status": "extracting_fields"}\n\n`)
// ... later
response.write(`data: {"status": "complete", "entity": ${JSON.stringify(result)}}\n\n`)
```

### Multiple Entity Types

If you need synthesis for multiple entity types in one service:

```typescript
export async function synthesize<T>(
  entityType: 'meeting' | 'event' | 'person',
  rawInput: string,
  additionalContext?: string
): Promise<T> {
  const promptBuilder = {
    meeting: buildMeetingPrompt,
    event: buildEventPrompt,
    person: buildPersonPrompt,
  }[entityType]

  // ... rest of synthesis logic
}
```

### History Tracking

Store synthesis attempts for debugging or undo:

```typescript
await prisma.synthesisHistory.create({
  data: {
    entityType: 'meeting',
    rawInput,
    additionalContext,
    result: JSON.stringify(synthesized),
    userId: req.user.userId,
  }
})
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Empty response" error | LLM returned nothing | Check API key, increase max_tokens |
| Wrong enum values | Prompt doesn't explain enums | Add clear enum guidance |
| Missing fields | AI didn't extract them | Make fields more prominent in prompt |
| Slow synthesis (>5s) | Model choice or prompt length | Use gpt-3.5-turbo for simpler schemas |
| JSON parse errors | LLM returned invalid JSON | Ensure `response_format: { type: 'json_object' }` |

---

## Checklist for New Entity Types

- [ ] Define TypeScript interface for synthesized output
- [ ] Create prompt builder function with clear schema and guidelines
- [ ] Add synthesis function to backend service
- [ ] Add controller handler with input validation
- [ ] Register route (POST /api/your-entities/synthesize)
- [ ] Add API client method in frontend
- [ ] Create/adapt modal component with preview rendering
- [ ] Test with varied inputs
- [ ] Handle edge cases (empty input, missing fields, etc.)
