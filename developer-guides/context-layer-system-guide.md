# Context Layer System - Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT LAYER SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐  │
│  │   AgentInterview │────▶│  profileSynthesizer │────▶│    AgentConfig     │  │
│  │    (Frontend)    │     │      (LLM)          │     │    (Database)      │  │
│  │                  │     │                     │     │                    │  │
│  │  5 Questions:    │     │  gpt-4-turbo        │     │  profile (JSON)    │  │
│  │  - audience      │     │  Batched generation │     │  interviewData     │  │
│  │  - purpose       │     │  60s timeout        │     │  profileVersion    │  │
│  │  - tone          │     │                     │     │                    │  │
│  │  - emphasis      │     └──────────────────┘     └─────────────────────┘  │
│  │  - questions     │              │                         │              │
│  └─────────────────┘              │                         │              │
│                                    ▼                         ▼              │
│                    ┌──────────────────────────────────────────────┐        │
│                    │            contextService.ts                 │        │
│                    │                                              │        │
│                    │  buildSystemPrompt() composes:               │        │
│                    │  1. Context layers by category               │        │
│                    │  2. Document outlines with section IDs       │        │
│                    │  3. Citation instructions                    │        │
│                    └──────────────────────────────────────────────┘        │
│                                         │                                   │
│                                         ▼                                   │
│                              ┌─────────────────────┐                       │
│                              │     AI CHAT         │                       │
│                              │                     │                       │
│                              │  System prompt from │                       │
│                              │  context layers     │                       │
│                              │  drives AI behavior │                       │
│                              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘

