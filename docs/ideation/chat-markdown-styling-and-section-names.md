# Chat Markdown Styling and Human-Readable Section Names

**Slug:** chat-markdown-styling-and-section-names
**Author:** Claude Code
**Date:** 2025-12-12
**Branch:** preflight/chat-markdown-styling-and-section-names
**Related:** SharePage.tsx, ChatMessage.tsx, documentReferences.ts

---

## 1) Intent & Assumptions

- **Task brief:** Apply actual markdown styling to agent messages in the receiver's document exploration chat UI, and display document section references as readable section names (e.g., "Executive Summary") instead of numeric/hex ID strings (e.g., "section-abc123").

- **Assumptions:**
  - The receiver chat UI refers to `SharePage.tsx` and the `ChatMessage` component used there
  - "Markdown styling" means rendering bold, italics, lists, code blocks, links, etc.
  - Section names should be derived from the document outline data already available in `documentLookup.ts`
  - Dependencies for markdown rendering (`react-markdown`, `remark-gfm`, `@tailwindcss/typography`) are already installed
  - The streaming behavior must continue to work smoothly with markdown rendering

- **Out of scope:**
  - Modifying backend LLM prompts or citation format
  - Adding new markdown features like LaTeX/math support
  - Creator-side chat experiences (Testing Dojo uses different components)
  - Document content rendering (already handled separately)

---

## 2) Pre-reading Log

- `frontend/src/components/ChatMessage.tsx`: Currently renders plain text with `whitespace-pre-wrap`. Citations parsed via `splitMessageIntoParts()` and rendered as clickable buttons showing filename only.

- `frontend/src/lib/documentReferences.ts`: Parses `[DOC:filename:section-id]` citations. On line 100, sets `content: ref.filename` - only shows filename, not section title.

- `frontend/src/lib/documentLookup.ts`: Caches document data including `outline: Array<{ id, title, level, position }>`. Has `lookupDocumentByFilename()` that returns full DocumentInfo including outline.

- `frontend/src/components/ChatInterface.tsx`: Handles streaming via SSE. Updates `streamingContent` state during stream. Passes content to `ChatMessage` component.

- `frontend/package.json`: Already has `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `@tailwindcss/typography@0.5.19` installed.

- `developer-guides/chat-conversation-system-guide.md`: Documents citation format as `[DOC:filename:section-id]` and data flow from backend through frontend rendering.

- `backend/src/services/contextService.ts:76-79`: System prompt includes section title to ID mapping for AI: `${section.title} -> section-id: \`${section.id}\``. AI knows section titles.

---

## 3) Codebase Map

- **Primary components/modules:**
  - `frontend/src/components/ChatMessage.tsx:27-47` - Message bubble rendering, citation button display
  - `frontend/src/lib/documentReferences.ts:76-116` - `splitMessageIntoParts()` creates text/reference parts
  - `frontend/src/lib/documentLookup.ts:97-123` - `lookupDocumentByFilename()` returns DocumentInfo with outline

- **Shared dependencies:**
  - `react-markdown` - Markdown parsing and rendering (already installed)
  - `remark-gfm` - GitHub Flavored Markdown support (already installed)
  - `@tailwindcss/typography` - Prose styling classes (already installed)
  - Document lookup cache - Required for section name resolution

- **Data flow:**
  ```
  Backend Stream → ChatInterface.tsx (accumulates chunks)
       → ChatMessage.tsx (renders)
       → splitMessageIntoParts() (extracts citations)
       → lookupDocumentByFilename() (resolves doc info + outline)
       → Render markdown + clickable citations with section titles
  ```

- **Feature flags/config:** None

- **Potential blast radius:**
  - SharePage.tsx viewer experience (direct impact)
  - Any component reusing ChatMessage (e.g., if TestingDojo uses same component - but it uses DojoChat.tsx separately)
  - Styling may affect message bubble layout/sizing

---

## 4) Root Cause Analysis

N/A - This is a feature enhancement, not a bug fix.

---

## 5) Research

### Potential Solutions

#### Solution 1: ReactMarkdown with Custom Components Prop

**Approach:** Use `react-markdown` with `components` prop to intercept and render custom citation elements alongside standard markdown.

**Implementation Pattern:**
```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Pre-process content to extract citations, then render remaining text as markdown
// Citations rendered as custom inline buttons
```

**Pros:**
- Already installed in project (`react-markdown@10.1.0`, `remark-gfm@4.0.1`)
- Battle-tested library with 6.5M weekly downloads
- `components` prop allows seamless custom element injection
- Secure by default (no raw HTML)
- Works well with `@tailwindcss/typography` prose classes

**Cons:**
- Need to handle citation extraction before markdown processing
- Re-parses entire message on each render during streaming (performance consideration)
- May need memoization for streaming optimization

#### Solution 2: Pre-process Then Render

**Approach:** First extract citations from content, replace with unique placeholders, render markdown, then inject citation buttons at placeholder positions.

**Pros:**
- Clean separation of concerns
- Can optimize citation extraction independently

**Cons:**
- More complex implementation
- Placeholder replacement can be fragile
- Harder to maintain

