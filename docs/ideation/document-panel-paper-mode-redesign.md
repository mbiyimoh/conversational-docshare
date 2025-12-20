# Document Panel "Paper Mode" Visual Redesign

**Slug:** document-panel-paper-mode-redesign
**Author:** Claude Code
**Date:** 2025-12-20
**Branch:** feat/document-panel-paper-mode
**Related:** specs/feat-docx-markdown-formatting-preservation.md

---

## 1) Intent & Assumptions

**Task brief:** Redesign the document panel to provide a more traditional document viewing experience with:
1. Light background (paper-like) with dark text for better readability
2. Visual differentiation from the dark-themed chat area
3. Preserved original document formatting (indentation, bullets, nested lists, sections)

**Assumptions:**
- Users are accustomed to viewing documents in light-background environments (Word, Google Docs, PDF readers)
- The current dark-on-dark rendering reduces readability and feels "reconstructed" rather than native
- DOCX content is already being stored as markdown (via mammoth → turndown pipeline)
- The chat panel will remain dark-themed per 33 Strategies brand
- Formatting issues (indentation, bullets) are CSS rendering issues, not data loss

**Out of scope:**
- Re-processing existing documents (backend changes to document storage format)
- PDF.js integration for native PDF rendering
- Real-time collaborative editing features
- Changing the chat panel theme

---

## 2) Pre-reading Log

| File | Key Takeaways |
|------|---------------|
| `frontend/src/components/DocumentContentViewer.tsx` | Main viewer component. Uses ReactMarkdown with remarkGfm. Complex Tailwind classes for list styling. Dark theme (`bg-card-bg`, `text-foreground/90`). Inline styles for typography (`--max-line-document`, `--leading-document`). |
| `frontend/src/components/DocumentViewer.tsx` | Outline-only viewer (older). Shows document structure, not content. Less relevant. |
| `frontend/src/components/DocumentCapsule.tsx` | Document list view with collapsible sections. Uses dark theme. |
| `frontend/src/pages/SharePage.tsx` | Container layout using Resplit. Document panel is `Resplit.Pane` with `bg-background-elevated`. Chat/document side-by-side. |
| `frontend/src/styles/globals.css` | CSS variables for 33 Strategies dark theme. Includes 5 theme variants (nord, warm-reading, high-contrast, soft-charcoal, ocean-depth). No light/paper mode. |
| `frontend/tailwind.config.js` | Uses @tailwindcss/typography plugin. Font families defined. All colors reference HSL CSS variables. |
| `backend/src/services/documentProcessor.ts` | DOCX → HTML (mammoth) → Markdown (turndown). Content stored as `fullText` (markdown). Outline extracted from headings. |
| `developer-guides/document-processing-guide.md` | Documents stored as chunks with `content` field containing markdown text. Embedding/RAG based on this content. |

---

## 3) Codebase Map

**Primary components/modules:**
- `frontend/src/components/DocumentContentViewer.tsx` - Main rendering component (needs redesign)
- `frontend/src/pages/SharePage.tsx` - Layout container
- `frontend/src/styles/globals.css` - Theme definitions

**Shared dependencies:**
- `react-markdown` - Markdown rendering
- `remark-gfm` - GitHub Flavored Markdown support
- `@tailwindcss/typography` - Typography plugin (not currently used in viewer)
- Tailwind CSS variables from globals.css

**Data flow:**
```
Backend: DocumentChunk.content (markdown string)
    ↓
API: /api/share/:slug/documents/:id/chunks
    ↓
Frontend: DocumentContentViewer.tsx
    ↓
ReactMarkdown → HTML → Tailwind CSS styling
```

**Feature flags/config:**
- `data-theme` attribute on root element controls theme variant
- `localStorage: viewer-chat-panel-fr` stores panel ratio
- Viewer preferences in `useViewerPreferences()` hook (depth, theme settings)

**Potential blast radius:**
- DocumentContentViewer.tsx (primary target)
- SharePage.tsx (container styling)
- globals.css (new CSS variables for paper mode)
- DocumentCapsule.tsx (if paper mode extends to capsule view)
- Viewer preferences system (if user toggle added)

---

## 4) Root Cause Analysis

**Repro steps:**
1. Access a share link with DOCX documents
2. Click on a document to open DocumentContentViewer
3. Observe: Dark background, light text, markdown rendering

**Observed vs Expected:**

