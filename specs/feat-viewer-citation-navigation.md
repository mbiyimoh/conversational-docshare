# Viewer Experience: Citation Navigation System

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-04
**Related Issues:** Phases 7-8 of platform journey
**Related Specs:** `receiver-experience-scaffold.md`, `docs/ideation/viewer-citation-navigation-system.md`

---

## Overview

Build the core recipient/audience experience for Phases 7-8, focusing on an IDE-inspired split-panel layout with real-time citation navigation. When the AI references documents with `[DOC:filename:section-id]` markers, viewers can click to open the referenced document and auto-scroll to the cited section with a highlight animation.

**Key Innovation:** Transform static document viewing into an interactive, AI-guided exploration experience where citations act as navigation waypoints.

---

## Background/Problem Statement

### Current State

The viewer experience has foundational elements in place:
- **Citation parsing** already works (`documentReferences.ts`)
- **ChatMessage** renders citations as clickable buttons
- **SharePage** has basic split-panel layout with state management
- **DocumentViewer** shows document outlines with basic scroll-to-section

### Gaps

1. **Fixed panel layout** - No resizing capability, users can't adjust chat vs. document space
2. **No highlight animation** - Section highlighting is instant/static, no visual feedback
3. **Filename→ID mismatch** - Citations use filenames but API uses document IDs
4. **Edge case handling** - No graceful handling of missing sections or deleted documents
5. **Accessibility gaps** - Missing ARIA labels, keyboard navigation incomplete

### Why This Matters

- **Board members** (primary persona) are time-constrained and need efficient navigation
- **Citation visibility** directly correlates with viewer engagement and trust
- **Professional feel** - IDE-style resizable panels signal a sophisticated tool

---

## Goals

- Implement user-resizable split-panel layout (chat left, document right)
- Add smooth highlight animation when citations are clicked (2.5s yellow glow fade)
- Build filename→documentId lookup utility for O(1) citation resolution
- Handle edge cases gracefully (missing sections, deleted documents)
- Meet WCAG AA accessibility requirements for citations
- Store user's panel size preference in localStorage

---

## Non-Goals

- Phase 9 conversion modal (account creation) - separate spec
- File explorer sidebar for multi-document navigation - future enhancement
- Mobile-responsive single-panel view - tablet/desktop first
- PDF.js integration for full document rendering - outline navigation sufficient for MVP
- Modifying shared backend services (`chatService.ts`, `embeddingService.ts`, `schema.prisma`)
- Document tabs for multiple open documents - replace behavior chosen instead

---

## Technical Dependencies

### External Libraries

| Library | Version | Size | Purpose |
|---------|---------|------|---------|
| `react-resplit` | ^1.3.2 | 8KB gzipped | Accessible resizable split panels (CSS Grid, ARIA support) |

**Installation:**
```bash
cd frontend && npm install react-resplit
```

### Existing Infrastructure

| Component | Location | Usage |
|-----------|----------|-------|
| `documentReferences.ts` | `frontend/src/lib/` | Citation parsing (regex, split into parts) |
| `ChatMessage.tsx` | `frontend/src/components/` | Citation button rendering |
| `DocumentViewer.tsx` | `frontend/src/components/` | Document outline display |
| `SharePage.tsx` | `frontend/src/pages/` | Viewer layout, state management |

### Constraints (Parallel Workstream)

