# Task Breakdown: DOCX Markdown Formatting Preservation

**Generated:** 2025-12-19
**Source:** specs/feat-docx-markdown-formatting-preservation.md

---

## Overview

Replace DOCX text extraction with a formatting-preserving pipeline using `mammoth.convertToHtml()` + Turndown HTML-to-Markdown conversion. Auto-reprocess existing documents on server startup.

**Total Tasks:** 8
**Phases:** 3
**Parallel Opportunities:** Tasks 1.1-1.2 can run in parallel

---

## Phase 1: Foundation & Dependencies

### Task 1.1: Install Turndown Dependencies

**Description:** Add turndown and @types/turndown packages to backend
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (must be first)

**Implementation Steps:**
```bash
cd backend
npm install turndown
npm install -D @types/turndown
```

**Verification:**
```bash
# Verify installation
cat package.json | grep turndown
# Should show: "turndown": "^7.2.0"
```

**Acceptance Criteria:**
- [ ] `turndown` ^7.2.0 added to dependencies
- [ ] `@types/turndown` ^5.0.5 added to devDependencies
- [ ] `npm install` completes without errors
- [ ] TypeScript recognizes TurndownService type

---

### Task 1.2: Create Turndown Configuration

**Description:** Add Turndown service configuration to documentProcessor.ts
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**File:** `backend/src/services/documentProcessor.ts`

**Implementation:**

Add these imports at the top of the file:
```typescript
import TurndownService from 'turndown'
```

Add this configuration after imports (before existing functions):
```typescript
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

// Singleton instance for reuse
let turndownInstance: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = createTurndownService()
  }
  return turndownInstance
}
```

