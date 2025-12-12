# AI Brain Dump to Structured Profile Synthesis

A portable feature for transforming natural language "brain dumps" (via voice or text) into structured data profiles using LLM synthesis.

## What This Feature Does

Users describe something (a person, audience, entity) in natural, unstructured language - either by speaking or typing. The system uses an LLM to extract structured fields from that input, presents a preview for review, allows iterative refinement, and saves the final structured data.

**User Flow:**
```
Brain Dump (voice/text) → LLM Synthesis → Preview → Optional Refinement → Save
```

## Files in This Package

| File | Purpose |
|------|---------|
| `README.md` | This overview |
| `ARCHITECTURE.md` | Technical architecture, data flow, and system design |
| `ADAPTATION-GUIDE.md` | How to adapt this for your specific use case |
| `source-code/backend-service.ts` | LLM synthesis service (the core logic) |
| `source-code/frontend-hook.ts` | React hook for browser voice input |
| `source-code/frontend-modal.tsx` | Complete React modal component example |
| `source-code/shared-components.tsx` | Reusable UI components |
| `source-code/api-client.ts` | Frontend API client methods |
| `source-code/controller.ts` | Backend HTTP controller/handlers |

## Quick Start

### 1. Backend Setup

1. Copy `source-code/backend-service.ts` to your backend services directory
2. Copy `source-code/controller.ts` handlers to your controller
3. Register the route: `POST /api/your-entity/synthesize`
4. Requires: OpenAI API access (gpt-4-turbo or similar)

### 2. Frontend Setup

1. Copy `source-code/frontend-hook.ts` to your hooks directory
2. Copy `source-code/frontend-modal.tsx` and adapt for your entity type
3. Copy `source-code/shared-components.tsx` for UI components
4. Add API client method from `source-code/api-client.ts`

### 3. Adapt the Schema

The key adaptation is changing the **output schema** - the structured fields you want to extract. See `ADAPTATION-GUIDE.md` for detailed instructions.

## Tech Stack Requirements

**Backend:**
- Node.js/TypeScript
- OpenAI API (gpt-4-turbo recommended)
- Any HTTP framework (Express, Fastify, etc.)

**Frontend:**
- React 18+
- TypeScript
- Tailwind CSS (for styling - easily adaptable)
- Browser with SpeechRecognition API support (graceful degradation included)

## Key Design Decisions

1. **Preview before save**: Synthesis returns a preview, not directly saved data. User must confirm.
2. **Iterative refinement**: Users can add context and regenerate without starting over.
3. **Voice-first, text-friendly**: Voice input is primary UX, text always available as fallback.
4. **Graceful degradation**: Works without voice if browser doesn't support it.
5. **Manual fallback**: "Switch to manual entry" always available if AI isn't working.

## Example Use Cases

- **Audience Profiles**: "Board members focused on ROI and risk" → structured communication preferences
- **Contact Profiles**: "Sarah, our CFO, expert in finance" → name, email, expertise areas
- **Customer Personas**: "Young professionals, tech-savvy, price-sensitive" → demographic data
- **Meeting Notes**: "Discussed Q4 targets, John raised concerns about timeline" → structured action items
- **Product Feedback**: Voice recording of user feedback → categorized insights

## License

This code is provided as documentation/reference. Adapt freely for your projects.