LAYER CATEGORIES (Priority Order):
┌────────────────┬───────────────────────────────────────────────────────────┐
│ Category       │ Purpose                                                   │
├────────────────┼───────────────────────────────────────────────────────────┤
│ audience (10)  │ Who the AI is speaking to, their background/expectations │
│ communication  │ Tone, style, technical level, citation requirements      │
│ (9)            │                                                           │
│ content (8)    │ What to emphasize, purpose, factual constraints          │
│ engagement (7) │ Proactive questions, follow-up suggestions               │
└────────────────┴───────────────────────────────────────────────────────────┘
```

## Dependencies & Key Functions

### External Dependencies
- `openai` - GPT-4-turbo for profile synthesis (temperature 0.3)
- `prisma` - Database ORM for AgentConfig, ContextLayer models

### Internal Dependencies
- `backend/src/utils/openai.ts` - OpenAI client singleton
- `backend/src/utils/prisma.ts` - Prisma client singleton
- `backend/src/utils/errors.ts` - LLMError class

### Provided Functions

**contextService.ts:**
- `buildSystemPrompt(projectId)` - Composes system prompt from layers + documents
- `createContextLayersFromInterview(projectId, interviewData)` - Creates basic layers (legacy)
- `getContextLayers(projectId)` - Fetches active layers ordered by priority

**profileSynthesizer.ts:**
- `synthesizeProfile(interviewData)` - Generates 5-section profile via LLM
- `generateSingleSection(interviewData, sectionId, isStructured)` - Single section regen
- `regenerateProfile(projectId)` - Full regeneration from stored interview data

### Configuration
- `LLM_TIMEOUT_MS = 60000` - 60 second timeout for profile generation
- `MAX_SECTION_LENGTH = 4000` - Max chars per profile section
- `STRUCTURED_INPUT_THRESHOLD = 200` - Word count to trigger structure preservation

## User Experience Flow

### Interview → Profile → Chat

1. **Creator opens project** → AgentInterview.tsx loads
2. **Creator answers 5 questions** → Stored in `interviewData`
3. **Creator clicks "Complete"** → `synthesizeProfile()` called
4. **LLM generates 5 profile sections** → Stored in `AgentConfig.profile`
5. **Viewer chats via SharePage** → `buildSystemPrompt()` composes prompt
6. **AI uses context layers** → Behavior matches creator's configuration

### Profile Sections (5 Total)

| Section ID | Title | Purpose |
|------------|-------|---------|
| `identityRole` | Identity & Role | Who the AI represents, core mission |
| `communicationStyle` | Communication Style | Tone, language patterns, detail level |
| `contentPriorities` | Content Priorities | Topics to emphasize, factual constraints |
| `engagementApproach` | Engagement Approach | How to guide conversations |
| `keyFramings` | Key Framings | How to position key messages |

## File & Code Mapping

### Key Files

| File | Responsibility | Lines |
|------|----------------|-------|
| `backend/src/services/profileSynthesizer.ts` | LLM-based profile generation | 503 |
| `backend/src/services/contextService.ts` | System prompt composition | 217 |
| `frontend/src/components/AgentInterview.tsx` | Interview UI, 5 questions | 400+ |
| `frontend/src/components/AgentProfile.tsx` | Profile display, versioning | 500+ |
| `backend/src/controllers/agent.controller.ts` | API endpoints | 398 |

### Entry Points

- **Profile Generation:** `POST /api/projects/:projectId/agent/complete`
- **Single Section Regen:** `POST /api/projects/:projectId/agent/sections/:sectionId/regenerate`
- **Chat System Prompt:** `chatService.ts` calls `buildSystemPrompt(projectId)`

### UX-to-Code Mapping

| User Action | Frontend File | Backend Endpoint |
|-------------|---------------|------------------|
| Answer interview question | `AgentInterview.tsx:100-130` | `PATCH /api/projects/:projectId/agent` |
| Complete interview | `AgentInterview.tsx:150-180` | `POST /api/projects/:projectId/agent/complete` |
| View profile | `AgentProfile.tsx` | `GET /api/projects/:projectId/agent` |
| Regenerate section | `AgentProfile.tsx:200-230` | `POST /api/projects/:projectId/agent/sections/:sectionId/regenerate` |

## Connections to Other Parts

### Data Sources
- **Writes to:** `AgentConfig.profile`, `AgentConfig.interviewData`, `ContextLayer` table
- **Reads from:** `AgentConfig`, `ContextLayer`, `Document` (for outlines)

### Integration Points

| System | Connection |
|--------|------------|
| Chat System | `buildSystemPrompt()` called on every chat message |
| Testing Dojo | Uses same system prompt as production chat |
| Recommendation System | Modifies profile sections directly (not interview data) |
| Profile Versioning | Creates `ProfileVersion` snapshots on recommendation apply |

### Event Flow
```
Interview complete
    ↓
synthesizeProfile() called
    ↓
Profile saved to AgentConfig
    ↓
Context layers available for chat
    ↓
