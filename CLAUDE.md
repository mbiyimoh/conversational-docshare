# Conversational Document IDE

## User Context
Product owner (non-engineer). Claude handles ALL technical operations.
- NEVER ask user to run commands or check database
- Run commands proactively (npm, git, docker, prisma)
- Handle errors autonomously; escalate only when user input truly needed

---

## Design System (33 Strategies)

**Reference:** `.claude/skills/33-strategies-frontend-design.md` | **Command:** `/design:overhaul <component>`

**Fonts:** `Instrument Serif` (headlines) | `DM Sans` (body/UI) | `JetBrains Mono` (labels)

**Colors:** Background `#0a0a0f` | Card `rgba(255,255,255,0.03)` + `backdrop-blur-sm` | Text `#f5f5f5`/`#888`/`#555` | Gold `#d4a54a` | Border `rgba(255,255,255,0.08)`

**Patterns:** Section labels `01 — TITLE` (gold mono) | Headlines with gold key phrase | Glass cards | Framer Motion fade-up

**Rules:** NO emojis (use SVG) | NO Inter/purple gradients | Dark mode only

---

## Database (CRITICAL)

**Stack:** Supabase PostgreSQL + Prisma (`db push`, NOT migrations)

**After schema changes:** `cd backend && npm run db:push` → Restart backend → `curl localhost:4000/health`

**NEVER without approval:** `db:cleanup`, `migrate reset`, `--force-reset`, DROP TABLE

---

## Test Credentials
**Email:** mbiyimoh@gmail.com | **Password:** MGinfinity09!

---

## Dev Environment Reset (When Changes Don't Appear)

**Problem:** Code changes not showing in browser despite hard refresh or incognito mode.

**Command:** `/dev:fresh-start` - Kills all dev processes, clears caches, restarts servers.

**What it does (SAFE):**
- Kills Vite + backend processes (this project only)
- Clears `.vite` module cache
- Restarts both dev servers

**What it does NOT do:**
- Does NOT touch database
- Does NOT delete source files or node_modules
- Does NOT affect git

**After running:** Hard refresh browser (Cmd+Shift+R) or use fresh incognito window.

---

## Scroll Containment (CRITICAL)

**Problem:** `scrollIntoView()` scrolls viewport, not just panel.

**Solution:** Manual `container.scrollTo()`:
```typescript
const scrollToSection = useCallback((sectionId: string) => {
  const element = sectionRefs.current.get(sectionId)
  const container = scrollContainerRef.current
  if (!element || !container) return
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const targetScroll = elementRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (element.clientHeight / 2)
  container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
}, [])
```
**File:** `DocumentContentViewer.tsx:77-123` | **Fix:** Add `min-h-0` to flex children

---

## Mobile Responsive Patterns

### Mobile Document Viewer Overlay

**Pattern:** Full-screen slide-in overlay for document viewing on mobile (<768px).

**Key Files:**
- `useIsMobile.ts` - Reactive viewport detection hook using `matchMedia` API
- `MobileDocumentOverlay.tsx` - Framer Motion overlay component
- `SharePage.tsx:622-697` - Mobile layout branching logic

**How it works:**
- Desktop: Side-by-side Resplit layout (chat | documents)
- Mobile: Single-panel chat with FileText icon → full-screen overlay
- Overlay modes: `capsule` (document list) → `document` (viewer)
- Citation clicks auto-open overlay in document mode

**Integration Pattern:**
```typescript
const isMobile = useIsMobile(768) // 768px breakpoint (Tailwind md)

// Auto-close overlay when resizing to desktop
useEffect(() => {
  if (!isMobile && mobileOverlayOpen) {
    setMobileOverlayOpen(false)
  }
}, [isMobile, mobileOverlayOpen])

// Auto-open when document selected on mobile
useEffect(() => {
  if (isMobile && panelMode === 'document' && selectedDocumentId) {
    setMobileOverlayOpen(true)
  }
}, [isMobile, panelMode, selectedDocumentId])
```

