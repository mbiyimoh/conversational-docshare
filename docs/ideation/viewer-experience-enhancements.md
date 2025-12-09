# Viewer Experience Enhancements

**Slug:** viewer-experience-enhancements
**Author:** Claude Code
**Date:** 2025-12-04
**Branch:** feat/viewer-experience-enhancements
**Related:**
- `docs/ideation/viewer-citation-navigation-system.md` (prior work)
- `specs/receiver-experience-scaffold.md` (Phase 7-9 spec)
- `frontend/src/pages/SharePage.tsx` (main viewer page)
- `frontend/src/components/DocumentViewer.tsx` (current outline-only viewer)

---

## 1) Intent & Assumptions

**Task brief:** Implement three viewer experience enhancements:
1. Document panel open by default showing "Document Capsule" index with all documents, plus navigation to return to index view
2. AI agent proactively starts conversation with personalized intro and document summary
3. Full document content viewing (currently only showing outline, not actual text content)

**Assumptions:**
- DocumentChunk model already contains extracted text content (confirmed - `content` field exists)
- react-markdown is already installed (confirmed - version 10.1.0 in package.json)
- Server-side conversation creation already exists (createConversation in chatService.ts)
- react-resplit is already installed for panel management (version 1.3.2)
- No PDF.js is currently installed (not in dependencies)

**Out of scope:**
- Native PDF rendering (Phase 2 enhancement - use extracted text for now)
- Mobile-responsive single-panel view (tablet/desktop first)
- Resizable panel widths (fixed ratios for now)
- Advanced welcome message AI generation (use template-based approach)
- Document thumbnails in capsule view

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `specs/receiver-experience-scaffold.md` | Lines 83-110 specify AI welcome message pattern with personalization. Line 264-279 shows 3-panel layout wireframe with file explorer sidebar. |
| `frontend/src/pages/SharePage.tsx` | Uses react-resplit. Document panel only shows when `selectedDocumentId` is set. Currently starts with no panel visible. |
| `frontend/src/components/DocumentViewer.tsx` | Shows outline only, with note "Full document preview requires PDF.js integration". Has highlight/scroll functionality. |
| `backend/prisma/schema.prisma` | DocumentChunk model (lines 161-186) has `content`, `sectionId`, `sectionTitle` - all needed for text rendering. |
| `frontend/package.json` | react-markdown@10.1.0 already installed. No PDF.js libraries. lucide-react and framer-motion NOT installed. |
| `backend/src/services/chatService.ts` | `createConversation()` exists but doesn't generate welcome message. |

---

## 3) Codebase Map

### Primary Components/Modules

| File | Role | Changes Needed |
|------|------|----------------|
| `frontend/src/pages/SharePage.tsx` | Viewer entry, layout | Add capsule mode, default panel open |
| `frontend/src/components/DocumentViewer.tsx` | Single doc view | Refactor to show content, not just outline |
| NEW: `frontend/src/components/DocumentCapsule.tsx` | Index/overview | Create new component |
| `backend/src/services/chatService.ts` | Conversation logic | Add welcome message generation |
| `backend/src/controllers/shareLink.controller.ts` | Access endpoint | Include welcome in access response |

### Shared Dependencies
- **State:** React useState/useCallback (no Zustand)
- **Layout:** react-resplit (already installed)
- **Rendering:** react-markdown (already installed)
- **Icons:** lucide-react (already installed)
- **API:** api.getShareLinkBySlug, api.createConversation

### Data Flow

**Current (broken):**
```
Viewer lands → Empty chat panel (no welcome) → User must initiate
                      ↓
              No document panel shown until citation clicked
```

**Target:**
```
Viewer lands → Document Capsule panel visible (index view)
                      ↓
              Welcome message appears in chat (auto-generated)
                      ↓
              User asks question → AI responds with citation
                      ↓
              Panel switches to single document view (with back button)
                      ↓
              User clicks "Back to All Documents" → Returns to capsule
```

### Potential Blast Radius

**SAFE to modify:**
- `frontend/src/pages/SharePage.tsx`
- `frontend/src/components/DocumentViewer.tsx`
- `backend/src/controllers/shareLink.controller.ts`

**CAUTION (also used by Testing Dojo):**
- `backend/src/services/chatService.ts` - Add welcome logic carefully

---

## 4) Root Cause Analysis

**N/A - Feature enhancement, not bug fix.**

However, answering user's question about outline clicking:
> "Am I supposed to be able to see the detailed copy/content when I click on one of the sections in the outline?"

**Answer:** Currently NO - clicking a section in the outline only highlights it visually. The actual text content is stored in DocumentChunk.content but is NOT being rendered. The note at the bottom of DocumentViewer.tsx explains this is pending PDF.js integration, but we can render the extracted text directly without PDF.js.

---

## 5) Research Findings

### Feature 1: Document Capsule Index Panel