| Aspect | Observed | Expected |
|--------|----------|----------|
| Background | Dark (`#0d0d14`) | Light/paper (`#ffffff` or cream) |
| Text color | Light gray (`rgba(245,245,245,0.9)`) | Dark (`#1a1a1a` or similar) |
| Visual feel | "Reconstructed" data view | Native document reading experience |
| Nested lists | Some indentation issues | Clear visual hierarchy |
| Bullet styles | Generic disc markers | Document-appropriate markers |

**Evidence:**
- `DocumentContentViewer.tsx:256` - `bg-card-bg` applies dark background
- `DocumentContentViewer.tsx:321` - `text-foreground/90` applies light text
- Complex inline Tailwind for lists (`[&>ul]:my-4 [&>ul]:ml-4`) fighting against dark theme
- No use of `@tailwindcss/typography` prose classes which handle nested lists better

**Root-cause hypotheses:**
1. **CSS-only issue (HIGH confidence)**: All styling is inline Tailwind targeting dark theme. Simply inverting colors and using prose classes should fix most issues.
2. **Data format issue (LOW confidence)**: Markdown from turndown might have formatting artifacts. However, pre-reading shows turndown is well-configured for headings/lists.
3. **ReactMarkdown limitation (MEDIUM confidence)**: Some complex nesting may not render ideally. Could be improved with custom renderers.

**Decision:** Focus on CSS/styling solution first. The markdown content is fine; it's the visual presentation that needs work.

---

## 5) Research Findings

### Approach A: "Paper Container" with react-markdown + Prose Classes

**Description:** Create an isolated light-background container for the document panel. Use Tailwind Typography plugin's `prose` classes for automatic formatting of nested elements.

**Pros:**
- Minimal code changes (CSS only)
- Proven pattern (Google Docs, Claude, Adobe Reader all use light document in dark UI)
- `prose` classes handle nested lists, headings, blockquotes automatically
- Maintains existing react-markdown pipeline
- User preference toggle can be added easily

**Cons:**
- May need custom CSS overrides for edge cases
- Contrast ratio between panels needs careful design
- Doesn't solve potential markdown conversion artifacts

**Implementation sketch:**
```tsx
// DocumentContentViewer.tsx
<div className="bg-white text-gray-900 rounded-lg shadow-lg m-4 p-8 prose prose-lg max-w-none">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {content}
  </ReactMarkdown>
</div>
```

---

### Approach B: TipTap Static Renderer

**Description:** Use TipTap (already in project for DocumentEditor) to render content with its built-in formatting preservation.

**Pros:**
- Already have TipTap dependency
- Excellent list/heading rendering
- Same editor can view and edit
- Rich styling options

**Cons:**
- Would require converting markdown → TipTap JSON on frontend
- More complex than react-markdown
- Overkill for read-only viewing
- Additional bundle size

---

### Approach C: Enhanced Mammoth HTML Preservation

**Description:** Store mammoth's HTML output instead of converting to markdown, render HTML directly with styled components.

**Pros:**
- Most faithful to original DOCX formatting
- No markdown conversion artifacts
- Handles complex formatting better

**Cons:**
- Requires backend changes to document processor
- Reprocessing of existing documents needed
- HTML sanitization concerns
- Larger storage footprint
- Changes RAG embedding input

---

### Recommendation: Approach A (Paper Container + Prose Classes)

**Rationale:**
1. **Lowest risk**: Frontend-only change, no data migration
2. **Industry standard**: Google Docs, Notion, Adobe Reader all use light document panel in dark UI
3. **Best UX**: Users expect documents to look like documents
4. **Leverages existing tools**: Tailwind Typography plugin already installed
5. **Incremental**: Can add user preference toggle later

**Key implementation considerations:**
1. Add "paper mode" CSS variables to globals.css for document panel
2. Wrap document content in elevated "paper" container with shadow
3. Use `prose prose-lg` classes from @tailwindcss/typography
4. Consider subtle cream/off-white instead of pure white to reduce eye strain
5. Add soft shadow/elevation to create visual "paper floating over dark background"
6. Ensure citation highlights work on light background (update keyframes)

---

## 6) Clarifications Needed

1. **Paper color preference**: Pure white (`#ffffff`) vs warm cream (`#faf9f7`) vs cool off-white (`#f8f9fa`)?
>> lets use #F5F3EF

2. **User toggle**: Should viewers be able to switch between "paper mode" (light document) and "integrated mode" (dark document matching app theme)?
>> sure. If for no other reason than that enables us to just focusing on creating the paper mode net new while (hopefully) leaving the code for the old mode alone for the most part until we perfect paper mode

