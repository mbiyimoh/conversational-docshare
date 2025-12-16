# Task Breakdown: Viewer Citation Navigation System

**Generated:** 2025-12-04
**Source:** specs/feat-viewer-citation-navigation.md
**Total Tasks:** 9
**Phases:** 3

---

## Overview

Build the core recipient/audience viewer experience with resizable split panels, citation click navigation, and highlight animation. When viewers click AI citations `[DOC:filename:section-id]`, the document panel opens, scrolls to the section, and applies a 2.5s yellow glow animation.

**Key Clarification:** Document access flows through share link verification (password/email gate), NOT separate user auth. Viewers don't have auth tokens - they access documents via the share link slug.

---

## Dependency Graph

```
Phase 1: Foundation (can run in parallel)
├── Task 1.1: Install react-resplit ──────────────────────┐
├── Task 1.2: Create public document endpoint (backend) ──┼──┐
└── Task 1.3: Add citation-highlight CSS ─────────────────┘  │
                                                              │
Phase 2: Core Features (depends on Phase 1)                   │
├── Task 2.1: Create documentLookup.ts ←──────────────────────┤
├── Task 2.2: Modify SharePage.tsx (depends on 1.1, 2.1) ←────┤
└── Task 2.3: Modify DocumentViewer.tsx (depends on 1.3) ←────┘

Phase 3: Testing & Polish (depends on Phase 2)
├── Task 3.1: Unit tests for documentLookup
├── Task 3.2: Integration tests for DocumentViewer
└── Task 3.3: E2E tests for citation navigation
```

---

## Phase 1: Foundation

### Task 1.1: Install react-resplit dependency

**Description:** Add react-resplit package for accessible resizable split panels
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2, 1.3

**Technical Requirements:**
- Library: `react-resplit` version ^1.3.2
- Bundle size: ~8KB gzipped
- Features: CSS Grid based, ARIA support, @radix-ui/react-slot dependency

**Implementation Steps:**
1. Navigate to frontend directory
2. Run npm install
3. Verify package.json updated
4. Verify no peer dependency conflicts

**Commands:**
```bash
cd frontend && npm install react-resplit@^1.3.2
```

**Acceptance Criteria:**
- [ ] react-resplit@^1.3.2 in package.json dependencies
- [ ] No npm peer dependency warnings
- [ ] Import works: `import { Resplit } from 'react-resplit'`

---

### Task 1.2: Create public document endpoint for share link access