**Best Approach: Persistent Panel with Mode Toggle**

| Pattern | Source | Recommendation |
|---------|--------|----------------|
| Persistent right panel | Perplexity AI | Panel always visible, content switches |
| Breadcrumb navigation | Notion | "All Documents" → "document.pdf" |
| Collapsible hierarchy | VS Code Outline | Show document outlines in index |

**Implementation:**
- State: `panelMode: 'capsule' | 'document'`
- Default: `panelMode = 'capsule'` (shows index)
- On citation click: Switch to `document` mode
- Header shows: "📚 All Documents" or "← Back | 📄 filename.pdf"

**UI Wireframe:**
```
┌─────────────────────────────┬──────────────────────────────┐
│      Chat Panel (60%)       │    Document Panel (40%)      │
│                             │  ┌─────────────────────────┐ │
│  [AI Welcome Message]       │  │ 📚 Document Capsule     │ │
│                             │  ├─────────────────────────┤ │
│  [User Question]            │  │ 📄 Business Plan.pdf    │ │
│                             │  │    Executive Summary    │ │
│  [AI Response with          │  │    Market Analysis      │ │
│   citation button]          │  │    Financial Projections│ │
│                             │  │                         │ │
│                             │  │ 📄 IP Framework.docx    │ │
│                             │  │    Overview             │ │
│  [Input: Ask something...]  │  │    Implementation       │ │
│                             │  └─────────────────────────┘ │
└─────────────────────────────┴──────────────────────────────┘
```

### Feature 2: AI Proactive Welcome Message

**Best Approach: Server-Side Generation on Conversation Creation**

**Rationale:**
1. Guaranteed delivery (message exists before frontend loads)
2. Persists in database (survives page refresh)
3. Single API response includes welcome + conversation
4. No race conditions with user typing

**Welcome Message Template:**
```markdown
**Hello! I'm your AI assistant for this document collection.**

I have access to the following materials:

- 📄 **Business Plan.pdf**: Comprehensive business strategy and financial projections
- 📄 **IP Framework.docx**: Intellectual property protection framework

**I can help you:**
✓ Find specific information across all documents
✓ Summarize key points and sections
✓ Answer detailed questions with citations

What would you like to explore first?
```

**Personalization Sources:**
- Tone from communication context layer
- Document summaries from Document model
- Emphasis areas from content context layer

### Feature 3: Full Document Content Viewing

**Best Approach: Render Extracted Text Chunks (Phase 1)**

**Why NOT PDF.js for Phase 1:**
- Adds ~500KB to bundle
- Content already extracted in DocumentChunk
- Text is faster to load, searchable, mobile-friendly
- PDF.js can be Phase 2 enhancement

**Implementation:**
1. Create API endpoint: `GET /api/documents/:id/chunks`
2. Render chunks using react-markdown
3. Group by sectionId with section titles as headers
4. Apply styling with Tailwind prose classes
5. Auto-scroll to section on citation click

**Chunk Rendering Example:**
```tsx
{chunks.map(chunk => (
  <section id={chunk.sectionId} className="mb-8">
    {chunk.sectionTitle && (
      <h2 className="text-xl font-semibold text-blue-700">
        {chunk.sectionTitle}
      </h2>
    )}
    <ReactMarkdown className="prose">
      {chunk.content}
    </ReactMarkdown>
  </section>
))}
```

---

## 6) Clarifications Needed

### Clarification 1: Welcome Message Personalization Level

**Options:**
- **A) Template-based (Recommended):** Static template with document list filled in. Fast, predictable, no LLM call needed.
- **B) LLM-generated:** Call OpenAI to generate custom welcome based on context layers. Slower (~1-2s), more personalized.
- **C) Hybrid:** Template for structure, LLM for one personalized sentence.

**Recommendation:** Start with **Option A** (template-based) for speed. The welcome message pattern shown in the scaffold spec doesn't require dynamic generation.

>> I want it to be "templated", but a crucial part of the functionality is having the agent kick the convo off with a summary of the docs, which, unless I'm missing something / unless we create it and "can" it ahead of time, will require an LLM (and even canning it ahead of time will require an LLM, just at an earlier step)



### Clarification 2: Capsule View Content

**What should the capsule index show for each document?**
- **A) Just title and outline sections** (clickable to navigate)
- **B) Title + AI-generated summary + outline** (more context, requires Document.summary field)
- **C) Title + word count + page count** (metadata only)

**Recommendation:** Option **B** if Document.summary exists, otherwise **A**.

>> Go with your recommendation, that's solid



### Clarification 3: Panel Mode Persistence

**When should panel return to capsule view?**
- **A) Never automatically** - user must click "All Documents" to return
- **B) After 30 seconds of no interaction** - auto-return to capsule
- **C) Only on new conversation** - stay in document mode during session