**Gotchas:**
- **Scroll lock**: Set `document.body.style.overflow = 'hidden'` when overlay open, restore on close
- **Escape key**: Add event listener only when overlay is open to avoid memory leaks
- **Resize handling**: Auto-close overlay when viewport expands to desktop to prevent hidden state
- **Animation**: Use Framer Motion spring physics (`damping: 28, stiffness: 300`) for native feel
- **Backdrop click**: Separate backdrop `div` with `onClick={onClose}` to dismiss
- **Header buttons**: "Back" navigates capsule↔document, "X" closes entirely

**Extending this:**
- Breakpoint configurable via `useIsMobile(breakpoint)` parameter
- Overlay component reusable for any dual-mode content (list → detail)
- Framer Motion `initial`/`animate`/`exit` pattern portable to other overlays

---

## Project Purpose

Chat-first document sharing: creators upload docs, configure AI via interview, share links for conversational access.

**Flow:** Interview → Context Layers (audience, communication, content, engagement) → Runtime AI behavior

---

## Tech Stack
**Frontend:** React/Vite/TS, Tailwind, shadcn/ui, PDF.js, Mammoth.js, SheetJS
**Backend:** Express/TS, PostgreSQL/Prisma, Vercel AI SDK
**Deploy:** Docker Compose

---

## Critical Patterns

### Document Upload & Processing

**Upload Flow:** Client → Multer middleware → `documentProcessor.ts` → Queue → RAG pipeline

**Production Upload Fixes (CRITICAL):**

1. **CORS + Content-Type** - Multer requires proper CORS and explicit `Content-Type: multipart/form-data`
   - File: `backend/src/index.ts:19-30` - CORS config with credentials
   - Client must NOT set `Content-Type` header (browser sets it with boundary)

2. **File Size Limits** - Multer enforces 50MB limit
   - File: `backend/src/middleware/upload.ts:6` - `limits: { fileSize: 50 * 1024 * 1024 }`
   - Error: "File too large" triggers before upload completion

3. **Temporary File Cleanup** - Multer stores in `/tmp`, must move to permanent storage
   - File: `document.controller.ts:37-46` - Moves from `file.path` to `uploads/`
   - Gotcha: Production Railway ephemeral filesystem requires external storage (S3/Cloudflare R2)

**Document Reprocessing:**
- Script: `backend/scripts/reprocess-documents.ts` - Reprocesses failed documents
- Service: `backend/src/services/documentReprocessor.ts` - Handles retry logic
- Use when: Documents stuck in `processing` status or missing embeddings

**Duplicate Header Stripping (CRITICAL):**

Documents often have section heading duplicated in markdown:
```markdown
# Board Memo

Board Memo content here...
```

**Fix:** `DocumentContentViewer.tsx:556` uses regex `/^[^\n]+\n*/` to strip first line
- OLD BUG: `/^.+?\n*/` (non-greedy) only matched 1 char, leaving "oard Memo"
- FIX: `/^[^\n]+\n*/` (greedy non-newline) matches full first line

**When to apply:**
- Document title matches first line of content
- Markdown headers (`# Title`) when section title matches
- Normalize both strings (lowercase, remove non-alphanumeric) for comparison

**Files:** `DocumentContentViewer.tsx:544-558`

### Context Layers
```typescript
const layers = await prisma.contextLayer.findMany({ where: { projectId, isActive: true }, orderBy: { priority: 'asc' } })
const byCategory = groupBy(layers, 'category')
```
**Rule:** NEVER manually edit layers - re-run interview to change behavior.

### Document References & Citations

**Format:** `[DOC:filename:section-id]` → Frontend opens, scrolls, highlights

**Dual-Filename System (CRITICAL):**

Documents have TWO filenames:

1. **Internal filename** (`filename` in DB): Storage identifier with timestamp + hash
   - Example: `1766337527304_631ff5d36a408576.docx`
   - Used by AI in RAG citations
   - Stored in `documents.filename` column

2. **Display filename** (`originalName` in DB): User-uploaded name
   - Example: `Board_Memo.docx`
   - Shown in UI for human readability
   - Stored in `documents.originalName` column

**Citation Resolution Flow:**