**DO NOT MODIFY** - These files are owned by Testing Dojo workstream:
- `backend/src/services/chatService.ts`
- `backend/src/services/embeddingService.ts`
- `backend/prisma/schema.prisma`

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SharePage.tsx                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Resplit.Root (react-resplit)                    │   │
│  │  ┌──────────────────────┐ ┌────────────────────────────────┐│   │
│  │  │   Resplit.Pane       │ │   Resplit.Pane                ││   │
│  │  │   (Chat Panel)       │ │   (Document Panel)            ││   │
│  │  │   min: 400px         │ │   min: 300px                  ││   │
│  │  │                      │ │                                ││   │
│  │  │  ┌────────────────┐  │ │  ┌─────────────────────────┐  ││   │
│  │  │  │ ChatInterface  │  │ │  │    DocumentViewer       │  ││   │
│  │  │  │ ┌────────────┐ │  │ │  │ ┌─────────────────────┐ │  ││   │
│  │  │  │ │ChatMessage │ │  │ │  │ │  Section Outline    │ │  ││   │
│  │  │  │ │ [Citation] │◄┼──┼─┼──┼─┤  with Highlight     │ │  ││   │
│  │  │  │ └────────────┘ │  │ │  │ │  Animation          │ │  ││   │
│  │  │  └────────────────┘  │ │  │ └─────────────────────┘ │  ││   │
│  │  └──────────────────────┘ └──┼─────────────────────────┘  ││   │
│  │                        ▲     │                             │   │
│  │                   Resplit.Splitter (draggable)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

Data Flow:
1. User clicks citation in ChatMessage
2. onCitationClick(filename, sectionId) bubbles up
3. documentLookup.ts resolves filename → documentId
4. SharePage sets selectedDocumentId + highlightSectionId
5. DocumentViewer scrolls and applies highlight animation
```

### File Organization

**New Files:**
```
frontend/src/
├── lib/
│   └── documentLookup.ts      # Filename → ID mapping utility
├── styles/
│   └── citation-highlight.css  # Highlight animation keyframes
```

**Modified Files:**
```
frontend/
├── src/pages/SharePage.tsx           # Resizable panels, lookup integration
├── src/components/DocumentViewer.tsx # Highlight animation, scroll behavior
├── tailwind.config.js                # Animation keyframes (alternative approach)
```

### Component Specifications

#### 1. SharePage.tsx - Resizable Panel Layout

**Current Implementation:**
```tsx
// Fixed 50/50 split
<div className="flex-1 flex">
  <div className="w-1/2">
    <ChatInterface ... />
  </div>
  {selectedDocumentId && (
    <div className="w-1/2">
      <DocumentViewer ... />
    </div>
  )}
</div>
```

**New Implementation:**
```tsx
import { Resplit } from 'react-resplit';

const STORAGE_KEY = 'viewer-panel-ratio';

export default function SharePage() {
  // Load saved ratio or default to 60/40
  const [panelRatio, setPanelRatio] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : 0.6;
  });

  // Document lookup cache
  const [documentMap, setDocumentMap] = useState<Record<string, string>>({});

  // Initialize document lookup on project load
  useEffect(() => {
    if (project?.documents) {
      const map = project.documents.reduce((acc, doc) => {
        acc[doc.filename] = doc.id;
        acc[doc.filename.toLowerCase()] = doc.id; // Case-insensitive
        return acc;
      }, {} as Record<string, string>);
      setDocumentMap(map);
    }
  }, [project?.documents]);

  // Enhanced citation click with filename resolution
  const handleCitationClick = useCallback((filename: string, sectionId: string) => {
    const documentId = documentMap[filename] || documentMap[filename.toLowerCase()];

    if (!documentId) {
      console.warn(`Document not found: ${filename}`);
      // Show toast or inline warning
      return;
    }

    setSelectedDocumentId(documentId);
    setHighlightSectionId(sectionId);
  }, [documentMap]);

  // Save panel ratio on change
  const handlePanelResize = useCallback((sizes: number[]) => {
    const ratio = sizes[0];
    setPanelRatio(ratio);
    localStorage.setItem(STORAGE_KEY, ratio.toString());
  }, []);

  return (
    <Resplit.Root
      direction="horizontal"
      onResize={handlePanelResize}
      className="h-screen"
    >
      <Resplit.Pane
        initialSize={`${panelRatio * 100}%`}
        minSize="400px"
        className="overflow-hidden"
      >
        <ChatInterface
          conversationId={conversationId}
          onCitationClick={handleCitationClick}
        />
      </Resplit.Pane>

      <Resplit.Splitter
        className="w-1 bg-gray-200 hover:bg-blue-400
                   cursor-col-resize transition-colors"
        aria-label="Resize panels"
      />

      {selectedDocumentId && (
        <Resplit.Pane
          initialSize={`${(1 - panelRatio) * 100}%`}
          minSize="300px"
          className="overflow-hidden"
        >
          <DocumentViewer
            documentId={selectedDocumentId}
            highlightSectionId={highlightSectionId}
            onClose={() => setSelectedDocumentId(null)}
          />

          {/* Accessibility: Announce document changes */}
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {selectedDocumentId && `Opened document, section ${highlightSectionId}`}
          </div>
        </Resplit.Pane>
      )}
    </Resplit.Root>
  );
}
```

#### 2. DocumentViewer.tsx - Highlight Animation

**Scroll + Highlight Coordination:**
```tsx
interface DocumentViewerProps {
  documentId: string;
  highlightSectionId: string | null;
  onClose: () => void;
}

