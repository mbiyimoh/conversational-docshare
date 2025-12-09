# Viewer Experience: Citation Navigation System

**Slug:** viewer-citation-navigation-system
**Author:** Claude Code
**Date:** 2025-12-04
**Branch:** feat/viewer-experience
**Related:**
- `specs/receiver-experience-scaffold.md` (primary spec)
- `developer-guides/Phase-1-Architecture-Overview.md`
- `frontend/src/lib/documentReferences.ts` (existing parser)

---

## 1) Intent & Assumptions

- **Task brief:** Design and implement the citation navigation system for the viewer/recipient experience. This includes: parsing `[DOC:filename:section-id]` markers in AI chat responses, rendering them as clickable links, implementing smooth scroll-to-section with highlight animation when clicked, and building a side-by-side chat + document viewer layout with synchronized navigation.

- **Assumptions:**
  - Backend routes for chat and documents are already complete and functional
  - We're using real test project data (not fake/canned data)
  - PDF.js integration for document rendering is acceptable to defer (outline-based navigation first)
  - This work runs in parallel with Testing Dojo development
  - We will NOT modify: `chatService.ts`, `embeddingService.ts`, `schema.prisma`
  - The existing `documentReferences.ts` parser is a valid foundation to build upon

- **Out of scope:**
  - Phase 9 conversion modal (account creation)
  - File explorer sidebar for multi-document navigation
  - Mobile-responsive single-panel view (tablet/desktop first)
  - Session persistence / "Remember me" functionality
  - Whitelist access type verification
  - Full PDF.js document rendering (outline navigation is sufficient for MVP)

---

## 2) Pre-reading Log

- `specs/receiver-experience-scaffold.md`: Comprehensive 515-line pre-spec covering Phases 7-9. Defines citation format as `[DOC:filename:section-id]`, includes UI wireframes for 3-panel layout, specifies highlight animation behavior.

- `developer-guides/Phase-1-Architecture-Overview.md`: Backend 100% complete, frontend 40%. SharePage marked as "STUB". Documents data flow from viewer access → RAG search → LLM response with citations.

- `frontend/src/lib/documentReferences.ts`: **Existing parser already built.** Implements `parseDocumentReferences()` and `splitMessageIntoParts()` functions. Regex: `/\[DOC:([a-zA-Z0-9\s._-]+):([a-zA-Z0-9_-]+)\]/g`

- `frontend/src/components/ChatMessage.tsx`: Already uses `splitMessageIntoParts()` to render citations as clickable buttons with document icons. Passes `onCitationClick` callback.

- `frontend/src/pages/SharePage.tsx`: Implements basic access gate (password/email), split-panel layout, and `handleCitationClick` that sets `selectedDocumentId` and `highlightSectionId` state.

- `frontend/src/components/ChatInterface.tsx`: SSE streaming implemented with loading states. Passes `onCitationClick` to `ChatMessage` components.

- `frontend/src/components/DocumentViewer.tsx`: Basic outline navigation with section highlighting. Has `highlightSectionId` prop and `scrollIntoView` call, but **no highlight animation**.

- `frontend/package.json`: React 18.3.1, Tailwind 3.4.17, Framer Motion NOT installed (would need to add for animations), react-markdown 10.1.0 available.

---

## 3) Codebase Map

### Primary Components/Modules

| File | Role | Status |
|------|------|--------|
| `frontend/src/pages/SharePage.tsx` | Viewer entry point, layout orchestration | Partial - needs polish |
| `frontend/src/components/ChatInterface.tsx` | Chat with SSE streaming | Complete |
| `frontend/src/components/ChatMessage.tsx` | Message rendering with citation buttons | Complete |
| `frontend/src/components/DocumentViewer.tsx` | Document outline + highlight | Partial - needs animation |
| `frontend/src/lib/documentReferences.ts` | Citation parsing utilities | Complete |
| `frontend/src/lib/api.ts` | API client wrapper | Complete |