- **Backend RAG:** `embeddingService.ts:111-181` returns BOTH filenames
- **API Layer:** `shareLink.controller.ts` exposes `filename` (display) + `internalFilename` (storage)
- **Frontend Lookup:** `documentLookup.ts:72-82` maps by BOTH for O(1) resolution

**Gotcha:** Citations use internal filenames but UI shows display names. Frontend cache MUST map both:
```typescript
// Map display filename
byFilename.set(doc.filename.toLowerCase(), doc)

// CRITICAL: Also map internal filename for citation matching
if (doc.internalFilename && doc.internalFilename !== doc.filename) {
  byFilename.set(doc.internalFilename.toLowerCase(), doc)
}
```

**Files:** `embeddingService.ts:111-181` | `shareLink.controller.ts` | `api.ts:444-456` | `documentLookup.ts:72-82`

**Citation Enrichment Pattern (CRITICAL):**

All components that render citations MUST use the fallback pattern to handle cases where section lookup fails:

```typescript
// Enrich citations with document/section titles
const enrichedCitations: Citation[] = collected.map((c) => {
  const sectionInfo = getSectionInfo(c.filename, c.sectionId)
  // If section lookup fails, still try to get document display name
  // This handles cases where section ID doesn't match but document exists
  const documentTitle = sectionInfo?.documentTitle || getDocumentDisplayName(c.filename)
  return {
    number: c.number,
    filename: c.filename,
    sectionId: c.sectionId,
    documentTitle: documentTitle || undefined,
    sectionTitle: sectionInfo?.sectionTitle,
  }
})
```

**Components using this pattern:**
- `ChatMessage.tsx:49-61` - Share page chat
- `ConversationDetailPanel.tsx:61-71` - Analytics conversation detail
- `DojoChat.tsx:26-38` - Testing Dojo messages

**Gotcha:** If you add citation rendering to a new component, apply this fallback pattern. Without it, citations will show internal alphanumeric filenames when section lookup fails.

**Why it's needed:** AI may reference sections that were deleted/renamed, or use stale section IDs. The fallback ensures we show the document name even when section lookup fails.

### Access Types
`public_password` | `email_required` (captures leads) | `whitelist`

### Opening Message Customization

**What it does:** Per-link custom intro messages shown to viewers when they first access a share link, with AI generation + manual editing.

**Key files:**
- `backend/src/services/welcomeService.ts` - AI generation with document context
- `backend/src/controllers/shareLink.controller.ts:generateOpeningMessagePreview` - Preview endpoint
- `frontend/src/components/share-link/OpeningMessageSection.tsx` - Editor with preview
- `backend/src/services/chatService.ts:createConversation` - Runtime lookup

**Data Flow (CRITICAL):**
1. **Link Creation**: Optional opening message stored in `ShareLink.openingMessage`
2. **Viewer Access**: Frontend passes `shareLinkId` to `createConversation()`
3. **Runtime Lookup**: Backend checks `shareLinkId` → fetches `ShareLink.openingMessage`
4. **Fallback**: If no stored message, generates dynamic message via `welcomeService`

**Gotchas:**
- **shareLinkId MUST be passed** through the entire chain: `SharePage.tsx` → `api.createConversation()` → `chat.controller.ts` → `chatService.createConversation()`. Missing this breaks custom message lookup.
- Character limit enforced at 950 chars (backend auto-condenses if LLM exceeds limit)
- Preview endpoints use GPT-4o with document outlines + agent profiles for context
- Uses `openingMessageVersions` array (max 10) for client-side version history

**Integration points:**
- Connects to `welcomeService.generateWelcomeMessage()` for dynamic generation
- `ShareLinkManager.tsx` shows "Custom Intro" badge on links with custom messages
- View-only modal uses `Modal` component for consistency (not inline markup)

**Extending this:**
- To add refinement prompts, use `refineOpeningMessagePreview` endpoint
- Versioning handled client-side via `OpeningMessageSection` state
- Backend stores only final message in `ShareLink.openingMessage`, not versions

---

## ProfileSectionContent
**File:** `ProfileSectionContent.tsx`

Handles mixed JSON/markdown from OpenAI. Preprocesses `**camelCaseKey**:`, inline bullets, JSON objects.

