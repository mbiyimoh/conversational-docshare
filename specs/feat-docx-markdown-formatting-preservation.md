# DOCX Markdown Formatting Preservation

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-19
**Related:** [Ideation Document](../docs/ideation/preserve-document-markdown-formatting.md)

---

## 1. Overview

Replace the current DOCX text extraction method (`mammoth.extractRawText()`) with a formatting-preserving pipeline using `mammoth.convertToHtml()` + Turndown HTML-to-Markdown conversion. This ensures that document structure (headings, lists, bold/italic, nested sub-lists) is preserved when displayed in the DocumentContentViewer.

Additionally, implement automatic reprocessing of all existing DOCX documents on server startup to apply the new formatting pipeline retroactively.

---

## 2. Background/Problem Statement

### Current Behavior
The backend `documentProcessor.ts` uses `mammoth.extractRawText()` to extract content from DOCX files. This method strips all formatting:

```typescript
// Current implementation (loses formatting)
const result = await mammoth.extractRawText({ buffer })
const text = result.value  // Plain text only
```

### Observed Issues
- Bulleted lists appear as plain text: `• Item one` instead of proper `<ul><li>`
- Headings render as regular paragraphs without hierarchy
- Bold and italic text loses emphasis
- Nested sub-lists flatten to single-level text
- The frontend `DocumentContentViewer` already renders markdown correctly via ReactMarkdown - the backend is the bottleneck

### Root Cause
`mammoth.extractRawText()` is designed for RAG/search use cases where formatting is irrelevant. For document viewing, we need `mammoth.convertToHtml()` which preserves semantic structure.

---

## 3. Goals

- Preserve DOCX formatting (headings, lists, bold/italic, links) through the extraction pipeline
- Convert DOCX to well-structured Markdown that renders correctly in DocumentContentViewer
- Automatically reprocess all existing DOCX documents without user intervention
- Maintain backward compatibility with non-DOCX documents
- Keep processing time under 500ms per document

---

## 4. Non-Goals

- PDF formatting enhancement (deferred to future spec - requires AI)
- Table rendering (skip tables, focus on lists/headings)
- Manual "reprocess" button in UI (automatic only)
- OCR for scanned documents
- Complex nested table structures

---

## 5. Technical Dependencies

### New Dependencies

| Package | Version | Purpose | Dev? |
|---------|---------|---------|------|
| `turndown` | ^7.2.0 | HTML to Markdown conversion | No |
| `@types/turndown` | ^5.0.5 | TypeScript definitions | Yes |

**Installation:**
```bash
cd backend && npm install turndown && npm install -D @types/turndown
```

### Existing Dependencies (No Changes)

| Package | Version | Current Usage |
|---------|---------|---------------|
| `mammoth` | ^1.8.0 | DOCX processing (method change only) |
| `@prisma/client` | ^5.20.0 | Database access for reprocessing |

### Documentation References