export function DocumentViewer({
  documentId,
  highlightSectionId,
  onClose
}: DocumentViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState(0); // Force re-highlight

  // Re-highlight on re-click (even same section)
  useEffect(() => {
    if (highlightSectionId) {
      setHighlightKey(prev => prev + 1);
    }
  }, [highlightSectionId]);

  // Scroll and highlight effect
  useEffect(() => {
    if (!highlightSectionId || !document) return;

    const element = document.getElementById(`section-${highlightSectionId}`);

    if (!element) {
      console.warn(`Section ${highlightSectionId} not found, scrolling to top`);
      viewerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setError(`Section "${highlightSectionId}" not found in document`);
      return;
    }

    // Clear any existing highlight
    document.querySelectorAll('.citation-highlight')
      .forEach(el => el.classList.remove('citation-highlight'));

    // Scroll to section
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Apply highlight after scroll completes
    const timeoutId = setTimeout(() => {
      element.classList.add('citation-highlight');
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [highlightSectionId, highlightKey, document]);

  // ... rest of component

  return (
    <div ref={viewerRef} className="h-full overflow-y-auto p-4">
      {/* Error banner for missing sections */}
      {error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200
                        rounded-md text-yellow-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document outline */}
      <div className="space-y-2">
        {document?.outline.map((section) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className={cn(
              "p-3 rounded-md transition-all duration-200",
              "hover:bg-gray-50 cursor-pointer",
              section.level === 1 ? "font-semibold" : "",
              section.level > 1 ? `ml-${(section.level - 1) * 4}` : ""
            )}
            style={{ marginLeft: `${(section.level - 1) * 16}px` }}
          >
            {section.title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3. Citation Highlight CSS Animation

**File: `frontend/src/styles/citation-highlight.css`**
```css
/**
 * Citation Highlight Animation
 *
 * Applied when user clicks a citation to scroll to a document section.
 * Uses CSS-only @keyframes for GPU-accelerated performance.
 * Duration: 2.5 seconds (research shows optimal for noticing without annoyance)
 */

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
  border-radius: 0.375rem; /* rounded-md */
}

/* Accessibility: Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .citation-highlight {
    animation: none;
    background-color: rgb(254 249 195); /* Static yellow background */
    border-left: 4px solid rgb(234 179 8); /* yellow-500 accent */
  }
}
```

**Alternative: Tailwind Config Approach**

Add to `tailwind.config.js`:
```js
module.exports = {
  theme: {
    extend: {
      animation: {
        'citation-glow': 'citation-glow 2.5s ease-out forwards',
      },
      keyframes: {
        'citation-glow': {
          '0%': {
            backgroundColor: 'rgb(254 249 195)',
            boxShadow: '0 0 0 4px rgb(254 240 138)'
          },
          '70%': {
            backgroundColor: 'rgb(254 249 195)',
            boxShadow: '0 0 0 4px rgb(254 240 138)'
          },
          '100%': {
            backgroundColor: 'transparent',
            boxShadow: 'none'
          },
        },
      },
    },
  },
}
```

#### 4. Document Lookup Utility

**File: `frontend/src/lib/documentLookup.ts`**
```typescript
/**
 * Document Lookup Utility
 *
 * Maps filenames from AI citations to document IDs.
 * Citations use human-readable filenames (e.g., "financial.pdf")
 * but the API requires document IDs (e.g., "clx123abc").
 *
 * Features:
 * - Case-insensitive matching
 * - Title fallback matching
 * - Caches documents per project
 */

export interface DocumentInfo {
  id: string;
  filename: string;
  title: string;
  outline: Array<{
    id: string;
    title: string;
    level: number;
  }>;
}

interface DocumentLookupCache {
  projectId: string;
  documents: Map<string, DocumentInfo>;
  lastUpdated: number;
}

let cache: DocumentLookupCache | null = null;

/**
 * Initialize the document lookup cache for a project.
 * Call this when the viewer accesses a share link.
 */
export function initDocumentLookup(
  projectId: string,
  documents: DocumentInfo[]
): void {
  const docMap = new Map<string, DocumentInfo>();

  for (const doc of documents) {
    // Map by filename (case-insensitive)
    docMap.set(doc.filename.toLowerCase(), doc);

    // Also map by title for flexibility
    if (doc.title) {
      docMap.set(doc.title.toLowerCase(), doc);
    }
  }

  cache = {
    projectId,
    documents: docMap,
    lastUpdated: Date.now(),
  };
}

/**
 * Look up a document by filename or title.
 * Returns null if not found.
 */
export function lookupDocument(
  filenameOrTitle: string
): DocumentInfo | null {
  if (!cache) {
    console.warn('[documentLookup] Cache not initialized');
    return null;
  }

  const key = filenameOrTitle.toLowerCase();
  return cache.documents.get(key) || null;
}

/**
 * Check if a section exists in a document.
 * Returns the section info if found, null otherwise.
 */
export function validateSection(
  documentId: string,
  sectionId: string
): { id: string; title: string } | null {
  if (!cache) return null;

  // Find document by ID
  for (const doc of cache.documents.values()) {
    if (doc.id === documentId) {
      const section = doc.outline.find(s => s.id === sectionId);
      return section ? { id: section.id, title: section.title } : null;
    }
  }

  return null;
}

/**
 * Clear the cache (call on project switch or unmount)
 */
export function clearDocumentLookup(): void {
  cache = null;
}
```

### Edge Case Handling

| Scenario | Detection | User Feedback | Technical Handling |
|----------|-----------|---------------|-------------------|
| **Section not found** | `getElementById` returns null | Yellow warning banner: "Section not found" | Scroll to document top, log warning |
| **Document not found** | `lookupDocument` returns null | Toast: "Document unavailable" | Don't open viewer panel, log error |
| **Invalid citation format** | Regex fails in `documentReferences.ts` | Render as plain text | Already handled by existing parser |
| **Re-click same citation** | Track via `highlightKey` state | Re-scroll and re-highlight | Increment key to force useEffect |
| **Multiple quick clicks** | useEffect cleanup | Cancel previous animation | Clear timeout on cleanup |

### Data Flow Sequence

```
User clicks citation in ChatMessage
         │
         ▼
ChatMessage.onCitationClick(filename, sectionId)
         │
         ▼
ChatInterface.onCitationClick (passthrough)
         │
         ▼
SharePage.handleCitationClick(filename, sectionId)
         │
         ├── lookupDocument(filename) → documentId
         │         │
         │         └── (if null) → Show error toast, return
         │
         ├── setSelectedDocumentId(documentId)
         │
         └── setHighlightSectionId(sectionId)
                   │
                   ▼
           DocumentViewer receives new props
                   │
                   ├── Fetch document if needed
                   │
                   ├── Find section element by ID
                   │         │
                   │         └── (if null) → Show warning, scroll top
                   │
                   ├── scrollIntoView({ behavior: 'smooth', block: 'center' })
                   │
                   └── setTimeout(300ms) → Add 'citation-highlight' class
                               │
                               ▼
                     Animation plays (2.5s)
                               │
                               ▼
                     Animation ends, highlight fades
```

---

## User Experience

### Interaction Flow

1. **Viewer receives share link** → Opens in browser
2. **Access gate** → Provides password/email if required
3. **Chat loads** → AI sends welcome message
4. **Viewer asks question** → AI responds with document citations
5. **Viewer clicks citation** → Document panel opens (if closed) or scrolls to section
6. **Yellow highlight appears** → 2.5s glow animation draws attention
7. **Viewer reads section** → Can resize panels for comfortable reading
8. **Viewer returns to chat** → Ask follow-up questions

### Panel Resizing UX

- **Drag handle** - 4px wide divider between panels
- **Visual feedback** - Handle turns blue on hover
- **Cursor** - Changes to `col-resize` on hover
- **Persistence** - Ratio saved to localStorage, restored on return visit
- **Constraints** - Chat min 400px, Document min 300px (prevents crushing either panel)

### Accessibility Features

| Feature | Implementation |
|---------|----------------|
| Citation buttons | `role="button"`, `aria-label="View [filename], section [title]"` |
| Document switch | `aria-live="polite"` region announces changes |
| Panel resize | Splitter has `aria-label="Resize panels"` |
| Keyboard nav | Tab to citations, Enter to activate |
| Reduced motion | Static yellow highlight instead of animation |

---

## Testing Strategy

### Unit Tests

**File: `frontend/src/lib/__tests__/documentLookup.test.ts`**
```typescript
import {
  initDocumentLookup,
  lookupDocument,
  validateSection,
  clearDocumentLookup
} from '../documentLookup';

describe('documentLookup', () => {
  const mockDocuments = [
    {
      id: 'doc-1',
      filename: 'Financial.pdf',
      title: 'Financial Projections',
      outline: [
        { id: 'section-abc123', title: 'ROI Analysis', level: 1 },
        { id: 'section-def456', title: 'Revenue Model', level: 2 },
      ]
    },
    {
      id: 'doc-2',
      filename: 'market-analysis.docx',
      title: 'Market Analysis',
      outline: [{ id: 'section-ghi789', title: 'Competitors', level: 1 }]
    }
  ];

  beforeEach(() => {
    clearDocumentLookup();
    initDocumentLookup('project-1', mockDocuments);
  });

  afterEach(() => {
    clearDocumentLookup();
  });

  describe('lookupDocument', () => {
    // Purpose: Verify exact filename matching works
    it('finds document by exact filename', () => {
      const doc = lookupDocument('Financial.pdf');
      expect(doc?.id).toBe('doc-1');
    });

    // Purpose: Verify case-insensitive matching handles user input variations
    it('finds document by case-insensitive filename', () => {
      const doc = lookupDocument('financial.pdf');
      expect(doc?.id).toBe('doc-1');
    });

    // Purpose: Verify title fallback allows AI flexibility in citations
    it('finds document by title', () => {
      const doc = lookupDocument('Financial Projections');
      expect(doc?.id).toBe('doc-1');
    });

    // Purpose: Verify graceful handling when document doesn't exist
    it('returns null for non-existent document', () => {
      const doc = lookupDocument('nonexistent.pdf');
      expect(doc).toBeNull();
    });
  });

  describe('validateSection', () => {
    // Purpose: Verify section validation for citation accuracy
    it('validates existing section', () => {
      const section = validateSection('doc-1', 'section-abc123');
      expect(section?.title).toBe('ROI Analysis');
    });

    // Purpose: Verify handling of invalid section references
    it('returns null for non-existent section', () => {
      const section = validateSection('doc-1', 'section-invalid');
      expect(section).toBeNull();
    });

    // Purpose: Verify handling of invalid document ID
    it('returns null for non-existent document', () => {
      const section = validateSection('doc-invalid', 'section-abc123');
      expect(section).toBeNull();
    });
  });

  describe('cache management', () => {
    // Purpose: Verify cache is properly cleared between projects
    it('clears cache correctly', () => {
      clearDocumentLookup();
      const doc = lookupDocument('Financial.pdf');
      expect(doc).toBeNull();
    });
  });
});
```

### Integration Tests

**File: `frontend/src/components/__tests__/DocumentViewer.integration.test.tsx`**
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { DocumentViewer } from '../DocumentViewer';

// Purpose: Verify scroll-to-section triggers on highlight prop change
describe('DocumentViewer highlight integration', () => {
  const mockScrollIntoView = jest.fn();

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
  });

  // Purpose: Verify highlight animation is applied after scroll delay
  it('applies highlight class after scroll delay', async () => {
    const { rerender } = render(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId={null}
        onClose={jest.fn()}
      />
    );

    // Simulate citation click
    rerender(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId="section-abc123"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      const section = document.getElementById('section-section-abc123');
      expect(section?.classList.contains('citation-highlight')).toBe(true);
    }, { timeout: 500 });
  });

  // Purpose: Verify re-click behavior triggers re-highlight
  it('re-highlights on repeated citation click', async () => {
    // ... test implementation
  });
});
```

### E2E Tests (Playwright)

**File: `e2e/viewer-citation-navigation.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Viewer Citation Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to share link
    await page.goto('/share/test-share-slug');
    // Complete access gate if needed
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');
  });

  // Purpose: Verify end-to-end citation click opens document panel
  test('clicking citation opens document viewer', async ({ page }) => {
    // Wait for chat to load
    await page.waitForSelector('[data-testid="chat-message"]');

    // Find and click a citation
    const citation = page.locator('[data-testid="citation-button"]').first();
    await citation.click();

    // Verify document panel opens
    await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();
  });

  // Purpose: Verify highlight animation plays on citation click
  test('section receives highlight animation', async ({ page }) => {
    const citation = page.locator('[data-testid="citation-button"]').first();
    await citation.click();

    // Check for highlight class
    const section = page.locator('.citation-highlight');
    await expect(section).toBeVisible();

    // Verify animation completes (class should remain after animation)
    await page.waitForTimeout(3000);
    await expect(section).not.toHaveClass(/citation-highlight/);
  });

  // Purpose: Verify panel resize persists across page reload
  test('panel size persists after resize', async ({ page }) => {
    // Drag splitter to resize
    const splitter = page.locator('[data-testid="panel-splitter"]');
    await splitter.dragTo(page.locator('body'), { targetPosition: { x: 500, y: 300 } });

    // Reload page
    await page.reload();

    // Verify ratio was restored (check computed width)
    const chatPanel = page.locator('[data-testid="chat-panel"]');
    const width = await chatPanel.evaluate(el => el.getBoundingClientRect().width);
    expect(width).toBeCloseTo(500, -2); // Within 100px
  });
});
```

### Testing Checklist

- [ ] Citation click opens document panel
- [ ] Correct document loads (filename→ID mapping)
- [ ] Scroll to section works
- [ ] Highlight animation plays
- [ ] Re-click re-highlights
- [ ] Missing section shows warning
- [ ] Panel resize works
- [ ] Panel ratio persists in localStorage
- [ ] Keyboard navigation works
- [ ] Screen reader announces document changes
- [ ] Reduced motion preference respected

---

## Performance Considerations

### Bundle Impact

| Addition | Size | Mitigation |
|----------|------|------------|
| `react-resplit` | ~8KB gzipped | Acceptable for UX value |
| CSS animation | ~500 bytes | Minimal |
| Document lookup | ~1KB | Caches in memory |

### Runtime Performance

| Operation | Concern | Mitigation |
|-----------|---------|------------|
| Document lookup | O(1) after initialization | HashMap-based cache |
| Scroll animation | Browser native | `scrollIntoView` is hardware-accelerated |
| Highlight animation | GPU-accelerated | CSS transforms, not JavaScript |
| Panel resize | Potential layout thrash | CSS Grid, no JS measurement |

### Memory

- Document cache cleared on unmount (`clearDocumentLookup()`)
- Single document loaded at a time (replace behavior, not tabs)
- Outline data only, not full document content

---

## Security Considerations

### Input Validation

- **Filename sanitization**: Already handled by existing `documentReferences.ts` regex
- **Section ID validation**: Hash-based IDs (`section-{hex}`) are inherently safe
- **localStorage**: Only stores numeric ratio, no sensitive data

### Access Control

- Document access requires valid share link verification
- Backend validates document belongs to share link's project
- No direct document ID enumeration possible

---

## Documentation Updates

### Files to Update

1. **`developer-guides/Phase-1-Architecture-Overview.md`**
   - Add section on citation navigation system
   - Document the filename→ID lookup pattern

2. **`CLAUDE.md`**
   - Add react-resplit to tech stack
   - Document citation highlight pattern

3. **Component JSDoc**
   - Document `documentLookup.ts` exports
   - Add usage examples

---

## Implementation Phases

### Phase 1: Core Citation Navigation (MVP)

**Scope:**
1. Install `react-resplit` dependency
2. Create `documentLookup.ts` utility
3. Add `citation-highlight.css` styles
4. Modify `SharePage.tsx` for resizable panels
5. Modify `DocumentViewer.tsx` for highlight animation

**Deliverables:**
- Resizable split panels with persistence
- Working citation click → scroll → highlight flow
- Basic error handling for missing sections

### Phase 2: Polish & Edge Cases

**Scope:**
1. Add warning UI for missing sections
2. Implement toast notifications for errors
3. Add accessibility improvements (ARIA labels, announcements)
4. Write comprehensive tests

**Deliverables:**
- Complete error handling
- WCAG AA compliance
- Full test coverage

### Phase 3: (Future - Out of Scope)

- Document tabs for multiple open documents
- File explorer sidebar
- Mobile responsive single-panel view
- PDF.js integration for full document rendering

---

## Open Questions

1. **Section ID Generation Verification**: Need to confirm the backend's `generateSectionId()` output matches what the AI cites. Current format: `section-{16-char-hex}`. This affects citation accuracy.

2. **Public Document Endpoint**: Current `/api/documents/:id` requires auth. Viewers use share links without auth tokens. Either need:
   - New public endpoint: `GET /api/share/:slug/documents/:id`
   - Or proxy through share link verification

3. **Width-Adaptive Content**: When panels resize, should content reflow? Current outline is simple text, but future PDF rendering would need responsive handling.

---

## References

### Internal Documentation

- [Ideation Document](../docs/ideation/viewer-citation-navigation-system.md) - Research findings
- [Receiver Experience Scaffold](./receiver-experience-scaffold.md) - Phase 7-9 requirements
- [Phase 1 Architecture Overview](../developer-guides/Phase-1-Architecture-Overview.md)

### External Resources

- [react-resplit Documentation](https://github.com/KenanYusuf/react-resplit)
- [MDN: scrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
- [WCAG 2.1 Animation Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [Nielsen Norman: Highlighting](https://www.nngroup.com/articles/highlighting/)

### Design Patterns Referenced

- Perplexity AI - Inline citation footnotes
- VS Code - Resizable panel layouts
- Notion - Document reference chips
- Legal document systems (Lexis/Westlaw) - Section-level citations
