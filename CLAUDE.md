# Conversational Document IDE - Claude Context

## Working with This User

**User Profile:** Technically literate product owner but NOT an engineer. Claude handles 100% of technical operations.

**Critical Rules:**
- ❌ NEVER ask user to run CLI commands - execute them directly via Bash
- ❌ NEVER ask user to check database - use Prisma CLI or SQL via Bash
- ✅ Run ALL commands proactively (npm, git, docker, prisma, etc.)
- ✅ Handle errors autonomously; only escalate when user input truly needed

---

## Design System (33 Strategies Brand)

**When modifying ANY frontend/UI code, follow the 33 Strategies design system.**

**Full Reference:** `.claude/skills/33-strategies-frontend-design.md`

**Slash Command:** Use `/design:overhaul <component-or-page>` for systematic redesigns.

### Quick Reference

**Fonts:**
- Display/Headlines: `Instrument Serif` (headlines, stats, key phrases)
- Body/UI: `DM Sans` (paragraphs, buttons, forms)
- Mono/Labels: `JetBrains Mono` (section markers, uppercase labels)

**Core Colors:**
- Background: `#0a0a0f` (dark with blue undertone)
- Card: `rgba(255,255,255,0.03)` with `backdrop-blur-sm`
- Text: `#f5f5f5` / `#888888` / `#555555`
- Gold accent: `#d4a54a` (for key phrases, CTAs, stats)
- Border: `rgba(255,255,255,0.08)`

**Key Patterns:**
- Section labels: `01 — TITLE` (gold, uppercase, tracked mono)
- Headlines: Plain text with gold key phrase: `"Technology is plateauing. <span class="text-[#d4a54a]">Value creation is just starting.</span>"`
- Cards: Glass effect with `backdrop-blur-sm`, subtle border, optional gold glow
- Motion: Framer Motion fade-up on scroll, 0.5s, staggered delays

**Rules:**
- NO emojis in visualizations - use geometric SVG shapes
- NO Inter font, purple gradients, or generic "AI slop" aesthetics
- Luxury editorial meets technical precision
- Always dark mode

---

## Database Schema Changes (CRITICAL)

**Database:** Supabase PostgreSQL | **Schema:** `prisma db push` (NOT migrations)

**After ANY schema changes:**
```bash
cd backend && npm run db:push
```

**Why:** Schema changes aren't auto-applied. App fails silently if tables don't exist.

**Workflow:** Edit schema.prisma → `npm run db:push` → Restart backend → Verify: `curl localhost:4000/health`

**NEVER use without approval:** `npm run db:cleanup`, `prisma migrate reset`, `prisma db push --force-reset`, DROP TABLE

---

## Test Credentials

**Email:** mbiyimoh@gmail.com | **Password:** MGinfinity09!

---

## Scroll Containment (CRITICAL)

**Problem:** `scrollIntoView()` scrolls viewport instead of just the document panel.

**Solution:** Use `container.scrollTo()` with manual position calculation:

```typescript
const scrollToSection = useCallback((sectionId: string) => {
  const element = sectionRefs.current.get(sectionId)
  const container = scrollContainerRef.current
  if (!element || !container) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const elementTop = elementRect.top - containerRect.top + container.scrollTop
  const targetScroll = elementTop - (container.clientHeight / 2) + (element.clientHeight / 2)

  container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
}, [])
```

**Key files:** `frontend/src/components/DocumentContentViewer.tsx:77-123`

**Flex layout fix:** Add `min-h-0` to flex children for proper scroll containment.

---

## Project Purpose

**Platform:** Chat-first document sharing where creators upload docs, configure AI via interview, share links for conversational access.

**Users:** Creators (consultants, founders) → configure AI agent → Viewers (board, investors) → chat with AI instead of reading docs

**Core Innovation:** Interview responses → Context Layers → AI behavior (no hardcoding)

```
Interview → Context Layers (audience, communication, content, engagement) → Runtime AI behavior
```

---

## Tech Stack

**Frontend:** React + Vite + TypeScript, Tailwind, shadcn/ui, PDF.js, Mammoth.js, SheetJS
**Backend:** Express.js + TypeScript, PostgreSQL + Prisma, Vercel AI SDK (OpenAI/Anthropic)
**Deploy:** Docker Compose

---

## Critical Patterns

### Context Layer Composition