#### Solution 3: Block-Based Memoization (Streaming Optimization)

**Approach:** Split message into stable "blocks" during streaming. Memoize already-rendered blocks to prevent re-parsing. Only parse new content.

**Pros:**
- Best performance for streaming scenarios
- Prevents flickering during stream
- Used by Vercel AI SDK examples

**Cons:**
- More complex implementation
- May be overkill for current message lengths

### Recommendation

**Use Solution 1 (ReactMarkdown with Custom Components) with light memoization.**

**Rationale:**
1. Dependencies already installed - zero additional bundle size
2. Current streaming behavior works fine without aggressive optimization (messages are typically <500 words)
3. Simple implementation that can be enhanced later if needed
4. The `splitMessageIntoParts()` function already handles citation extraction - integrate with ReactMarkdown's component override

### For Section Name Display

**Approach:** Enhance `ChatMessage.tsx` to look up section title from `documentLookup` cache:

```typescript
// In ChatMessage.tsx when rendering reference part:
const docInfo = lookupDocumentByFilename(part.reference.filename)
const sectionTitle = docInfo?.outline?.find(s => s.id === part.reference.sectionId)?.title
const displayText = sectionTitle || part.reference.filename // Fallback to filename
```

**Key insight:** The `outline` array is already cached in `documentLookup.ts` and contains `{ id, title, level }` for each section. We just need to look it up.

---

## 6) Clarification

1. **Streaming performance tolerance:** During message streaming, markdown re-parsing happens on each chunk. Is the current ~50-100ms render time acceptable, or should we implement block-based memoization from the start?
   - *Recommendation:* Start simple, optimize if issues appear

2. **Citation display format preference:** When showing section names, what format is preferred?
   - Option A: Just section name - `"Executive Summary"`
   - Option B: Document + section - `"Business Plan: Executive Summary"`
   - Option C: Icon + section name - `[doc icon] Executive Summary`
   - *Recommendation:* Option C (icon + section name) - matches current pattern but more readable

3. **Fallback behavior:** If section title lookup fails (e.g., cache not initialized, section deleted), should we:
   - Option A: Show filename (current behavior)
   - Option B: Show section ID as-is
   - Option C: Show "View Document" generic text
   - *Recommendation:* Option A (filename) - graceful degradation

4. **Markdown styling scope:** Should markdown apply to:
   - Option A: Assistant messages only (recommended - user messages are typically short)
   - Option B: Both user and assistant messages
   - *Recommendation:* Option A - user messages don't typically contain markdown

5. **Typography styling preference:** Use Tailwind Typography prose classes for markdown?
   - Option A: Full `prose` styling
   - Option B: Minimal styling (just bold/italic/lists without prose sizing)
   - *Recommendation:* Option B - prose can override message bubble sizing

---

## 7) Implementation Outline

### Phase 1: Markdown Rendering (Core)

1. **Modify `ChatMessage.tsx`:**
   - Import `ReactMarkdown` and `remarkGfm`
   - For assistant messages, render content through ReactMarkdown
   - Use `components` prop to style elements appropriately
   - Handle citations as custom inline elements

2. **Styling adjustments:**
   - Add markdown-specific styles to message bubbles
   - Ensure code blocks, lists, bold/italic render correctly
   - Test with dark theme (33 Strategies design system)

### Phase 2: Section Name Display

1. **Add section title lookup:**
   - Create helper in `documentReferences.ts` or `ChatMessage.tsx`
   - Look up section title from cached outline data
   - Graceful fallback to filename if lookup fails

2. **Update citation button display:**
   - Show section title instead of filename
   - Keep filename in tooltip for reference

### Phase 3: Polish

1. **Streaming optimization (if needed):**
   - Add React.memo to stable message blocks
   - Consider useMemo for parsed message parts

2. **Testing:**
   - Verify streaming still works smoothly
   - Test various markdown elements (lists, code, bold, links)
   - Test citation click-to-scroll behavior still works
   - Test fallback when section not found

---

## 8) Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/ChatMessage.tsx` | Add ReactMarkdown, section title lookup, update citation display |
| `frontend/src/lib/documentReferences.ts` | (Optional) Add helper for section title lookup |
| `frontend/src/components/ChatInterface.tsx` | No changes needed |
| `frontend/src/lib/documentLookup.ts` | Add `getSectionTitle()` helper function |

---

## 9) Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Streaming performance degradation | Low | Medium | Start simple, add memoization if needed |
| Citation parsing breaks with markdown | Low | High | Keep citation extraction before markdown render |
| Section title lookup fails | Medium | Low | Graceful fallback to filename |
| Styling conflicts with design system | Medium | Medium | Test thoroughly with 33 Strategies theme |

---

## 10) Success Criteria

- [ ] Assistant messages render markdown (bold, italics, lists, code blocks)
- [ ] Citations display section name (e.g., "Executive Summary") instead of ID
- [ ] Clicking citations still opens document and scrolls to section
- [ ] Streaming messages render smoothly without flickering
- [ ] Dark theme styling is consistent with 33 Strategies design system
- [ ] Graceful fallback when section title unavailable