### Shared Dependencies

- **State Management:** React useState (no Zustand for viewer experience yet)
- **Styling:** Tailwind CSS + cn() utility from lib/utils
- **API:** `api.getShareLinkBySlug()`, `api.verifyShareLinkAccess()`, `api.createConversation()`, `api.getDocument()`
- **Streaming:** Native fetch + SSE parsing (not @microsoft/fetch-event-source)

### Data Flow

```
Viewer Access Flow:
1. URL /s/:slug → SharePage loads
2. GET /api/share/:slug → ShareLink metadata
3. Access gate (password/email) → POST /api/share/:slug/access
4. POST /api/conversations → Create conversation
5. Chat renders → User sends message

Citation Flow:
1. User message → POST /api/conversations/:id/messages/stream
2. SSE streaming → ChatInterface accumulates content
3. ChatMessage renders → splitMessageIntoParts() parses citations
4. User clicks citation → onCitationClick(filename, sectionId)
5. SharePage updates state → selectedDocumentId, highlightSectionId
6. DocumentViewer renders → scrollIntoView() + highlight
```

### Potential Blast Radius

**SAFE to modify (viewer-only files):**
- `frontend/src/pages/SharePage.tsx`
- `frontend/src/components/DocumentViewer.tsx`
- `frontend/src/lib/documentReferences.ts`
- New files: `CitationHighlight.tsx`, `ViewerLayout.tsx`

**DO NOT modify (shared with Testing Dojo):**
- `backend/src/services/chatService.ts`
- `backend/src/services/embeddingService.ts`
- `backend/prisma/schema.prisma`

**CAUTION (used by both but low risk):**
- `frontend/src/components/ChatInterface.tsx` - Could add viewer-specific variant
- `frontend/src/components/ChatMessage.tsx` - Already works for both

---

## 4) Root Cause Analysis

**N/A - This is a new feature, not a bug fix.**

---

## 5) Research Findings

### Citation Parsing Patterns

**Industry Examples:**
| Tool | Format | Rendering |
|------|--------|-----------|
| Perplexity AI | `[1]` inline footnotes | Superscript numbers, sidebar sources |
| ChatGPT (browsing) | `【9†source】` | Expandable source cards |
| Notion | `@page-mention` | Inline chips with hover preview |
| Google Docs | URL-based deep links | Browser hash navigation |
| Lexis/Westlaw | `[CASE:name:para]` | Linked case citations |

**Our Format:** `[DOC:filename:section-id]`
- **Pros:** Human-readable, self-documenting, easy to parse
- **Cons:** Verbose in chat output (consider shortening display text)

**Parsing Recommendation:**
The existing regex in `documentReferences.ts` is sound:
```typescript
const DOC_REFERENCE_REGEX = /\[DOC:([a-zA-Z0-9\s._-]+):([a-zA-Z0-9_-]+)\]/g
```

**Edge case improvements needed:**
1. Handle Unicode filenames (Japanese, Chinese docs)
2. Handle colons in section IDs (e.g., `section:1:2`)
3. Graceful handling of malformed citations (missing section-id)

### Scroll-to-Section with Highlight Animation

**Best Practices (from Nielsen Norman, MDN, Framer Motion docs):**