**Recommendation:** Option **A** - let user control navigation explicitly.

>> option A for sure



### Clarification 4: Welcome Message Timing

**When should welcome appear?**
- **A) Before access gate** - user sees welcome before entering password
- **B) After access granted, before any user input** (Recommended)
- **C) Only after user sends first message** - triggered as response

**Recommendation:** Option **B** - creates immediate engagement after authentication succeeds.

>> option B

---

## 7) Recommended Implementation Plan

### Phase 1: Core Features (This Iteration)

**Task 1: Document Capsule Component**
- Create `DocumentCapsule.tsx` showing all project documents
- Display: title, summary (if available), collapsible outline
- Clicking document title → switches to single document view
- Clicking outline section → switches to document at that section

**Task 2: Panel Mode Management in SharePage**
- Add state: `panelMode: 'capsule' | 'document'`
- Default to `'capsule'` (panel visible immediately)
- Update `handleCitationClick` to set mode to `'document'`
- Add header with breadcrumb/back button

**Task 3: Document Content Viewer**
- Refactor DocumentViewer to fetch and render DocumentChunk content
- Create backend endpoint `GET /api/share/:slug/documents/:id/chunks`
- Use react-markdown for content rendering
- Keep existing scroll-to-section and highlight animation

**Task 4: Welcome Message**
- Add `generateWelcomeMessage(projectId)` to chatService
- Call during `createConversation` or new dedicated endpoint
- Return welcome message in access verification response
- Frontend displays as first message in chat

### Phase 2: Enhancements (Future)

- Native PDF rendering with react-pdf (toggle option)
- Document thumbnails in capsule view
- Animated transitions between panel modes
- Welcome message A/B testing
- Mobile-responsive collapsible panel

---

## 8) Technical Specifications

### New Components

```typescript
// DocumentCapsule.tsx
interface DocumentCapsuleProps {
  documents: Array<{
    id: string
    title: string
    filename: string
    summary?: string
    outline?: Array<{ id: string; title: string; level: number }>
  }>
  onDocumentClick: (documentId: string) => void
  onSectionClick: (documentId: string, sectionId: string) => void
}

// DocumentContentViewer.tsx (refactored from DocumentViewer)
interface DocumentContentViewerProps {
  documentId: string
  shareSlug: string
  highlightSectionId?: string
  onBack: () => void
}
```

### API Endpoints

```typescript
// GET /api/share/:slug/documents/:documentId/chunks
// Returns document chunks for rendering
{
  chunks: Array<{
    id: string
    content: string
    sectionId: string | null
    sectionTitle: string | null
    chunkIndex: number
  }>
}

// POST /api/share/:slug/access (modified)
// Now includes welcome message in response
{
  accessGranted: true,
  projectId: string,
  conversation: { id: string },
  welcomeMessage: string,  // NEW
  documents: Array<Document>  // NEW - for capsule
}
```

### State Management (SharePage)

```typescript
// Add to SharePage
const [panelMode, setPanelMode] = useState<'capsule' | 'document'>('capsule')
const [documents, setDocuments] = useState<Document[]>([])

// On access granted
setDocuments(response.documents)
setMessages([{ role: 'assistant', content: response.welcomeMessage }])

// On citation click
const handleCitationClick = (filename: string, sectionId: string) => {
  const doc = documents.find(d => d.filename === filename)
  if (doc) {
    setSelectedDocumentId(doc.id)
    setHighlightSectionId(sectionId)
    setPanelMode('document')  // Switch from capsule to document
  }
}

// On back click
const handleBackToCapsule = () => {
  setPanelMode('capsule')
  setSelectedDocumentId(null)
}
```

---

## 9) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DocumentChunk content poorly formatted | Medium | Medium | Add markdown cleanup in renderer |
| Welcome message feels generic | Low | Low | Use context layers for personalization |
| Panel switching jarring | Low | Low | Add subtle fade transition |
| Large documents slow to load | Low | Medium | Paginate chunks, lazy load |

---

## 10) Dependencies to Install

**Required:**
```bash
# For syntax highlighting in code blocks (optional but nice)
npm install react-syntax-highlighter
npm install -D @types/react-syntax-highlighter

# For GFM tables support (already have react-markdown)
npm install remark-gfm
```

**Already Installed:**
- react-markdown@10.1.0
- react-resplit@1.3.2
- lucide-react@0.469.0

---

## 11) Success Criteria

1. **Capsule panel visible by default** - Viewer lands on page, sees document list immediately
2. **Easy navigation** - Clear "Back to All Documents" button when viewing single doc
3. **Welcome message appears** - First message in chat is AI greeting (no user input required)
4. **Document content renders** - Clicking section shows actual text, not just outline title
5. **Citations still work** - Clicking citation in chat opens document at correct section

---

*Ready for spec creation and implementation upon clarification of items in Section 6.*