**Gotcha:** Convert camelCase to Title Case for display.

---

## Testing Dojo

Sandbox for testing AI agent with sessions/comments.

**Files:** `TestingDojo.tsx` | `DojoChat.tsx` (SSE) | `testSession.controller.ts`

**Stale Closure Gotcha:**
```typescript
// BAD: setActiveSession({ ...activeSession, messages: [...] })
// GOOD: setActiveSession(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
```

---

## Profile Recommendations

Analyzes Dojo comments → generates recommendations → version history + rollback.

**Files:** `recommendationEngine.ts` | `RecommendationPanel.tsx` | `AgentProfile.tsx`

**Types:** ADD | REMOVE | MODIFY

**LLM Gotcha:** Explicitly require fields: `addedContent` for ADD, `modifiedFrom`+`modifiedTo` for MODIFY

**Diff Gotcha:** Validate before/after differ (normalize whitespace)

---

## Key Models
```prisma
ContextLayer { projectId, category, priority, content, metadata, isActive }
TestSession { projectId, name, status, messages[], endedAt }
TestMessage { sessionId, role, content, comments[] }
ProfileRecommendation { projectId, setId, type, targetSection, addedContent?, status }
ProfileVersion { projectId, version, profile (JSON), source }
```

---

## Document Editing & Versioning

TipTap editor with version history and rollback.

**Files:** `DocumentEditor.tsx` | `DocumentVersionHistory.tsx` | `documentVersion.controller.ts` | `tiptapUtils.ts`

**Gotchas:**
- Import `asyncHandler` from `../middleware/errorHandler`
- Use shared `tipTapToPlainText()` from `tiptapUtils.ts`
- Install `@types/diff`
- NEVER use `document` as variable (shadows DOM global)

---

## Collaborator Comments

Highlight-to-comment system.

**Files:** `DocumentContentViewer.tsx` | `CollaboratorCommentPanel.tsx` | `documentComment.controller.ts`

**Text Offset Gotcha:** Use DOM TreeWalker, NOT `indexOf()` (fails on duplicate text):
```typescript
const calculateTextOffset = (container: HTMLElement, range: Range): number => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let offset = 0, node: Node | null
  while ((node = walker.nextNode())) {
    if (node === range.startContainer) return offset + range.startOffset
    offset += (node.textContent || '').length
  }
  return -1
}
```

**useCallback Gotcha:** Include all called functions in deps; wrap async functions in useCallback first.

---

## Document Viewer Preferences & Paper Mode

**What it does:** Personalized reading experience for shared document viewers via CSS custom properties.

**Key Files:**
- `ViewerPreferencesProvider.tsx` - Context provider that manages preferences + localStorage
- `ViewerPreferencesOnboarding.tsx` - First-time preference collection modal
- `DocumentContentViewer.tsx` - Applies CSS variables to content
- `ChatMessage.tsx` - Applies CSS variables to chat messages

**CSS Variables Applied:**
```css
--font-body-chat: /* Font family for chat */
--font-body-doc: /* Font family for document viewer */
--font-size-doc: /* Base font size */
--leading-doc: /* Line height for documents */
--leading-chat: /* Line height for chat */
--max-line-doc: /* Max line width for documents */
--max-line-chat: /* Max line width for chat */
--letter-spacing-body: /* Letter spacing */
```

**Paper Mode:** Special high-contrast theme for document viewer
- Background: `#f8f6f0` (cream)
- Text: `#1a1a1a` (near-black)
- Applied via `data-paper-mode="true"` attribute
- Only affects document content, not surrounding UI

**Integration Points:**
- Preferences stored in `localStorage` as `viewer_preferences_{slug}`
- Onboarding shows once per share link (stored in `localStorage` as `viewer_onboarding_completed_{slug}`)
- Provider wraps entire `ShareLinkView` component
- CSS vars set on `documentElement` for global access

**Gotchas:**
- Paper mode requires explicit background color on document container, not just CSS var
- Font selector must handle system fonts like `-apple-system` correctly
- CSS vars must be set before rendering to avoid flash of unstyled content
- Line height (leading) values are unitless multipliers (e.g., `1.65` not `1.65em`)