```typescript
const layers = await prisma.contextLayer.findMany({
  where: { projectId, isActive: true },
  orderBy: { priority: 'asc' }
})
const byCategory = groupBy(layers, 'category')
// Compose into structured system prompt grouped by category
```

**Rule:** Layers are NEVER manually edited - re-run interview to change behavior.

### Document References

Format: `[DOC:filename:section-id]` → Frontend auto-opens document, scrolls, highlights

### Access Types

- `public_password` - Anyone with link + password
- `email_required` - Must provide email (30% drop, captures leads)
- `whitelist` - Pre-approved emails only

---

## ProfileSectionContent (AI Content Formatting)

**File:** `frontend/src/components/ProfileSectionContent.tsx`

**Handles:** Mixed JSON/markdown from OpenAI - preprocesses `**camelCaseKey**:` patterns, inline bullets `• item`, inline JSON objects before ReactMarkdown rendering.

**Gotcha:** Always convert camelCase keys to Title Case for display.

---

## Testing Dojo

**What:** Sandbox where creators test AI agent by simulating recipient experience with sessions/comments.

**Files:**
- `frontend/src/components/TestingDojo/TestingDojo.tsx` - Container
- `frontend/src/components/TestingDojo/DojoChat.tsx` - SSE streaming chat
- `backend/src/controllers/testSession.controller.ts` - Session CRUD + SSE

**Critical Gotcha - Stale Closure:**

```typescript
// ❌ BAD - Stale closure with rapid SSE updates
setActiveSession({ ...activeSession, messages: [...activeSession.messages, msg] })

// ✅ GOOD - Functional setState
setActiveSession(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
```

**When:** Any state updated by SSE streaming or rapid async events.

---

## Profile Recommendation System

**What:** Analyzes Testing Dojo comments → generates profile-direct recommendations → version history + rollback.

**Files:**
- `backend/src/services/recommendationEngine.ts` - LLM analysis
- `frontend/src/components/RecommendationPanel.tsx` - Review UI
- `frontend/src/components/AgentProfile.tsx` - Version history dropdown

**Types:** ADD (append content), REMOVE (exact phrase), MODIFY (replace phrase)

**Critical Gotcha - LLM Prompt:**

```typescript
// LLMs need EXPLICIT field requirements:
`For "add" type: "addedContent" is REQUIRED
For "modify" type: "modifiedFrom" and "modifiedTo" are BOTH REQUIRED`
```

**Critical Gotcha - Diff Validation:**
Always validate before/after differ (normalize whitespace) before showing recommendation.

**APIs:**
- `POST /api/projects/:projectId/recommendations/generate`
- `POST /api/projects/:projectId/recommendations/apply-all`
- `POST /api/projects/:projectId/profile/rollback`
- `GET /api/projects/:projectId/profile/versions`

---

## UI Pattern: Click-Outside Dropdown

```tsx
{showDropdown && (
  <>
    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
    <div className="absolute z-50">{/* content */}</div>
  </>
)}
```

---

## Key Database Models

```prisma
ContextLayer { projectId, category, priority, content, metadata, isActive }
TestSession { projectId, name, status, messages[], endedAt }
TestMessage { sessionId, role, content, comments[] }
TestComment { messageId, content, templateId? }
ProfileRecommendation { projectId, setId, type, targetSection, addedContent?, status }
ProfileVersion { projectId, version, profile (JSON), source }
```

---

## Document Editing & Versioning

**What:** TipTap-based rich text editor with non-destructive version history and rollback.

**Key files:**
- `frontend/src/components/DocumentEditor.tsx` - TipTap editor with toolbar
- `frontend/src/components/DocumentVersionHistory.tsx` - Version list with diff comparison
- `backend/src/controllers/documentVersion.controller.ts` - Version CRUD + rollback
- `backend/src/services/documentVersioning.ts` - Version management service
- `frontend/src/lib/tiptapUtils.ts` - Shared TipTap text extraction utility

**Integration points:**
- Edit/History buttons added to `DocumentUpload.tsx` document list
- Uses modals for editor and version history UI
- Version content stored as TipTap JSON in database

**Critical Gotchas:**
- **Import Path**: `asyncHandler` must be imported from `../middleware/errorHandler`, NOT `../utils/asyncHandler`
- **Text Extraction**: Always use shared `tipTapToPlainText()` from `tiptapUtils.ts` - synced with backend logic
- **TypeScript**: Install `@types/diff` for diff library type definitions
- **Variable Naming**: NEVER use `document` as variable name - shadows global DOM object. Use `docData` or similar.