**Acceptance Criteria:**
- [ ] TurndownService imported without TypeScript errors
- [ ] `createTurndownService()` function added
- [ ] `getTurndown()` singleton accessor added
- [ ] Tables are configured to be skipped
- [ ] Heading style set to 'atx' (# syntax)
- [ ] Bullet marker set to '-'

---

## Phase 2: Core Pipeline Implementation

### Task 2.1: Add Markdown Cleanup Helper

**Description:** Create cleanupMarkdown() function to normalize Turndown output
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.2

**File:** `backend/src/services/documentProcessor.ts`

**Implementation:**

Add this function after the Turndown configuration:
```typescript
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
```

**Acceptance Criteria:**
- [ ] Function reduces 3+ consecutive newlines to 2
- [ ] Trailing whitespace removed from each line
- [ ] Leading whitespace from document trimmed
- [ ] Single trailing newline ensured

---

### Task 2.2: Add Markdown Title Extraction

**Description:** Create extractTitle() function for markdown-aware title detection
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1

**File:** `backend/src/services/documentProcessor.ts`

**Implementation:**

Add this function:
```typescript
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
```

**Acceptance Criteria:**
- [ ] Extracts title from `# Heading` syntax
- [ ] Falls back to first non-empty line
- [ ] Returns "Untitled" for empty documents
- [ ] Truncates to 100 characters max

---

### Task 2.3: Add Markdown Outline Extraction

**Description:** Create extractOutlineFromMarkdown() for markdown heading parsing
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1, 2.2

**File:** `backend/src/services/documentProcessor.ts`

**Implementation:**

Add this function:
```typescript
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

**Acceptance Criteria:**
- [ ] Parses `#` through `######` headings
- [ ] Extracts correct heading level from # count
- [ ] Generates stable section IDs using existing `generateSectionId()`
- [ ] Falls back to `extractOutlineFromText()` when no markdown headings found
- [ ] Maintains position ordering

---

### Task 2.4: Update processDOCX Function

**Description:** Replace extractRawText() with convertToHtml() + Turndown pipeline
**Size:** Medium
**Priority:** High
**Dependencies:** Tasks 2.1, 2.2, 2.3
**Can run parallel with:** None

**File:** `backend/src/services/documentProcessor.ts`

**Current Implementation to Replace:**
```typescript
export async function processDOCX(filePath: string): Promise<ProcessedDocument> {
  try {
    const mammoth = (await import('mammoth')).default
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value
    // ... rest of function
  }
}
```

**New Implementation:**
```typescript
/**
 * Process DOCX document with formatting preservation
 *
 * Pipeline: DOCX → HTML (mammoth) → Markdown (turndown) → ProcessedDocument
 *
 * Note: We intentionally do NOT regenerate embeddings after reprocessing.
 * Markdown formatting doesn't significantly change semantic meaning for RAG purposes.
 */
export async function processDOCX(filePath: string): Promise<ProcessedDocument> {
  try {
    // Dynamic import - only loads mammoth when processing DOCX
    const mammoth = (await import('mammoth')).default

    const buffer = await fs.readFile(filePath)

    // NEW: Convert to HTML instead of raw text (preserves formatting)
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
```

**Acceptance Criteria:**
- [ ] Uses `mammoth.convertToHtml()` instead of `extractRawText()`
- [ ] Converts HTML to Markdown via Turndown
- [ ] Applies `cleanupMarkdown()` to output
- [ ] Uses `extractTitle()` for title extraction
- [ ] Uses `extractOutlineFromMarkdown()` for outline
- [ ] Returns `fullText` as formatted markdown
- [ ] Includes code comment about embedding decision
- [ ] Maintains same error handling pattern
- [ ] TypeScript compiles without errors

---

## Phase 3: Reprocessing Service

### Task 3.1: Create Document Reprocessor Service

**Description:** Create new service to reprocess existing DOCX documents
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.4
**Can run parallel with:** None

**File:** `backend/src/services/documentReprocessor.ts` (NEW)

**Implementation:**
```typescript
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

  // Process each document sequentially to avoid overwhelming the system
  for (const doc of docxDocuments) {
    try {
      // Check if file still exists on disk
      try {
        await fs.access(doc.filePath)
      } catch {
        console.warn(`[Reprocessor] File not found, skipping: ${doc.filename}`)
        stats.skipped++
        continue
      }

      // Reprocess with new formatting pipeline
      const processed = await processDOCX(doc.filePath)
      const chunks = chunkDocumentBySection(processed)

      // Update document and chunks atomically
      await prisma.$transaction(async (tx) => {
        // Delete existing chunks first
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

  // Log summary
  console.log('[Reprocessor] Reprocessing complete:')
  console.log(`  - Total: ${stats.total}`)
  console.log(`  - Successful: ${stats.successful}`)
  console.log(`  - Failed: ${stats.failed}`)
  console.log(`  - Skipped: ${stats.skipped}`)

  return stats
}

/**
 * Check if reprocessing has already been done
 * Uses environment variable for simplicity
 */
async function hasAlreadyReprocessed(): Promise<boolean> {
  return process.env.DOCX_REPROCESSING_COMPLETE === 'true'
}

/**
 * Run reprocessing if needed (idempotent)
 * Called on server startup
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
      console.log('[Reprocessor] Set DOCX_REPROCESSING_COMPLETE=true to skip on next restart')
    } catch (error) {
      console.error('[Reprocessor] Fatal error during reprocessing:', error)
    }
  })
}
```

**Acceptance Criteria:**
- [ ] File created at `backend/src/services/documentReprocessor.ts`
- [ ] Queries only completed DOCX documents
- [ ] Checks file existence before processing
- [ ] Skips missing files gracefully
- [ ] Uses transaction for atomic updates
- [ ] Deletes old chunks before creating new ones
- [ ] Logs progress for each document
- [ ] Logs summary statistics at completion
- [ ] `runReprocessingIfNeeded()` checks env var
- [ ] Uses `setImmediate()` for non-blocking execution
- [ ] TypeScript compiles without errors

---

### Task 3.2: Integrate Reprocessor into Server Startup

**Description:** Call reprocessor on server startup in index.ts
**Size:** Small
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** None

**File:** `backend/src/index.ts`

**Implementation:**

Add import at top of file:
```typescript
import { runReprocessingIfNeeded } from './services/documentReprocessor'
```

Add call in the `app.listen()` callback, after `startProcessingQueue()`:
```typescript
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

**Acceptance Criteria:**
- [ ] Import added for `runReprocessingIfNeeded`
- [ ] Function called in `app.listen()` callback
- [ ] Called AFTER `startProcessingQueue()`
- [ ] Server starts without errors
- [ ] Reprocessing logs appear in console on startup

---

### Task 3.3: Manual Testing & Validation

**Description:** Verify end-to-end functionality with real DOCX files
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.2
**Can run parallel with:** None

**Testing Checklist:**

1. **New Document Upload Test:**
   - [ ] Upload DOCX with bulleted list → Verify bullets render as `- item`
   - [ ] Upload DOCX with numbered list → Verify numbers render correctly
   - [ ] Upload DOCX with headings (H1, H2, H3) → Verify `#`, `##`, `###` in output
   - [ ] Upload DOCX with bold/italic → Verify `**bold**` and `*italic*` in output
   - [ ] Upload DOCX with nested lists → Verify indentation preserved

2. **Reprocessing Test:**
   - [ ] Restart server WITHOUT `DOCX_REPROCESSING_COMPLETE=true`
   - [ ] Check logs for reprocessing messages
   - [ ] Verify existing documents show formatting after reprocessing
   - [ ] Set `DOCX_REPROCESSING_COMPLETE=true` in environment
   - [ ] Restart server → Verify "already completed" message appears

3. **Non-Regression Test:**
   - [ ] Upload PDF → Verify unchanged behavior (plain text extraction)
   - [ ] Upload Markdown file → Verify passes through unchanged
   - [ ] Verify document viewer displays content correctly

4. **Performance Validation:**
   - [ ] Process a DOCX file and verify < 500ms processing time
   - [ ] Check memory usage during processing

**Acceptance Criteria:**
- [ ] All upload tests pass
- [ ] Reprocessing works on first run
- [ ] Reprocessing skipped when env var set
- [ ] PDF/Markdown files unaffected
- [ ] Processing time < 500ms per document

---

## Execution Summary

### Task Dependency Graph

```
Phase 1: Foundation
[1.1] Install Dependencies
  └── [1.2] Create Turndown Configuration

Phase 2: Core Pipeline (can start after 1.2)
[1.2] ─┬── [2.1] Cleanup Helper     ─┐
       ├── [2.2] Title Extraction   ─┼── [2.4] Update processDOCX
       └── [2.3] Outline Extraction ─┘

Phase 3: Reprocessing (after 2.4)
[2.4] ─── [3.1] Reprocessor Service
             └── [3.2] Server Integration
                    └── [3.3] Manual Testing
```

### Parallel Execution Opportunities

- **Tasks 2.1, 2.2, 2.3** can be implemented in parallel after Task 1.2
- All other tasks must be sequential

### Critical Path

1.1 → 1.2 → 2.4 → 3.1 → 3.2 → 3.3

The critical path runs through the core pipeline update (2.4) which depends on all helper functions.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Turndown produces unexpected output | Low | Medium | cleanupMarkdown() handles edge cases |
| Reprocessing fails mid-way | Low | Low | Each document processed independently |
| Large documents cause OOM | Low | Medium | Existing worker/child process isolation handles this |

### Recommended Execution Order

1. **Task 1.1** - Install dependencies (2 min)
2. **Task 1.2** - Turndown configuration (10 min)
3. **Tasks 2.1-2.3** - Helper functions in parallel (15 min total)
4. **Task 2.4** - Update processDOCX (15 min)
5. **Task 3.1** - Reprocessor service (20 min)
6. **Task 3.2** - Server integration (5 min)
7. **Task 3.3** - Manual testing (15 min)

**Total implementation time:** ~1-2 hours