**Description:** Create backend endpoint to fetch documents via share link slug without requiring auth token. Documents are accessible if the viewer has passed the share link's access gate (password/email verification).
**Size:** Medium
**Priority:** High (BLOCKING - viewers can't see documents without this)
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.3

**Technical Requirements:**
- Endpoint: `GET /api/share/:slug/documents/:documentId`
- No auth token required - access verified via share link slug
- Validates document belongs to the share link's project
- Returns document with outline for viewer display

**File to create:** `backend/src/routes/shareLink.routes.ts` (add route)

**Implementation:**

```typescript
// Add to backend/src/routes/shareLink.routes.ts

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/share/:slug/documents/:documentId
 *
 * Fetch a document via share link - no auth required.
 * Access control: Document must belong to the share link's project.
 * Viewer has already passed access gate (password/email) to reach this point.
 */
router.get('/:slug/documents/:documentId', async (req, res) => {
  try {
    const { slug, documentId } = req.params;

    // 1. Verify share link exists and is active
    const shareLink = await prisma.shareLink.findUnique({
      where: { slug },
      include: { project: true }
    });

    if (!shareLink) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // 2. Check if share link is expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // 3. Verify document belongs to this project
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId: shareLink.projectId
      },
      select: {
        id: true,
        filename: true,
        title: true,
        mimeType: true,
        outline: true,
        status: true,
        createdAt: true
      }
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found or not accessible via this share link'
      });
    }

    // 4. Return document for viewer
    return res.json({
      document: {
        id: document.id,
        filename: document.filename,
        title: document.title || document.filename,
        mimeType: document.mimeType,
        outline: document.outline || [],
        status: document.status
      }
    });

  } catch (error) {
    console.error('Error fetching document via share link:', error);
    return res.status(500).json({ error: 'Failed to fetch document' });
  }
});

export default router;
```

**Also update `shareLink.controller.ts` or wherever routes are registered:**

```typescript
// Ensure the route is mounted
app.use('/api/share', shareLinkRoutes);
```

**Acceptance Criteria:**
- [ ] `GET /api/share/:slug/documents/:documentId` returns 200 with document data
- [ ] Returns 404 if share link doesn't exist
- [ ] Returns 404 if document doesn't belong to project
- [ ] Returns 410 if share link is expired
- [ ] No auth token required - works for anonymous viewers
- [ ] Returns document with outline array for section navigation

**Test with curl:**
```bash
# Should return document data
curl http://localhost:4000/api/share/test-slug/documents/doc-id-here

# Should return 404
curl http://localhost:4000/api/share/invalid-slug/documents/doc-id
```

---

### Task 1.3: Add citation-highlight CSS animation

**Description:** Create CSS keyframes for the 2.5s yellow glow highlight animation when sections are cited
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2

**Technical Requirements:**
- Animation duration: 2.5 seconds (research-backed optimal)
- Color: yellow-100 background with yellow-200 glow
- Must respect `prefers-reduced-motion` for accessibility
- GPU-accelerated (box-shadow, background-color)

**File to create:** `frontend/src/styles/citation-highlight.css`

**Full Implementation:**

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

**Import in main CSS (add to `frontend/src/index.css` or equivalent):**

```css
@import './styles/citation-highlight.css';
```

**Acceptance Criteria:**
- [ ] File created at `frontend/src/styles/citation-highlight.css`
- [ ] `.citation-highlight` class applies 2.5s animation
- [ ] Animation uses GPU-accelerated properties (box-shadow, background-color)
- [ ] `prefers-reduced-motion` shows static highlight instead
- [ ] CSS is imported in main stylesheet

---

## Phase 2: Core Features

### Task 2.1: Create documentLookup.ts utility

**Description:** Build the filename→documentId mapping utility with O(1) lookup using a Map-based cache
**Size:** Medium
**Priority:** High
**Dependencies:** None (but needed by Task 2.2)
**Can run parallel with:** Task 2.2 setup, Task 2.3

**Technical Requirements:**
- Case-insensitive filename matching
- Title fallback matching (AI may cite by title)
- Section validation utility
- Cache cleared on unmount to prevent memory leaks

**File to create:** `frontend/src/lib/documentLookup.ts`

**Full Implementation:**

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

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { projectId: string | null; documentCount: number } {
  return {
    projectId: cache?.projectId || null,
    documentCount: cache?.documents.size || 0
  };
}
```

**Acceptance Criteria:**
- [ ] File created at `frontend/src/lib/documentLookup.ts`
- [ ] `initDocumentLookup()` creates Map with case-insensitive keys
- [ ] `lookupDocument()` returns DocumentInfo or null
- [ ] `lookupDocument('Financial.pdf')` equals `lookupDocument('financial.pdf')`
- [ ] Title lookup works as fallback
- [ ] `validateSection()` checks if section exists in outline
- [ ] `clearDocumentLookup()` properly nulls the cache
- [ ] TypeScript types exported and documented

---

### Task 2.2: Modify SharePage.tsx for resizable panels

**Description:** Replace fixed 50/50 split with react-resplit resizable panels, integrate document lookup, add localStorage persistence
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1 (react-resplit installed), Task 2.1 (documentLookup)

**File to modify:** `frontend/src/pages/SharePage.tsx`

**Technical Requirements:**
- Replace fixed flex layout with Resplit.Root
- Chat panel min-width: 400px
- Document panel min-width: 300px
- Default ratio: 60/40
- Save ratio to localStorage on resize
- Restore ratio from localStorage on load
- Initialize document lookup from project.documents
- Enhanced handleCitationClick with filename→ID resolution

**Implementation - Key Changes:**

```tsx
// Add imports at top of file
import { Resplit } from 'react-resplit';
import {
  initDocumentLookup,
  lookupDocument,
  clearDocumentLookup
} from '../lib/documentLookup';

// Add constants
const STORAGE_KEY = 'viewer-panel-ratio';

// Inside SharePage component, add state:
const [panelRatio, setPanelRatio] = useState(() => {
  if (typeof window === 'undefined') return 0.6;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseFloat(saved) : 0.6;
});

// Initialize document lookup when project loads
useEffect(() => {
  if (project?.documents) {
    initDocumentLookup(
      project.id,
      project.documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        title: doc.title || doc.filename,
        outline: doc.outline || []
      }))
    );
  }

  // Cleanup on unmount
  return () => clearDocumentLookup();
}, [project?.id, project?.documents]);

