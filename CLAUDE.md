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

### Context Layers
```typescript
const layers = await prisma.contextLayer.findMany({ where: { projectId, isActive: true }, orderBy: { priority: 'asc' } })
const byCategory = groupBy(layers, 'category')
```
**Rule:** NEVER manually edit layers - re-run interview to change behavior.

### Document References
`[DOC:filename:section-id]` → Frontend opens, scrolls, highlights

### Access Types
`public_password` | `email_required` (captures leads) | `whitelist`

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

## Critical Rules

- **Context Layers:** Never manual edit → re-run interview
- **Documents:** Extract full text to DB, generate outlines + summaries
- **Analytics:** Log all viewer interactions
- **Access:** Always verify, log all attempts