- [Mammoth.js Documentation](https://github.com/mwilliamson/mammoth.js)
- [Turndown Documentation](https://github.com/mixmark-io/turndown)
- [Turndown Options Reference](https://github.com/mixmark-io/turndown#options)

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCX Processing Pipeline                  │
└─────────────────────────────────────────────────────────────┘

CURRENT FLOW (loses formatting):
┌──────────┐     ┌────────────────────┐     ┌──────────────┐
│  DOCX    │ ──► │ mammoth.extract    │ ──► │  Plain Text  │
│  File    │     │   RawText()        │     │  (no format) │
└──────────┘     └────────────────────┘     └──────────────┘

NEW FLOW (preserves formatting):
┌──────────┐     ┌────────────────────┐     ┌──────────────┐     ┌──────────────┐
│  DOCX    │ ──► │ mammoth.convert    │ ──► │    HTML      │ ──► │  Markdown    │
│  File    │     │   ToHtml()         │     │  (semantic)  │     │  (rendered)  │
└──────────┘     └────────────────────┘     └────────┬─────┘     └──────────────┘
                                                     │
                                            ┌────────▼─────────┐
                                            │ Turndown.turn    │
                                            │   down(html)     │
                                            └──────────────────┘
```

### 6.2 File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/services/documentProcessor.ts` | Modify | Update `processDOCX()` to use HTML→Markdown pipeline |
| `backend/src/services/documentReprocessor.ts` | New | Auto-reprocessing service for existing documents |
| `backend/src/index.ts` | Modify | Call reprocessor on startup |
| `backend/package.json` | Modify | Add turndown dependency |

### 6.3 Implementation Details

#### 6.3.1 Turndown Configuration

Create a reusable Turndown instance with consistent settings:

```typescript
// backend/src/services/documentProcessor.ts

import TurndownService from 'turndown'

/**
 * Turndown configuration optimized for document viewing
 * - ATX headings (# style) for clear hierarchy
 * - Dash bullets for consistent list rendering
 * - Fenced code blocks for any code content
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',           // # Heading style
    bulletListMarker: '-',          // - for unordered lists
    codeBlockStyle: 'fenced',       // ```code``` style
    emDelimiter: '*',               // *italic*
    strongDelimiter: '**',          // **bold**
  })

  // Skip table conversion (per user decision - focus on lists/headings)
  turndown.remove('table')

  // Clean up excessive whitespace in output
  turndown.addRule('cleanParagraphs', {
    filter: 'p',
    replacement: (content) => {
      const trimmed = content.trim()
      return trimmed ? `\n\n${trimmed}\n\n` : ''
    }
  })

  return turndown
}

// Singleton instance
let turndownInstance: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = createTurndownService()
  }
  return turndownInstance
}
```

#### 6.3.2 Updated processDOCX Function

```typescript
// backend/src/services/documentProcessor.ts

/**
 * Process DOCX document with formatting preservation
 *
 * Pipeline: DOCX → HTML (mammoth) → Markdown (turndown) → ProcessedDocument
 */
export async function processDOCX(filePath: string): Promise<ProcessedDocument> {
  try {
    // Dynamic import - only loads mammoth when processing DOCX
    const mammoth = (await import('mammoth')).default

    const buffer = await fs.readFile(filePath)

    // NEW: Convert to HTML instead of raw text
    const htmlResult = await mammoth.convertToHtml({ buffer })
    const html = htmlResult.value

    // Convert HTML to Markdown
    const turndown = getTurndown()
    let markdown = turndown.turndown(html)

    // Clean up markdown (excessive newlines, trailing whitespace)
    markdown = cleanupMarkdown(markdown)

    // Extract title from first heading or first line
    const title = extractTitle(markdown)

    // Extract outline from markdown headings
    const outline = extractOutlineFromMarkdown(markdown)

    return {
      title,
      outline,
      fullText: markdown,  // Now contains formatted markdown
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
    }
  } catch (error) {
    throw new FileProcessingError(`Failed to process DOCX: ${(error as Error).message}`)
  }
}

/**
 * Clean up markdown output from Turndown
 * - Remove excessive blank lines (3+ → 2)
 * - Trim trailing whitespace from lines
 * - Ensure single newline at end
 */
function cleanupMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, '\n\n')           // Max 2 consecutive newlines
    .replace(/[ \t]+$/gm, '')              // Trim trailing whitespace per line
    .replace(/^\s+/, '')                   // Trim leading whitespace
    .replace(/\s+$/, '\n')                 // Single trailing newline
}

/**
 * Extract title from markdown content
 * Priority: First H1 heading > First line > "Untitled"
 */
function extractTitle(markdown: string): string {
  // Try to find first H1 heading
  const h1Match = markdown.match(/^#\s+(.+)$/m)
  if (h1Match) {
    return h1Match[1].trim().substring(0, 100)
  }

  // Fall back to first non-empty line
  const firstLine = markdown.split('\n').find(line => line.trim())
  if (firstLine) {
    return firstLine.trim().substring(0, 100)
  }

  return 'Untitled'
}

/**
 * Extract document outline from markdown headings
 * Parses # heading syntax and builds section hierarchy
 */
function extractOutlineFromMarkdown(markdown: string): DocumentSection[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const outline: DocumentSection[] = []
  let match
  let position = 0

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length  // Number of # characters
    const headingTitle = match[2].trim()

    outline.push({
      id: generateSectionId(headingTitle, level, position),
      title: headingTitle,
      level,
      position: position++,
    })
  }

  // Fall back to existing text-based outline detection if no markdown headings
  if (outline.length === 0) {
    return extractOutlineFromText(markdown)
  }

  return outline
}
```

#### 6.3.3 Document Reprocessor Service

```typescript
// backend/src/services/documentReprocessor.ts

import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import { processDOCX } from './documentProcessor'
import { chunkDocumentBySection } from './documentChunker'

const prisma = new PrismaClient()

interface ReprocessingStats {
  total: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{ documentId: string; error: string }>
}

/**
 * Reprocess all existing DOCX documents with the new formatting pipeline
 *
 * This runs in the background on server startup and:
 * 1. Finds all completed DOCX documents
 * 2. Re-extracts content with formatting preservation
 * 3. Updates document metadata and chunks
 * 4. Logs progress for monitoring
 */
export async function reprocessAllDocxDocuments(): Promise<ReprocessingStats> {
  const stats: ReprocessingStats = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  console.log('[Reprocessor] Starting DOCX reprocessing...')

  // Find all DOCX documents that have been processed
  const docxDocuments = await prisma.document.findMany({
    where: {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      status: 'completed',
    },
    select: {
      id: true,
      filePath: true,
      filename: true,
    },
  })

  stats.total = docxDocuments.length
  console.log(`[Reprocessor] Found ${stats.total} DOCX documents to reprocess`)

  if (stats.total === 0) {
    console.log('[Reprocessor] No documents to reprocess')
    return stats
  }

  // Process each document
  for (const doc of docxDocuments) {
    try {
      // Check if file still exists
      try {
        await fs.access(doc.filePath)
      } catch {
        console.warn(`[Reprocessor] File not found, skipping: ${doc.filename}`)
        stats.skipped++
        continue
      }

      // Reprocess with new pipeline
      const processed = await processDOCX(doc.filePath)
      const chunks = chunkDocumentBySection(processed)

      // Update document and chunks in transaction
      await prisma.$transaction(async (tx) => {
        // Delete existing chunks
        await tx.documentChunk.deleteMany({
          where: { documentId: doc.id },
        })

        // Update document metadata
        await tx.document.update({
          where: { id: doc.id },
          data: {
            title: processed.title,
            outline: processed.outline,
            wordCount: processed.wordCount,
            processedAt: new Date(),
          },
        })

        // Create new chunks with formatting
        if (chunks.length > 0) {
          await tx.documentChunk.createMany({
            data: chunks.map((chunk) => ({
              documentId: doc.id,
              content: chunk.content,
              sectionId: chunk.sectionId,
              sectionTitle: chunk.sectionTitle,
              chunkIndex: chunk.chunkIndex,
              startChar: chunk.startChar,
              endChar: chunk.endChar,
            })),
          })
        }
      })

      stats.successful++
      console.log(`[Reprocessor] ✓ Reprocessed: ${doc.filename} (${chunks.length} chunks)`)
    } catch (error) {
      stats.failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      stats.errors.push({ documentId: doc.id, error: errorMessage })
      console.error(`[Reprocessor] ✗ Failed: ${doc.filename} - ${errorMessage}`)
    }
  }

  // Summary
  console.log('[Reprocessor] Reprocessing complete:')
  console.log(`  - Total: ${stats.total}`)
  console.log(`  - Successful: ${stats.successful}`)
  console.log(`  - Failed: ${stats.failed}`)
  console.log(`  - Skipped: ${stats.skipped}`)

  return stats
}

/**
 * Check if reprocessing has already been done
 * Uses a simple marker in the database or filesystem
 */
async function hasAlreadyReprocessed(): Promise<boolean> {
  // Check for a marker document or setting
  // For simplicity, we'll use an environment variable to control this
  return process.env.DOCX_REPROCESSING_COMPLETE === 'true'
}

/**
 * Run reprocessing if needed (idempotent)
 */
export async function runReprocessingIfNeeded(): Promise<void> {
  if (await hasAlreadyReprocessed()) {
    console.log('[Reprocessor] Reprocessing already completed, skipping')
    return
  }

  // Run in background (don't block server startup)
  setImmediate(async () => {
    try {
      await reprocessAllDocxDocuments()
      // Note: In production, you'd set DOCX_REPROCESSING_COMPLETE=true after success
      console.log('[Reprocessor] Set DOCX_REPROCESSING_COMPLETE=true to skip on next restart')
    } catch (error) {
      console.error('[Reprocessor] Fatal error during reprocessing:', error)
    }
  })
}
```

#### 6.3.4 Server Startup Integration

```typescript
// backend/src/index.ts

import { runReprocessingIfNeeded } from './services/documentReprocessor'

// ... existing imports and setup ...

app.listen(PORT, () => {
  console.warn(`Server running on port ${PORT}`)
  console.warn(`API available at http://localhost:${PORT}/api`)
  console.warn(`Health check at http://localhost:${PORT}/health`)

  // Start processing queue for new documents
  startProcessingQueue(15000)
  console.warn('Document processing queue ENABLED')

  // NEW: Reprocess existing DOCX documents with formatting preservation
  runReprocessingIfNeeded()
})
```

### 6.4 Data Flow

```
New Document Upload:
┌─────────┐    ┌──────────────┐    ┌───────────────────┐    ┌─────────────┐
│ Upload  │───►│ Create Doc   │───►│ Processing Queue  │───►│ processDOCX │
│ Request │    │ (pending)    │    │ (15s interval)    │    │ (new flow)  │
└─────────┘    └──────────────┘    └───────────────────┘    └──────┬──────┘
                                                                    │
                     ┌──────────────────────────────────────────────┘
                     ▼
              ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
              │ Markdown    │───►│ Chunk by    │───►│ Store Chunks     │
              │ with format │    │ Section     │    │ (completed)      │
              └─────────────┘    └─────────────┘    └──────────────────┘

Existing Document Reprocessing:
┌─────────────┐    ┌──────────────────┐    ┌───────────────┐    ┌─────────────┐
│ Server      │───►│ runReprocessing  │───►│ Find all DOCX │───►│ For each:   │
│ Startup     │    │ IfNeeded()       │    │ (completed)   │    │ processDOCX │
└─────────────┘    └──────────────────┘    └───────────────┘    └──────┬──────┘
                                                                        │
                     ┌──────────────────────────────────────────────────┘
                     ▼
              ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
              │ Delete old  │───►│ Update doc  │───►│ Create new       │
              │ chunks      │    │ metadata    │    │ chunks (txn)     │
              └─────────────┘    └─────────────┘    └──────────────────┘
```

---

## 7. User Experience

### Before (Current)

```
Document: "Project Plan.docx"
Contains: Heading, bulleted list, bold text

Displayed as:
PROJECT PLAN
• Phase 1 - Research
• Phase 2 - Development
Important: This is critical

(All plain text, no formatting)
```

### After (New)

```
Document: "Project Plan.docx"
Contains: Heading, bulleted list, bold text

Displayed as:
# PROJECT PLAN

- Phase 1 - Research
- Phase 2 - Development

**Important:** This is critical

(Proper markdown rendering with visual hierarchy)
```

### User Journey

1. **New Documents**: User uploads DOCX → Processes automatically → Displays with formatting
2. **Existing Documents**: On next server restart → Auto-reprocessed in background → Next view shows formatting
3. **No Action Required**: Users don't need to do anything - formatting "just works"

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// backend/src/services/__tests__/documentProcessor.test.ts

describe('processDOCX', () => {
  describe('formatting preservation', () => {
    it('should preserve heading hierarchy from DOCX', async () => {
      // Purpose: Verify H1, H2, H3 headings in DOCX become proper markdown
      const result = await processDOCX(testFixtures.docxWithHeadings)

      expect(result.fullText).toMatch(/^# Heading 1/m)
      expect(result.fullText).toMatch(/^## Heading 2/m)
      expect(result.fullText).toMatch(/^### Heading 3/m)
    })

    it('should convert bulleted lists to markdown list syntax', async () => {
      // Purpose: Verify Word bullet points become - items
      const result = await processDOCX(testFixtures.docxWithBullets)

      expect(result.fullText).toMatch(/^- Item one/m)
      expect(result.fullText).toMatch(/^- Item two/m)
    })

    it('should preserve nested list indentation', async () => {
      // Purpose: Verify sub-bullets maintain hierarchy
      const result = await processDOCX(testFixtures.docxWithNestedLists)

      // Nested items should have additional indentation
      expect(result.fullText).toMatch(/^- Parent item/m)
      expect(result.fullText).toMatch(/^\s+- Child item/m)
    })

    it('should convert bold and italic text', async () => {
      // Purpose: Verify text emphasis is preserved
      const result = await processDOCX(testFixtures.docxWithFormatting)

      expect(result.fullText).toContain('**bold text**')
      expect(result.fullText).toContain('*italic text*')
    })

    it('should extract outline from markdown headings', async () => {
      // Purpose: Verify document navigation still works
      const result = await processDOCX(testFixtures.docxWithHeadings)

      expect(result.outline).toHaveLength(3)
      expect(result.outline[0]).toMatchObject({
        title: 'Heading 1',
        level: 1,
      })
    })
  })

  describe('edge cases', () => {
    it('should handle DOCX with no formatting gracefully', async () => {
      // Purpose: Plain text DOCX should still work
      const result = await processDOCX(testFixtures.docxPlainText)

      expect(result.fullText).toBeTruthy()
      expect(result.title).toBeTruthy()
    })

    it('should skip tables without breaking', async () => {
      // Purpose: Tables are out of scope but shouldn't crash
      const result = await processDOCX(testFixtures.docxWithTable)

      expect(result.fullText).toBeTruthy()
      // Table content may be missing, but document processes
    })

    it('should clean up excessive whitespace', async () => {
      // Purpose: Turndown can produce extra newlines
      const result = await processDOCX(testFixtures.docxWithSpacing)

      expect(result.fullText).not.toMatch(/\n{4,}/)  // No 4+ consecutive newlines
    })
  })
})
```

### 8.2 Integration Tests

```typescript
// backend/src/services/__tests__/documentReprocessor.test.ts

describe('reprocessAllDocxDocuments', () => {
  beforeEach(async () => {
    // Seed test database with DOCX documents (old format)
    await seedTestDocuments()
  })

  it('should reprocess all completed DOCX documents', async () => {
    // Purpose: Verify bulk reprocessing works end-to-end
    const stats = await reprocessAllDocxDocuments()

    expect(stats.successful).toBeGreaterThan(0)
    expect(stats.failed).toBe(0)
  })

  it('should update chunks with formatted content', async () => {
    // Purpose: Verify chunks contain markdown after reprocessing
    await reprocessAllDocxDocuments()

    const chunks = await prisma.documentChunk.findMany({
      where: { document: { mimeType: { contains: 'word' } } },
    })

    // At least some chunks should have markdown formatting
    const hasFormatting = chunks.some(c =>
      c.content.includes('- ') || c.content.includes('# ')
    )
    expect(hasFormatting).toBe(true)
  })

  it('should skip documents with missing files', async () => {
    // Purpose: Missing files shouldn't crash the reprocessor
    // Setup: Create document record with non-existent filePath
    await createDocumentWithMissingFile()

    const stats = await reprocessAllDocxDocuments()

    expect(stats.skipped).toBeGreaterThan(0)
    expect(stats.failed).toBe(0)
  })

  it('should not affect non-DOCX documents', async () => {
    // Purpose: PDF/Markdown documents unchanged
    const pdfBefore = await getDocumentChunks('test-pdf-id')

    await reprocessAllDocxDocuments()

    const pdfAfter = await getDocumentChunks('test-pdf-id')
    expect(pdfAfter).toEqual(pdfBefore)
  })
})
```

### 8.3 Manual Testing Checklist

- [ ] Upload DOCX with bulleted list → Verify bullets render correctly
- [ ] Upload DOCX with numbered list → Verify numbers render correctly
- [ ] Upload DOCX with headings → Verify heading hierarchy visible
- [ ] Upload DOCX with bold/italic → Verify emphasis renders
- [ ] Upload DOCX with nested lists → Verify indentation preserved
- [ ] Restart server → Verify existing documents reprocess (check logs)
- [ ] View reprocessed document → Verify formatting appears
- [ ] Upload PDF → Verify unchanged behavior (plain text)

---

## 9. Performance Considerations

### Processing Time Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| DOCX extraction (new pipeline) | <500ms | Per document |
| Reprocessing batch | ~1 doc/sec | Background process |
| No blocking of uploads | N/A | Reprocessing is async |

### Memory Usage

- Mammoth HTML output is typically 2-3x raw text size
- Turndown conversion is in-memory but streaming-friendly
- Child process isolation (development) prevents OOM in main thread
- Worker pool (production) limits concurrent processing to 2 threads

### Optimization Notes

- Turndown instance is singleton (created once, reused)
- Dynamic imports ensure mammoth only loads when needed
- Reprocessing uses `setImmediate()` to not block event loop
- Transaction batching for chunk updates

---

## 10. Security Considerations

### Input Validation

- DOCX files already validated by existing upload pipeline
- Mammoth sanitizes HTML output (no script injection)
- Turndown output is plain markdown (no executable content)

### File System Access

- Reprocessor only accesses files in configured upload directory
- File existence checked before processing (no path traversal)
- Graceful handling of missing files (skip, don't crash)

### Database Operations

- All updates wrapped in transactions
- Chunks deleted before insert (prevents duplicates)
- Failed documents don't corrupt existing data

---

## 11. Documentation Updates

### Developer Guide Updates

Add to `CLAUDE.md` or developer documentation:

```markdown
## Document Processing Pipeline

### DOCX Formatting Preservation

DOCX documents are processed using a two-stage pipeline:
1. `mammoth.convertToHtml()` - Extracts semantic HTML from DOCX
2. `Turndown.turndown()` - Converts HTML to clean Markdown

This preserves:
- Heading hierarchy (H1-H6)
- Bulleted and numbered lists (including nested)
- Bold and italic text
- Links

Tables are intentionally skipped (out of scope).

### Automatic Reprocessing

On server startup, existing DOCX documents are automatically reprocessed
to apply formatting improvements. Set `DOCX_REPROCESSING_COMPLETE=true`
after successful migration to skip on subsequent restarts.
```

---

## 12. Implementation Phases

### Phase 1: Core Pipeline (MVP)

**Deliverables:**
- Install `turndown` dependency
- Update `processDOCX()` with HTML→Markdown pipeline
- Add `cleanupMarkdown()` helper
- Add `extractOutlineFromMarkdown()` helper
- Update tests

**Files Changed:**
- `backend/package.json`
- `backend/src/services/documentProcessor.ts`
- `backend/src/services/__tests__/documentProcessor.test.ts`

### Phase 2: Reprocessing Service

**Deliverables:**
- Create `documentReprocessor.ts` service
- Add startup integration in `index.ts`
- Add reprocessing tests

**Files Changed:**
- `backend/src/services/documentReprocessor.ts` (new)
- `backend/src/index.ts`
- `backend/src/services/__tests__/documentReprocessor.test.ts` (new)

### Phase 3: Validation & Polish

**Deliverables:**
- End-to-end testing with real DOCX files
- Performance validation (<500ms target)
- Logging improvements
- Documentation updates

---

## 13. Rollback Strategy

If issues arise after deployment:

1. **Immediate Rollback:**
   - Revert `processDOCX()` to use `extractRawText()`
   - Documents will process without formatting (existing behavior)

2. **Data Recovery:**
   - Reprocessed documents can be re-reprocessed
   - Original DOCX files are preserved on disk
   - No data loss possible (only chunk content changes)

3. **Prevention:**
   - Set `DOCX_REPROCESSING_COMPLETE=true` before restarting
   - This skips reprocessing and preserves current state

---

## 14. Open Questions

1. **Embedding Regeneration:** Should we regenerate vector embeddings for reprocessed chunks?
   - Current assumption: No (formatting doesn't significantly change semantic meaning)
   - Risk: Embedding quality may vary with markdown vs plain text
   - **Implementation note:** Add a code comment documenting this decision for future reference

2. **Progress Notification:** Should users see a notification when their documents are reprocessed?
   - Current assumption: No (silent background process)
   - Alternative: Add status indicator in dashboard

3. **Turndown Customization:** Should we add custom rules for specific Word styles?
   - Current assumption: Default rules are sufficient
   - Future: May need custom handlers for specific clients' documents

---

## 15. References

### External Documentation
- [Mammoth.js GitHub](https://github.com/mwilliamson/mammoth.js)
- [Turndown GitHub](https://github.com/mixmark-io/turndown)
- [Turndown Options](https://github.com/mixmark-io/turndown#options)

### Internal Documentation
- [Ideation Document](../docs/ideation/preserve-document-markdown-formatting.md)
- [Typography Improvements](../docs/ideation/improve-text-readability-chat-document-viewer.md)

### Related Patterns
- `backend/src/services/documentProcessor.ts` - Existing document processing
- `backend/src/services/documentChunker.ts` - Chunking strategy
- `backend/src/services/processingQueue.ts` - Queue architecture

---

## 16. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| DOCX formatting accuracy | 90%+ documents render with proper headings/lists | Manual review of sample documents |
| Processing time | <500ms per DOCX | Logging timestamps |
| Reprocessing success rate | 95%+ existing documents | Reprocessor stats output |
| Zero regression | PDF/Markdown unchanged | Automated tests |
| User satisfaction | No complaints about formatting | Support ticket volume |

---

## 17. Appendix: Test Fixtures

Create test DOCX files in `backend/src/services/__tests__/fixtures/`:

```
fixtures/
├── docx-with-headings.docx      # H1, H2, H3 headings
├── docx-with-bullets.docx       # Simple bulleted list
├── docx-with-nested-lists.docx  # Multi-level bullets
├── docx-with-formatting.docx    # Bold, italic, underline
├── docx-with-table.docx         # Table (should skip)
├── docx-plain-text.docx         # No formatting
└── docx-with-spacing.docx       # Excessive whitespace
```

**Creating Test Fixtures:**
- **Manual approach:** Create in Microsoft Word or Google Docs (export as .docx)
- **Programmatic approach:** Use `docx` npm package to generate fixtures in a setup script
- **Recommended:** Manual creation is simpler for 7 files and ensures realistic document structure

These fixtures ensure comprehensive test coverage across formatting variations.