**Extending this:**
- Add new preferences to `ViewerPreferences` type in `ViewerPreferencesProvider.tsx`
- Add corresponding CSS var to `applyPreferences()` function
- Add UI control in `ViewerPreferencesOnboarding.tsx`

---

## Agent Profile Synthesis

AI-first profile creation via braindump (voice/text) → 12-field structured profile with confidence signals.

**Files:** `profileSynthesizer.ts` | `agent.controller.ts` | `agent.routes.ts`

**12 Fields (4 categories):**
- Identity: agentIdentity, domainExpertise, targetAudience
- Communication: toneAndVoice, languagePatterns, adaptationRules
- Content: keyTopics, avoidanceAreas, examplePreferences
- Engagement: proactiveGuidance, framingStrategies, successCriteria

**DB Fields:** `rawBrainDump` (original input) | `synthesisMode` (voice/text/interview) | `lightAreas` (low-confidence fields)

**Confidence:** EXPLICIT (stated) | INFERRED (from context) | ASSUMED (default)

**Config:** Min 50 chars | GPT-4-turbo, temp 0.3 | 60s timeout | `additionalContext` for refinement

---

## Agent Tab Architecture

AgentPage wrapper handles profile existence check and navigation.

**Files:** `AgentPage.tsx` | `SourceMaterialModal.tsx` | `AgentInterviewModal.tsx` | `AgentProfile.tsx`

**Navigation:** `useSearchParams` with `/projects/:id?tab=agent` | Default: 'documents'

**Gotchas:**
- Source from `rawBrainDump` or `interviewData` in AgentConfig
- Check `status === 'complete'` via `api.getAgentConfig()`
- Preserve input on refinement errors
- Interview modal calls `onComplete()`, doesn't show sub-tab

---

## User Feedback System

Public feedback portal for authenticated users to submit and upvote feedback.

**Files:**
- Frontend: `frontend/src/components/feedback/*.tsx`
- Backend: `backend/src/controllers/feedback.controller.ts`
- Types: `frontend/src/types/feedback.ts`
- Page: `frontend/src/pages/FeedbackPage.tsx`

**Key patterns:**
- Areas stored as JSON array (multi-select: DOCUMENT_UPLOAD, AI_CHAT, SHARE_LINKS, ANALYTICS, AGENT_CONFIG, GENERAL)
- Upvotes use optimistic UI with rollback on error
- Status dropdown only visible to SYSTEM_ADMIN users
- Self-vote auto-created on feedback submission (starts at count 1)
- Cursor-based pagination with "Load More" button

**Models:**
```prisma
UserRole { USER, SYSTEM_ADMIN }
FeedbackType { BUG, ENHANCEMENT, IDEA, QUESTION }
FeedbackStatus { OPEN, IN_REVIEW, PLANNED, IN_PROGRESS, COMPLETED, CLOSED }
Feedback { userId, title, description, areas (JSON), type, status, upvoteCount }
FeedbackVote { feedbackId, userId } @@unique([feedbackId, userId])
```

**API Endpoints:**
- `GET /api/feedback` - List with filters (sort, area, type, status) and cursor pagination
- `POST /api/feedback` - Create feedback (auto self-vote)
- `POST /api/feedback/:id/vote` - Toggle upvote { action: 'upvote' | 'remove' }
- `PATCH /api/feedback/:id/status` - Update status (SYSTEM_ADMIN only)

**Making yourself admin:**
```bash
cd backend && DOTENV_CONFIG_PATH=../.env npx tsx --require dotenv/config scripts/set-admin-role.ts
```
Or edit `scripts/set-admin-role.ts` to change the email.

**Button placement:**
- Creator views (Dashboard, Project): Fixed bottom-left
- FeedbackButton component with `context="creator"` or `context="viewer"` prop

---

## Critical Rules

- **Context Layers:** Never manual edit → re-run interview
- **Documents:** Extract full text to DB, generate outlines + summaries
- **Analytics:** Log all viewer interactions
- **Access:** Always verify, log all attempts