3. **Scope of paper mode**: Does this apply only to DocumentContentViewer, or also to DocumentCapsule (document list view)?
>> both. its critical to maintain visual consistency in these experiences. 

4. **Header treatment**: Should the document header (filename, download button) also be light, or remain dark as a "toolbar" above the paper?
>> my instinct says remain dark as a toolbar so just the paper itself is lighter (that helps emphasize the "paper feel")

5. **Mobile behavior**: On narrow screens where panels stack, should the document still be light-on-dark, or should the entire view switch?
>> still light on dark, but in mobile view we should never actually show both chat and documents side by side (if thats what we're trying to do now). documents should animate up from the bottom of the screen as a nearly full screen overlay, aut-scrolling to the relevant section of the document as needed. the user should then be able to stay in/scroll in and explore that full screen overlay of the document as much as they want, but with a clear X button on the top right for them to close that document preview window and return to the chat. And when you're in chat mode, again pretty similar to Claude, there should be some little documents icon somewhere in the top right corner of the screen that opens up a document index, which my instincts tell me should also be a fullscreen overlay that slides up from the bottom of the screen (since it will need to integrate naturally and intuitively with the document viewer, which will be using this slide-up-from-the-bottom overlay UI)

6. **Theme interaction**: Current viewer has theme options (nord, warm-reading, etc.). Should paper mode:
   - Replace all themes?
   - Be a separate toggle alongside themes?
   - Themes only affect chat, paper mode only for documents?
>> separate toggle alongside. themes should still apply to everything else on the page that's NOT the document paper itself

---

## 7) Visual Concept (ASCII Mockup)

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Dark Header Bar - Project Name]                    [End Conversation] │
├────────────────────────┬───────────────────────────────────────────────┤
│                        │                                               │
│   CHAT PANEL           │   DOCUMENT PANEL                              │
│   (Dark theme)         │   (Dark background)                           │
│                        │                                               │
│   ┌──────────────┐     │   ┌─────────────────────────────────────┐    │
│   │ User message │     │   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│    │
│   └──────────────┘     │   │░░░░░ PAPER CONTAINER (Light) ░░░░░░░│    │
│                        │   │░░░░░                          ░░░░░░░│    │
│   ┌──────────────┐     │   │░░░░░  # Document Title        ░░░░░░░│    │
│   │ AI response  │     │   │░░░░░                          ░░░░░░░│    │
│   │ with citation│     │   │░░░░░  Section content with    ░░░░░░░│    │
│   │ [DOC:file..]│────────▶│░░░░░  proper formatting:       ░░░░░░░│    │
│   └──────────────┘     │   │░░░░░                          ░░░░░░░│    │
│                        │   │░░░░░  - Bullet point          ░░░░░░░│    │
│                        │   │░░░░░    - Nested item         ░░░░░░░│    │
│                        │   │░░░░░    - Nested item         ░░░░░░░│    │
│                        │   │░░░░░  - Another bullet        ░░░░░░░│    │
│                        │   │░░░░░                          ░░░░░░░│    │
│   [Input field...]     │   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│    │
│                        │   └─────────────────────────────────────┘    │
│                        │         ↑ Shadow creates elevation           │
└────────────────────────┴───────────────────────────────────────────────┘
```

---

## 8) Implementation Phases (if approved)

### Phase 1: Core Paper Mode (MVP)
- Add paper mode CSS variables to globals.css
- Update DocumentContentViewer with paper container
- Integrate Tailwind Typography prose classes
- Fix citation highlight for light background
- Test with existing documents

### Phase 2: Polish & Edge Cases
- Fine-tune typography (line height, margins, fonts)
- Handle code blocks, tables, blockquotes
- Ensure proper nested list rendering
- Test across different document types

### Phase 3: User Preference Toggle (Optional)
- Add "Document Appearance" setting to viewer preferences
- Options: "Paper" (light) vs "Integrated" (dark)
- Persist preference in localStorage
- Update onboarding if needed

---

## 9) Success Criteria

1. Documents render with light background, dark text (paper aesthetic)
2. Clear visual separation between chat (dark) and document (light) panels
3. Nested lists display with proper indentation hierarchy
4. Bullet points render correctly at all nesting levels
5. Headings maintain clear visual hierarchy
6. Citation highlights remain visible and attractive on light background
7. No regression in existing functionality (scroll-to-section, text selection for comments)
8. Performance: No noticeable render delay from styling changes