1. **Scroll Timing:**
   - Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` for center alignment
   - Native browser smooth scroll is sufficient (no library needed)
   - Delay highlight animation by ~300ms to let scroll complete

2. **Highlight Animation Options:**

   | Approach | Pros | Cons |
   |----------|------|------|
   | CSS `box-shadow` glow | No JS, performant | Limited customization |
   | CSS `@keyframes` pulse | GPU-accelerated, customizable | Requires animation class |
   | Framer Motion | React-native, declarative | Adds 40KB bundle |
   | CSS transition + setTimeout | Simple, no deps | Manual cleanup |

   **Recommendation:** CSS `@keyframes` with Tailwind animation class
   ```css
   @keyframes citation-highlight {
     0% { background-color: rgb(254 249 195); box-shadow: 0 0 0 4px rgb(254 240 138); }
     100% { background-color: transparent; box-shadow: none; }
   }
   .citation-highlight {
     animation: citation-highlight 2s ease-out forwards;
   }
   ```

3. **Highlight Duration:**
   - 2 seconds is optimal (long enough to notice, short enough not to annoy)
   - Auto-fade, no manual dismiss needed
   - Respect `prefers-reduced-motion`: skip animation, use static highlight

4. **Accessibility:**
   - Add `aria-live="polite"` region announcing document switch
   - Focus management: move focus to highlighted section
   - Keyboard navigation: Tab to citation → Enter to activate

### Side-by-Side Layout Patterns

**Industry Examples:**
- **Cursor AI:** Fixed ratio split, document pinned on right
- **GitHub Copilot Chat:** Collapsible sidebar, inline code references
- **VS Code:** Resizable split panes, multiple editor groups

**Library Options:**

| Library | Bundle Size | Accessibility | Modern CSS |
|---------|-------------|---------------|------------|
| `react-resplit` | 8KB | Excellent (ARIA) | CSS Grid |
| `react-split-pane` | 15KB | Basic | Flexbox |
| Custom CSS Grid | 0KB | Manual | CSS Grid |
| `allotment` | 20KB | Good | Flexbox |

**Recommendation:** Start with **custom CSS Grid** (no library), add `react-resplit` if resizing becomes a requirement.

```css
.viewer-layout {
  display: grid;
  grid-template-columns: minmax(400px, 1fr) minmax(300px, 40%);
  height: 100vh;
}
```

**Responsive Breakpoints:**
- Desktop (>1024px): Full split layout
- Tablet (768-1024px): Collapsible document panel
- Mobile (<768px): Out of scope for this iteration

### Edge Cases & Error Handling

| Scenario | Recommended Behavior |
|----------|---------------------|
| Section deleted/moved | Show warning badge, scroll to document top |
| Document deleted | Show "Document not found" message in viewer panel |
| Document access denied | Show "Request Access" prompt |
| Viewer offline | Cache last-viewed document, show offline indicator |
| Citation format invalid | Render as plain text, log warning |
| Multiple citations to same doc | Reuse open viewer, just scroll |
| Citation to different doc | Replace current doc in viewer |

**Key Principle:** Never remove broken citations from the chat. Show them with a visual indicator so users understand what the AI referenced.

### Accessibility Checklist

- [ ] Citations use `role="button"` (trigger action, not navigation)
- [ ] `aria-label="View Financial Projections, section 3.2"`
- [ ] Focus trap in document viewer panel
- [ ] `aria-live="polite"` for document switch announcements
- [ ] `prefers-reduced-motion` respected for animations
- [ ] Keyboard navigation: Tab through citations, Enter to activate
- [ ] Color contrast: citation links meet WCAG AA (4.5:1)

---

## 6) Clarifications Needed

1. **Citation Display Format:** Should we show the full `[DOC:filename:section-id]` or abbreviate to just the document name with a link icon? The full format is verbose in chat.

2. **Document Viewer Panel Behavior:** When clicking a citation to a different document, should we:
   - A) Replace the current document (simpler)
   - B) Add a tab for the new document (more complex, better for multi-doc)

3. **Panel Resizing:** Is user-resizable panels a requirement for MVP, or is a fixed 60/40 split acceptable?

4. **Filename vs Document ID:** The current citation format uses `filename`, but documents are stored by `id`. Should we:
   - A) Keep filename-based lookup (requires filename→id mapping)
   - B) Switch to `[DOC:documentId:sectionId]` format (breaking change to AI prompts)
   - C) Support both (more complex parsing)

5. **Section ID Generation:** How are section IDs generated during document processing? Need to verify the backend produces IDs that match what the AI will cite.

6. **Highlight Persistence:** When a user scrolls away from a highlighted section, should clicking the same citation again re-scroll and re-highlight?

---

## 7) Recommended Implementation Approach

### Phase 1: Core Citation Navigation (MVP)

**Files to create/modify:**

1. **NEW: `frontend/src/components/CitationHighlight.css`**
   - CSS keyframes for highlight animation
   - Tailwind-compatible utility classes

2. **MODIFY: `frontend/src/components/DocumentViewer.tsx`**
   - Add highlight animation class application
   - Improve scroll behavior with delay
   - Add error states for missing sections

3. **MODIFY: `frontend/src/pages/SharePage.tsx`**
   - Polish layout (consistent sizing, transitions)
   - Add loading states during document switch
   - Implement document lookup by filename

4. **NEW: `frontend/src/lib/documentLookup.ts`**
   - Utility to map filename → documentId
   - Cache project documents on load

### Phase 2: Polish & Edge Cases

1. **Error handling for broken citations**
2. **Accessibility improvements (ARIA, focus management)**
3. **Panel transition animations**

### Phase 3: (Out of Scope for Now)

1. Resizable panels
2. Document tabs
3. Mobile responsive

---

## 8) Code Patterns from Research

### Highlight Animation (CSS-only approach)

```css
/* Add to tailwind.config.js or global CSS */
@keyframes citation-glow {
  0% {
    background-color: rgb(254 249 195); /* yellow-100 */
    box-shadow: 0 0 0 4px rgb(254 240 138); /* yellow-200 */
  }
  70% {
    background-color: rgb(254 249 195);
    box-shadow: 0 0 0 4px rgb(254 240 138);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.citation-highlight {
  animation: citation-glow 2.5s ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .citation-highlight {
    animation: none;
    background-color: rgb(254 249 195);
    border-left: 4px solid rgb(234 179 8); /* yellow-500 */
  }
}
```

### Scroll + Highlight Coordination

```typescript
const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(`section-${sectionId}`);

  if (!element) {
    console.warn(`Section ${sectionId} not found, scrolling to top`);
    viewerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Scroll first
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Remove any existing highlight
  document.querySelector('.citation-highlight')?.classList.remove('citation-highlight');

  // Apply highlight after scroll completes
  setTimeout(() => {
    element.classList.add('citation-highlight');
  }, 400); // Wait for scroll to finish
};
```

### Document Lookup Utility

```typescript
// frontend/src/lib/documentLookup.ts
interface DocumentMap {
  [filename: string]: {
    id: string;
    title: string;
    outline: Section[];
  };
}

let documentCache: DocumentMap = {};

export async function initDocumentLookup(projectId: string): Promise<void> {
  const docs = await api.getProjectDocuments(projectId);
  documentCache = docs.reduce((acc, doc) => {
    // Map by both filename and title for flexibility
    acc[doc.filename] = doc;
    acc[doc.title] = doc;
    return acc;
  }, {} as DocumentMap);
}

export function lookupDocument(filename: string): DocumentMap[string] | null {
  return documentCache[filename] || null;
}
```

---

## 9) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Filename/ID mismatch | Medium | High | Build lookup utility, test with real data |
| Section IDs don't match AI output | Medium | High | Verify backend section ID generation |
| Scroll jank on large documents | Low | Medium | Use `scrollIntoView` native, not custom |
| Parallel dev conflicts | Medium | Medium | Strict file isolation per workstream |
| Animation performance | Low | Low | CSS-only, GPU-accelerated |

---

## 10) Next Steps

1. **Clarify questions in Section 6** with user before proceeding to spec
2. **Create formal spec** based on this ideation (using /spec:create)
3. **Implement Phase 1** focusing on core citation navigation
4. **Test with real project data** using existing test credentials

---

*This ideation document provides the research foundation for the formal specification. The citation navigation system builds on existing infrastructure (documentReferences.ts, ChatMessage.tsx, DocumentViewer.tsx) and requires primarily frontend-only changes that are safe to develop in parallel with Testing Dojo work.*