**APIs:**
- `GET /api/documents/:documentId/edit` - Get document for editing
- `POST /api/documents/:documentId/versions` - Create new version
- `GET /api/documents/:documentId/versions` - List all versions
- `POST /api/documents/:documentId/rollback/:versionNum` - Rollback to version

---

## Collaborator Comments

**What:** Highlight-to-comment system where collaborators select text and add contextual comments.

**Key files:**
- `frontend/src/components/DocumentContentViewer.tsx` - Text selection detection
- `frontend/src/components/CollaboratorCommentPanel.tsx` - Comment submission UI
- `backend/src/controllers/documentComment.controller.ts` - Comment CRUD
- `frontend/src/pages/SharePage.tsx` - Comment integration

**Text Selection Implementation:**

```typescript
// Calculate offset using DOM TreeWalker for accurate positioning
const calculateTextOffset = (container: HTMLElement, range: Range): number => {
  const treeWalker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  )
  let offset = 0
  let node: Node | null
  while ((node = treeWalker.nextNode())) {
    if (node === range.startContainer) {
      return offset + range.startOffset
    }
    offset += (node.textContent || '').length
  }
  return -1
}
```

**Critical Gotchas:**
- **Offset Calculation**: NEVER use `indexOf()` for text offset - fails when same text appears multiple times. Use DOM TreeWalker API.
- **useCallback Dependencies**: Include ALL functions called inside the callback. Example: `loadComments` must be in `handleSubmitComment` deps array.
- **useCallback Stability**: Wrap async functions like `loadComments` in `useCallback` before using in other callback deps.

**APIs:**
- `POST /api/documents/:documentId/comments` - Create comment (optionally authenticated)
- `GET /api/documents/:documentId/comments` - Get all comments for document
- `PATCH /api/comments/:id/status` - Update comment status (authenticated)

---

## Recommendation Application with Diff Preview

**What:** Before applying profile recommendations, show diff preview modal with before/after comparison.

**Key files:**
- `frontend/src/components/RecommendationApplyModal.tsx` - Diff preview modal
- `frontend/src/components/RecommendationCard.tsx` - Triggers modal
- Uses `diff` library's `diffWords()` for text comparison

**Integration:**
- Clicking "Apply" on recommendation card opens modal first
- Modal fetches latest profile version, shows diff, then applies
- Uses shared `tipTapToPlainText()` for text extraction before diff

**Critical Gotchas:**
- **Diff Library Types**: Must install `@types/diff` for TypeScript support
- **Text Extraction**: Use shared utility from `tiptapUtils.ts`, not duplicate code

---

## AI-First Profile Creation

**What:** Voice-friendly brain dump to structured profiles. Users describe audiences/collaborators naturally via voice or text, AI synthesizes to structured fields with iterative refinement.

**Files:**
- `backend/src/services/profileBrainDumpSynthesizer.ts` - LLM synthesis service
- `frontend/src/components/AudienceProfileAIModal.tsx` - AI modal for audience profiles
- `frontend/src/components/CollaboratorProfileAIModal.tsx` - AI modal for collaborator profiles
- `frontend/src/hooks/useSpeechRecognition.ts` - Browser speech recognition hook

**Pattern Distinction:**
- **"AI-assisted manual editing"** (this feature): User brain dumps → AI synthesizes → user refines → save
- **Dojo recommendation system** (existing): AI analyzes test comments → generates recommendations → user approves

**APIs:**
- `POST /api/audience-profiles/synthesize` - Preview synthesis (not saved)
- `POST /api/collaborator-profiles/synthesize` - Preview synthesis (not saved)

**Key Implementation Notes:**
- Uses browser native SpeechRecognition API (graceful degradation if unsupported)
- 60-second LLM timeout matches profileSynthesizer.ts pattern
- gpt-4-turbo model with temperature 0.3 for consistent synthesis
- Supports additionalContext parameter for iterative refinement
- "Switch to manual entry" fallback available in modals
- Modal mode resets to 'ai' on close for next use

---

## Critical Rules

**Context Layers:** Never manual edit → re-run interview → regenerate layers
**Documents:** Always extract full text to DB, generate outlines + AI summaries
**Analytics:** Log every viewer interaction, generate conversation summaries
**Access:** Always require verification, log all attempts (even denied)