// Enhanced citation click handler
const handleCitationClick = useCallback((filename: string, sectionId: string) => {
  const docInfo = lookupDocument(filename);

  if (!docInfo) {
    console.warn(`[SharePage] Document not found for citation: ${filename}`);
    // TODO: Show toast notification
    return;
  }

  setSelectedDocumentId(docInfo.id);
  setHighlightSectionId(sectionId);
}, []);

// Save panel ratio on resize
const handlePanelResize = useCallback((sizes: number[]) => {
  const ratio = sizes[0];
  setPanelRatio(ratio);
  localStorage.setItem(STORAGE_KEY, ratio.toString());
}, []);

// Replace the layout JSX:
return (
  <div className="h-screen flex flex-col">
    {/* Access gate or header if needed */}

    <Resplit.Root
      direction="horizontal"
      onResize={handlePanelResize}
      className="flex-1"
    >
      <Resplit.Pane
        initialSize={`${panelRatio * 100}%`}
        minSize="400px"
        className="overflow-hidden"
        data-testid="chat-panel"
      >
        <ChatInterface
          conversationId={conversationId}
          onCitationClick={handleCitationClick}
        />
      </Resplit.Pane>

      <Resplit.Splitter
        className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
        aria-label="Resize panels"
        data-testid="panel-splitter"
      />

      {selectedDocumentId && (
        <Resplit.Pane
          initialSize={`${(1 - panelRatio) * 100}%`}
          minSize="300px"
          className="overflow-hidden"
          data-testid="document-panel"
        >
          <DocumentViewer
            documentId={selectedDocumentId}
            highlightSectionId={highlightSectionId}
            shareSlug={slug} // Pass for public document fetching
            onClose={() => {
              setSelectedDocumentId(null);
              setHighlightSectionId(null);
            }}
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
  </div>
);
```

**Acceptance Criteria:**
- [ ] Fixed layout replaced with Resplit panels
- [ ] Panels resize via drag handle
- [ ] Chat panel min-width 400px enforced
- [ ] Document panel min-width 300px enforced
- [ ] Panel ratio persists to localStorage
- [ ] Panel ratio restored on page load
- [ ] Citation click resolves filename→documentId
- [ ] Missing document shows warning (no crash)
- [ ] `data-testid` attributes added for E2E tests
- [ ] aria-live region announces document changes

---

### Task 2.3: Modify DocumentViewer.tsx for highlight animation

**Description:** Add scroll-to-section with highlight animation, error handling for missing sections, re-highlight on re-click
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3 (CSS animation), Task 1.2 (public endpoint)

**File to modify:** `frontend/src/components/DocumentViewer.tsx`

**Technical Requirements:**
- Fetch document via public share link endpoint
- Scroll to section with `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Apply highlight class after 300ms delay (wait for scroll)
- Re-highlight on repeated clicks (use `highlightKey` state)
- Show warning banner if section not found
- Clear previous highlight before applying new one

**Implementation - Key Changes:**

```tsx
// Update props interface
interface DocumentViewerProps {
  documentId: string;
  highlightSectionId: string | null;
  shareSlug: string; // For public document fetching
  onClose: () => void;
}

// Import the CSS
import '../styles/citation-highlight.css';

export function DocumentViewer({
  documentId,
  highlightSectionId,
  shareSlug,
  onClose
}: DocumentViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState(0);

  // Fetch document via public share link endpoint
  useEffect(() => {
    async function fetchDocument() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/share/${shareSlug}/documents/${documentId}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load document');
        }

        const { document: doc } = await response.json();
        setDocument(doc);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [documentId, shareSlug]);

  // Force re-highlight on repeated clicks to same section
  useEffect(() => {
    if (highlightSectionId) {
      setHighlightKey(prev => prev + 1);
    }
  }, [highlightSectionId]);

  // Scroll and highlight effect
  useEffect(() => {
    if (!highlightSectionId || !document || loading) return;

    const element = window.document.getElementById(`section-${highlightSectionId}`);

    if (!element) {
      console.warn(`Section ${highlightSectionId} not found, scrolling to top`);
      viewerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setError(`Section "${highlightSectionId}" not found in document`);
      return;
    }

    // Clear existing error
    setError(null);

    // Clear any existing highlight
    window.document.querySelectorAll('.citation-highlight')
      .forEach(el => el.classList.remove('citation-highlight'));

    // Scroll to section (centered)
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Apply highlight after scroll completes (~300ms)
    const timeoutId = setTimeout(() => {
      element.classList.add('citation-highlight');
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [highlightSectionId, highlightKey, document, loading]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="document-viewer">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900 truncate">
          {document?.title || document?.filename || 'Document'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded"
          aria-label="Close document viewer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error banner for missing sections */}
      {error && (
        <div className="m-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-yellow-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document outline */}
      <div ref={viewerRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {document?.outline?.map((section) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className={cn(
                "p-3 rounded-md transition-all duration-200",
                "hover:bg-gray-50 cursor-pointer",
                section.level === 1 ? "font-semibold text-gray-900" : "text-gray-700",
              )}
              style={{ marginLeft: `${(section.level - 1) * 16}px` }}
            >
              {section.title}
            </div>
          ))}

          {(!document?.outline || document.outline.length === 0) && (
            <p className="text-gray-500 italic">No sections available</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Document fetched via `/api/share/:slug/documents/:id` endpoint
- [ ] Loading spinner while fetching
- [ ] Section scrolls into view centered on click
- [ ] `.citation-highlight` class applied after 300ms delay
- [ ] Re-clicking same citation re-highlights
- [ ] Missing section shows yellow warning banner
- [ ] Previous highlight cleared before new one applied
- [ ] Close button works
- [ ] `data-testid="document-viewer"` added for E2E tests

---

## Phase 3: Testing & Polish

### Task 3.1: Unit tests for documentLookup.ts

**Description:** Write comprehensive unit tests for the document lookup utility
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.1

**File to create:** `frontend/src/lib/__tests__/documentLookup.test.ts`

**Full Implementation:**

```typescript
import {
  initDocumentLookup,
  lookupDocument,
  validateSection,
  clearDocumentLookup,
  getCacheStats
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

  describe('initDocumentLookup', () => {
    // Purpose: Verify cache is properly initialized with documents
    it('initializes cache with correct document count', () => {
      const stats = getCacheStats();
      expect(stats.projectId).toBe('project-1');
      // 4 entries: 2 filenames + 2 titles (case-insensitive)
      expect(stats.documentCount).toBe(4);
    });
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

    // Purpose: Verify UPPERCASE also works
    it('finds document by uppercase filename', () => {
      const doc = lookupDocument('FINANCIAL.PDF');
      expect(doc?.id).toBe('doc-1');
    });

    // Purpose: Verify title fallback allows AI flexibility in citations
    it('finds document by title', () => {
      const doc = lookupDocument('Financial Projections');
      expect(doc?.id).toBe('doc-1');
    });

    // Purpose: Verify case-insensitive title matching
    it('finds document by case-insensitive title', () => {
      const doc = lookupDocument('financial projections');
      expect(doc?.id).toBe('doc-1');
    });

    // Purpose: Verify graceful handling when document doesn't exist
    it('returns null for non-existent document', () => {
      const doc = lookupDocument('nonexistent.pdf');
      expect(doc).toBeNull();
    });

    // Purpose: Verify lookup fails gracefully before init
    it('returns null and warns if cache not initialized', () => {
      clearDocumentLookup();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const doc = lookupDocument('Financial.pdf');

      expect(doc).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('[documentLookup] Cache not initialized');

      consoleSpy.mockRestore();
    });
  });

  describe('validateSection', () => {
    // Purpose: Verify section validation for citation accuracy
    it('validates existing section', () => {
      const section = validateSection('doc-1', 'section-abc123');
      expect(section?.id).toBe('section-abc123');
      expect(section?.title).toBe('ROI Analysis');
    });

    // Purpose: Verify nested section validation works
    it('validates nested section', () => {
      const section = validateSection('doc-1', 'section-def456');
      expect(section?.title).toBe('Revenue Model');
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

    // Purpose: Verify returns null if cache cleared
    it('returns null if cache not initialized', () => {
      clearDocumentLookup();
      const section = validateSection('doc-1', 'section-abc123');
      expect(section).toBeNull();
    });
  });

  describe('clearDocumentLookup', () => {
    // Purpose: Verify cache is properly cleared between projects
    it('clears cache correctly', () => {
      clearDocumentLookup();

      const stats = getCacheStats();
      expect(stats.projectId).toBeNull();
      expect(stats.documentCount).toBe(0);

      const doc = lookupDocument('Financial.pdf');
      expect(doc).toBeNull();
    });

    // Purpose: Verify can re-initialize after clear
    it('allows re-initialization after clear', () => {
      clearDocumentLookup();
      initDocumentLookup('project-2', mockDocuments);

      const stats = getCacheStats();
      expect(stats.projectId).toBe('project-2');
    });
  });
});
```

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Tests cover: init, lookup by filename, lookup by title, case-insensitivity
- [ ] Tests cover: section validation, cache clearing, edge cases
- [ ] Each test has a purpose comment
- [ ] Tests can fail (not always-pass smoke tests)

---

### Task 3.2: Integration tests for DocumentViewer highlight

**Description:** Write integration tests for the scroll and highlight behavior
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 2.3

**File to create:** `frontend/src/components/__tests__/DocumentViewer.integration.test.tsx`

**Full Implementation:**

```typescript
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentViewer } from '../DocumentViewer';

// Mock fetch for document loading
global.fetch = jest.fn();

const mockDocument = {
  id: 'doc-1',
  filename: 'test.pdf',
  title: 'Test Document',
  outline: [
    { id: 'section-abc', title: 'Introduction', level: 1 },
    { id: 'section-def', title: 'Details', level: 2 },
  ]
};

describe('DocumentViewer integration', () => {
  const mockScrollIntoView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ document: mockDocument })
    });
  });

  // Purpose: Verify document loads and displays sections
  it('loads and displays document sections', async () => {
    render(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId={null}
        shareSlug="test-slug"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });

  // Purpose: Verify scroll-to-section triggers on highlight prop
  it('scrolls to section when highlightSectionId provided', async () => {
    render(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId="section-abc"
        shareSlug="test-slug"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      });
    });
  });

  // Purpose: Verify highlight class is applied after delay
  it('applies highlight class after scroll delay', async () => {
    jest.useFakeTimers();

    render(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId="section-abc"
        shareSlug="test-slug"
        onClose={jest.fn()}
      />
    );

    // Wait for document to load
    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeInTheDocument();
    });

    // Fast-forward past the 300ms delay
    act(() => {
      jest.advanceTimersByTime(350);
    });

    const section = document.getElementById('section-section-abc');
    expect(section?.classList.contains('citation-highlight')).toBe(true);

    jest.useRealTimers();
  });

  // Purpose: Verify missing section shows warning
  it('shows warning for missing section', async () => {
    render(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId="section-nonexistent"
        shareSlug="test-slug"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/not found in document/)).toBeInTheDocument();
    });
  });

  // Purpose: Verify close button calls onClose
  it('calls onClose when close button clicked', async () => {
    const onClose = jest.fn();

    render(
      <DocumentViewer
        documentId="doc-1"
        highlightSectionId={null}
        shareSlug="test-slug"
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('Close document viewer'));
    expect(onClose).toHaveBeenCalled();
  });

  // Purpose: Verify fetch error handling
  it('shows error when document fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Document not found' })
    });

    render(
      <DocumentViewer
        documentId="invalid-doc"
        highlightSectionId={null}
        shareSlug="test-slug"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Document not found')).toBeInTheDocument();
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Tests pass for document loading
- [ ] Tests verify scrollIntoView is called
- [ ] Tests verify highlight class applied after delay
- [ ] Tests verify missing section shows warning
- [ ] Tests verify close button works
- [ ] Tests verify fetch error handling

---

### Task 3.3: E2E tests for citation navigation

**Description:** Write Playwright E2E tests for the complete citation navigation flow
**Size:** Medium
**Priority:** Medium
**Dependencies:** Tasks 2.1, 2.2, 2.3

**File to create:** `e2e/viewer-citation-navigation.spec.ts`

**Full Implementation:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Viewer Citation Navigation', () => {
  // Use test share link - ensure this exists in test data
  const testShareSlug = 'test-share-slug';

  test.beforeEach(async ({ page }) => {
    // Navigate to share link
    await page.goto(`/share/${testShareSlug}`);

    // Complete access gate if needed (password type)
    const passwordInput = page.locator('[name="password"]');
    if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordInput.fill('test-password');
      await page.click('button[type="submit"]');
    }

    // Wait for chat interface to load
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10000 });
  });

  // Purpose: Verify citation click opens document viewer panel
  test('clicking citation opens document viewer', async ({ page }) => {
    // Wait for a message with citations
    await page.waitForSelector('[data-testid="citation-button"]', { timeout: 15000 });

    // Click the first citation
    const citation = page.locator('[data-testid="citation-button"]').first();
    await citation.click();

    // Verify document panel opens
    await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();
  });

  // Purpose: Verify section receives highlight animation class
  test('section receives highlight animation', async ({ page }) => {
    await page.waitForSelector('[data-testid="citation-button"]');

    const citation = page.locator('[data-testid="citation-button"]').first();
    await citation.click();

    // Wait for document to load and highlight to apply
    await page.waitForTimeout(500);

    // Check for highlight class
    const highlightedSection = page.locator('.citation-highlight');
    await expect(highlightedSection).toBeVisible();
  });

  // Purpose: Verify panel is resizable via drag
  test('panels can be resized by dragging splitter', async ({ page }) => {
    // First open document panel
    await page.waitForSelector('[data-testid="citation-button"]');
    await page.locator('[data-testid="citation-button"]').first().click();
    await page.waitForSelector('[data-testid="document-viewer"]');

    // Get initial chat panel width
    const chatPanel = page.locator('[data-testid="chat-panel"]');
    const initialWidth = await chatPanel.evaluate(el => el.getBoundingClientRect().width);

    // Drag the splitter to the left
    const splitter = page.locator('[data-testid="panel-splitter"]');
    await splitter.dragTo(page.locator('body'), {
      targetPosition: { x: 400, y: 300 }
    });

    // Verify width changed
    const newWidth = await chatPanel.evaluate(el => el.getBoundingClientRect().width);
    expect(newWidth).not.toBe(initialWidth);
  });

  // Purpose: Verify panel size persists after reload
  test('panel size persists after page reload', async ({ page }) => {
    // Open document panel
    await page.waitForSelector('[data-testid="citation-button"]');
    await page.locator('[data-testid="citation-button"]').first().click();
    await page.waitForSelector('[data-testid="document-viewer"]');

    // Resize panel
    const splitter = page.locator('[data-testid="panel-splitter"]');
    await splitter.dragTo(page.locator('body'), {
      targetPosition: { x: 500, y: 300 }
    });

    // Get new width
    const chatPanel = page.locator('[data-testid="chat-panel"]');
    const widthBeforeReload = await chatPanel.evaluate(el => el.getBoundingClientRect().width);

    // Reload page
    await page.reload();

    // Re-open document panel
    await page.waitForSelector('[data-testid="citation-button"]');
    await page.locator('[data-testid="citation-button"]').first().click();
    await page.waitForSelector('[data-testid="document-viewer"]');

    // Verify width was restored
    const widthAfterReload = await chatPanel.evaluate(el => el.getBoundingClientRect().width);
    expect(widthAfterReload).toBeCloseTo(widthBeforeReload, -2);
  });

  // Purpose: Verify close button hides document panel
  test('close button hides document viewer', async ({ page }) => {
    await page.waitForSelector('[data-testid="citation-button"]');
    await page.locator('[data-testid="citation-button"]').first().click();

    await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();

    // Click close button
    await page.click('[aria-label="Close document viewer"]');

    // Verify panel closed
    await expect(page.locator('[data-testid="document-viewer"]')).not.toBeVisible();
  });

  // Purpose: Verify re-clicking same citation re-highlights
  test('re-clicking citation re-highlights section', async ({ page }) => {
    await page.waitForSelector('[data-testid="citation-button"]');
    const citation = page.locator('[data-testid="citation-button"]').first();

    // First click
    await citation.click();
    await page.waitForTimeout(500);

    // Scroll away from highlighted section
    const viewer = page.locator('[data-testid="document-viewer"] > div').last();
    await viewer.evaluate(el => el.scrollTop = 1000);
    await page.waitForTimeout(100);

    // Click same citation again
    await citation.click();
    await page.waitForTimeout(500);

    // Should be highlighted again (scrolled back into view)
    const highlightedSection = page.locator('.citation-highlight');
    await expect(highlightedSection).toBeVisible();
  });
});
```

**Acceptance Criteria:**
- [ ] All E2E tests pass
- [ ] Tests cover: citation click, highlight, resize, persistence, close
- [ ] Tests use real share link with test data
- [ ] Tests are stable (no flakiness)

---

## Summary

| Phase | Tasks | Size | Can Parallelize |
|-------|-------|------|-----------------|
| Phase 1: Foundation | 3 | 2 Small, 1 Medium | All 3 can run in parallel |
| Phase 2: Core Features | 3 | 1 Medium, 2 Large | 2.1 parallel with setup, then 2.2 and 2.3 |
| Phase 3: Testing | 3 | 2 Small, 1 Medium | All 3 can run in parallel |

**Critical Path:** Task 1.2 (backend endpoint) → Task 2.3 (DocumentViewer) → Task 3.3 (E2E)

**Parallel Opportunities:**
- Phase 1 tasks can all run simultaneously
- Phase 2: Task 2.1 can start while 2.2/2.3 wait for deps
- Phase 3 tasks can all run simultaneously after Phase 2

**Risk Areas:**
1. Backend endpoint (Task 1.2) - New route pattern, test thoroughly
2. react-resplit integration (Task 2.2) - First use of this library
3. Section ID format mismatch - Verify backend generates IDs that AI can cite