Every chat message: buildSystemPrompt() → AI response
```

## Critical Notes & Pitfalls

### Security
- Interview data and profile content can contain sensitive business info
- Profile sections are included in chat prompts (visible in logs)

### Performance
- Profile synthesis takes 5-15 seconds (two parallel LLM batches)
- `buildSystemPrompt()` called on EVERY chat message (cached in memory would help)
- 60-second timeout protects against stuck LLM calls

### Data Integrity
- **CRITICAL:** Context layers are NEVER manually edited by users
- Re-running interview regenerates profile, which overwrites layers
- Profile versioning tracks changes from recommendations (not interview changes)

### Known Edge Cases

**Structure Preservation:**
```typescript
// If user provides tiered/structured input, LLM preserves it
const inputType = determineInputType(interviewData)
const useStructuredMode = inputType === 'structured'
// structured mode uses longer prompts, preserves tiers/lists
```

**Fuzzy Key Matching:**
```typescript
// LLM sometimes returns identity_role instead of identityRole
const sectionContent = extractSectionValue(parsed, sectionId)
// extractSectionValue handles: identityRole, identity_role, IdentityRole
```

**Object-to-String Conversion:**
```typescript
// LLM sometimes returns objects instead of strings
function valueToString(value: unknown): string | undefined {
  if (typeof value === 'object') {
    // Extract content/text field or format key-value pairs
  }
}
```

## Common Development Scenarios

### 1. Adding a New Interview Question

**Files to modify:**
1. `frontend/src/components/AgentInterview.tsx` - Add to `questions` array
2. `backend/src/services/profileSynthesizer.ts` - Add to `InterviewData` interface
3. `backend/src/services/profileSynthesizer.ts` - Include in prompt template
4. `backend/src/services/contextService.ts` - Add layer creation if needed

**Common mistakes:**
- Forgetting to add field to `InterviewData` interface
- Not including new field in LLM prompt template

**Verification:**
- Complete interview with new question
- Check profile includes new content
- Verify chat behavior reflects new context

### 2. Adding a New Profile Section

**Files to modify:**
1. `backend/src/services/profileSynthesizer.ts`:
   - Add to `SECTION_ORDER` array
   - Add to `SECTION_NAMES` object
   - Add to `SECTION_DESCRIPTIONS` object
   - Update batch assignment (batch1 vs batch2)
2. `frontend/src/components/AgentProfile.tsx` - Add section display
3. `backend/src/services/recommendationEngine.ts` - Add to `VALID_SECTION_IDS`

**Common mistakes:**
- Not updating all three constants (ORDER, NAMES, DESCRIPTIONS)
- Forgetting to add to recommendation engine validation

### 3. Debugging Profile Generation Failures

**Steps:**
1. Check logs for `[ProfileSynthesizer]` warnings
2. Verify OpenAI API key is valid
3. Check for timeout errors (60s limit)
4. Inspect raw LLM response for malformed JSON

**Key log patterns:**
```
[ProfileSynthesizer] Missing/invalid fields: identityRole, keyFramings
[ProfileSynthesizer] Fuzzy match: Expected 'identityRole', got 'identity_role'
[ProfileSynthesizer] Converted contentPriorities from object to string
```

## Testing Strategy

### Manual Testing Checklist
- [ ] Complete full interview (5 questions)
- [ ] Verify profile generates in <15 seconds
- [ ] Check all 5 sections have content
- [ ] Regenerate single section, verify update
- [ ] Start chat, verify AI uses profile context

### Smoke Tests
```bash
# Health check
curl http://localhost:4000/health

# Get agent config (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/projects/$PROJECT_ID/agent
```

### Debugging Tips
- Set `DEBUG=profileSynthesizer` for verbose logging
- Check OpenAI dashboard for rate limits
- Profile generation logs to console with section timing

## Quick Reference

### Start/Run Commands
```bash
cd backend && npm run dev  # Start backend with hot reload
cd frontend && npm run dev # Start frontend
```

### Key Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/:projectId/agent` | Get agent config + profile |
| PATCH | `/api/projects/:projectId/agent` | Save interview progress |
| POST | `/api/projects/:projectId/agent/complete` | Complete interview, generate profile |
| POST | `/api/projects/:projectId/agent/sections/:sectionId/regenerate` | Regen one section |

### Configuration Summary
| Constant | Value | Location |
|----------|-------|----------|
| `LLM_TIMEOUT_MS` | 60000 | profileSynthesizer.ts:36 |
| `MAX_SECTION_LENGTH` | 4000 | profileSynthesizer.ts:35 |
| `STRUCTURED_INPUT_THRESHOLD` | 200 | profileSynthesizer.ts:37 |
| Layer categories | audience, communication, content, engagement | contextService.ts:45 |

### Critical Files Checklist
1. `backend/src/services/profileSynthesizer.ts` - Profile generation
2. `backend/src/services/contextService.ts` - System prompt composition
3. `frontend/src/components/AgentInterview.tsx` - Interview UI
4. `frontend/src/components/AgentProfile.tsx` - Profile display
5. `backend/src/controllers/agent.controller.ts` - API handlers
6. `backend/prisma/schema.prisma` - AgentConfig, ContextLayer models
