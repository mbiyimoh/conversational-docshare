# Document Processing Pipeline - Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT PROCESSING PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. UPLOAD                                                                  │
│  ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐  │
│  │ DocumentUpload  │────▶│  upload.ts       │────▶│  document.controller│  │
│  │ (drag & drop)   │     │  (middleware)    │     │  status: 'pending'  │  │
│  │                 │     │                  │     │                     │  │
│  │ PDF, DOCX,      │     │ Validates type   │     │ Returns immediately │  │
│  │ XLSX, MD        │     │ Max 50MB         │     │                     │  │
│  └─────────────────┘     └──────────────────┘     └─────────────────────┘  │
│                                                              │              │
│  2. QUEUE                                                    ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      processingQueue.ts                              │   │
│  │                                                                       │   │
│  │  Polls every 15 seconds │ FIFO order │ 2-min timeout │ 1 retry       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                              │              │
│  3. PROCESSING (Memory Isolated)                             ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Production: Worker Pool (thread-based, 2 workers)                   │   │
│  │  Development: Child Process (8GB heap, tsx for TypeScript)           │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                   documentProcessor.ts                         │   │   │
│  │  │                                                                 │   │   │
│  │  │  PDF  → pdftotext (poppler-utils) OR pdf-parse fallback        │   │   │
│  │  │  DOCX → mammoth (dynamic import)                                │   │   │
│  │  │  XLSX → xlsx library (sheet-to-text)                            │   │   │
│  │  │  MD   → Native fs (regex for headings)                          │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                              │              │
│  4. CHUNKING                                                 ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     documentChunker.ts                               │   │
│  │                                                                       │   │
│  │  CHUNK_SIZE = 1000 chars │ OVERLAP = 200 chars                       │   │
│  │                                                                       │   │
│  │  Section-Aware: Preserves outline structure, section IDs             │   │
│  │  Fallback: Simple text chunking if no outline                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                              │              │
│  5. EMBEDDING                                                ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     embeddingService.ts                              │   │
│  │                                                                       │   │
│  │  Model: text-embedding-3-small │ Dimensions: 1536                    │   │
│  │  Batch size: 100 │ Stored in pgvector column                         │   │
│  │                                                                       │   │
│  │  Search: Cosine similarity via <=> operator                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                              │              │
│  6. VERSIONING (Optional)                                    ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    documentVersioning.ts                             │   │
│  │                                                                       │   │
│  │  Edit → TipTap JSON → New DocumentVersion                            │   │
│  │  Rollback → Creates NEW version with old content (non-destructive)   │   │
│  │  On save → queueEmbeddingRegeneration() re-chunks & re-embeds        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dependencies & Key Functions

### External Dependencies
- `pdftotext` (poppler-utils) - PDF text extraction (native binary)
- `pdf-parse` - Fallback PDF parser (JS)
- `mammoth` - DOCX text extraction
- `xlsx` - Excel file parsing
- `openai` - Embedding generation
- `@tiptap/core` - Rich text editor (frontend)

### Internal Dependencies
- `backend/src/services/worker/workerPool.ts` - Thread pool management
- `backend/src/services/worker/documentWorker.ts` - Worker thread code
- `backend/src/services/worker/processDocumentChild.ts` - Dev child process

### Provided Functions

**documentProcessor.ts:**
- `processDocument(filePath, mimeType)` - Routes to format-specific processor
- `processPDF(filePath)` - PDF → text + outline
- `processDOCX(filePath)` - DOCX → text + outline
- `processXLSX(filePath)` - XLSX → text (sheets as sections)
- `processMarkdown(filePath)` - MD → text + heading outline

**documentChunker.ts:**
- `chunkText(text, chunkSize, overlap)` - Simple text chunking
- `chunkDocumentBySection(doc)` - Section-aware chunking

**embeddingService.ts:**
- `generateEmbedding(text)` - Single text → vector
- `generateEmbeddings(texts)` - Batch texts → vectors
- `embedDocumentChunks(documentId)` - Embed all chunks for document
- `searchSimilarChunks(projectId, query, limit)` - Vector similarity search

**documentVersioning.ts:**
- `createDocumentVersion(documentId, content, userId)` - Create new version
- `rollbackToVersion(documentId, targetVersion, userId)` - Non-destructive rollback
- `plainTextToTipTap(text)` - Convert text → TipTap JSON
- `tipTapToPlainText(doc)` - Convert TipTap JSON → text

## User Experience Flow

### Upload → Chat Ready

1. **Creator drags file** → DocumentUpload.tsx accepts drop
2. **File validated** → Type, size checked by middleware
3. **Document record created** → Status: `pending`
4. **Queue picks up** → Every 15 seconds
5. **Processing starts** → Isolated in worker/child process
6. **Text extracted** → Format-specific parser
7. **Outline generated** → Section IDs for citations
8. **Chunks created** → 1000 chars with 200 overlap
9. **Embeddings generated** → OpenAI API, batched
10. **Status: completed** → Document ready for chat RAG

### Editing Flow (Optional)

1. **Creator clicks Edit** → DocumentEditor.tsx opens
2. **TipTap editor loads** → Current version content
3. **Creator makes changes** → Rich text editing
4. **Save Version** → POST to `/api/documents/:id/versions`
5. **New version created** → Sequential number
6. **Embeddings regenerate** → Async, non-blocking
7. **Chat uses new content** → Next RAG query gets updated chunks

## File & Code Mapping

### Key Files

| File | Responsibility | Lines |
|------|----------------|-------|
| `backend/src/services/documentProcessor.ts` | Format-specific extraction | 280 |
| `backend/src/services/documentChunker.ts` | Text chunking with overlap | 120 |
| `backend/src/services/embeddingService.ts` | Vector embedding + search | 220 |
| `backend/src/services/processingQueue.ts` | Background job queue | 180 |
| `backend/src/services/documentVersioning.ts` | Version management | 200 |
| `backend/src/services/worker/workerPool.ts` | Thread pool | 100 |
| `backend/src/services/worker/processDocumentChild.ts` | Dev child process | 80 |
| `frontend/src/components/DocumentUpload.tsx` | Drag-drop upload UI | 391 |
| `frontend/src/components/DocumentEditor.tsx` | TipTap rich text editor | 181 |
| `frontend/src/components/DocumentVersionHistory.tsx` | Version list + diff | 200 |

### Entry Points

- **Upload:** `POST /api/projects/:projectId/documents`
- **Get Document:** `GET /api/documents/:documentId`
- **Get for Edit:** `GET /api/documents/:documentId/edit`
- **Save Version:** `POST /api/documents/:documentId/versions`
- **Rollback:** `POST /api/documents/:documentId/rollback/:versionNum`

### Database Models

```prisma
Document {
  id, projectId, filename, originalName, mimeType, fileSize, filePath
  status: "pending" | "processing" | "completed" | "failed"
  title, outline (JSON), pageCount, wordCount
  currentVersion, isEditable
  chunks: DocumentChunk[]
  versions: DocumentVersion[]
}

DocumentChunk {
  id, documentId, content, sectionId, sectionTitle
  chunkIndex, startChar, endChar, pageNumber
  embedding: vector(1536)  // pgvector
}

DocumentVersion {
  id, documentId, version, content (TipTap JSON)
  editedById, changeNote, source, sourceId
}
```

## Connections to Other Parts

### Data Flow

```
Upload → Document record
    ↓
Queue → Worker/Child process
    ↓
Processor → text, outline, wordCount
    ↓
Chunker → DocumentChunk records
    ↓
Embedding → vector column updated
    ↓
Chat RAG → searchSimilarChunks() uses embeddings
```

### Integration Points

| System | Connection |
|--------|------------|
| Chat System | `searchSimilarChunks()` for RAG retrieval |
| Context Layers | Document outlines included in system prompt |
| Share Page | Document viewer shows chunk content |
| Comments | Comments anchor to specific chunks |

## Critical Notes & Pitfalls

### Performance

**Memory Isolation is CRITICAL:**
```typescript
// Large PDFs can consume 100MB+ RAM
// Processing in main thread causes OOM crashes

// Production: Worker pool (thread-based)
pool.exec('processDocument', [filePath, mimeType], { timeout: 120000 })

// Development: Child process (8GB heap)
spawn('node', ['--max-old-space-size=8192', '--import', 'tsx', childScript])
```

**Pre-Chunking in Worker:**
```typescript
// ❌ BAD - Transfer massive fullText to main process
return { title, outline, fullText } // OOM risk

// ✅ GOOD - Chunk in worker, exclude fullText
const chunks = chunkDocumentBySection(processed)
return { title, outline, chunks } // Only structured data
```

### Data Integrity

**Chunking Overlap Safety:**
```typescript
// Prevent infinite loop if overlap >= chunkSize
const nextStart = endChar - overlap
if (nextStart <= startChar) {
  startChar = endChar // Skip overlap, move forward
} else {
  startChar = nextStart
}
```

**Non-Destructive Versioning:**
```typescript
// Rollback creates NEW version, doesn't delete history
await createDocumentVersion(
  documentId,
  targetVersionRecord.content,
  userId,
  `Rollback to version ${targetVersion}`
)
```

### Known Edge Cases

**Variable Name Collision:**
```typescript
// ❌ BAD - 'document' shadows global DOM object
const document = await prisma.document.findUnique(...)

// ✅ GOOD - Use 'docData' or similar
const docData = await prisma.document.findUnique(...)
```

**TipTap Text Extraction Sync:**
```typescript
// Frontend and backend MUST use identical logic
// frontend/src/lib/tiptapUtils.ts
// backend/src/services/documentVersioning.ts
// Keep these in sync!
```

**Editable Flag:**
```typescript
// PDF: isEditable = false (binary format, can't edit)
// DOCX/XLSX/MD: isEditable = true
if (!document.isEditable) {
  throw new ValidationError('This document type cannot be edited')
}
```

**PDF Memory Explosion:**
```typescript
// ❌ BAD - JS PDF parser loads entire file to memory
const pdfParse = require('pdf-parse')
const data = await pdfParse(buffer) // OOM for large files

// ✅ GOOD - Native binary with streaming
const text = execSync(`pdftotext -layout "${filePath}" -`, {
  maxBuffer: 50 * 1024 * 1024 // 50MB max output
})
```

## Common Development Scenarios

### 1. Adding Support for New File Format

**Files to modify:**
1. `backend/src/middleware/upload.ts` - Add MIME type to `ALLOWED_MIME_TYPES`
2. `backend/src/services/documentProcessor.ts`:
   - Add `processNEWFORMAT()` function
   - Add case to `processDocument()` switch
3. Test upload and processing

**Pattern:**
```typescript
export async function processNewFormat(filePath: string): Promise<ProcessedDocument> {
  const text = // extract text using appropriate library
  const outline = extractOutlineFromText(text)
  return {
    title: // extract or default to filename,
    outline,
    fullText: text,
    wordCount: text.split(/\s+/).length
  }
}
```

### 2. Adjusting Chunk Size

**File:** `backend/src/services/documentChunker.ts`

```typescript
const CHUNK_SIZE = 1000 // Increase for more context per chunk
const CHUNK_OVERLAP = 200 // Increase for better continuity
```

**Trade-offs:**
- Larger chunks → Better context, fewer search results
- Smaller chunks → More precise search, less context
- More overlap → Better continuity, more redundant data

### 3. Debugging Processing Failures

**Steps:**
1. Check document status in database
2. Look at `processingError` field
3. Check backend logs for `[Processing Queue]` messages
4. For PDF issues, test `pdftotext` command directly
5. Check if worker/child process crashed (memory limit)

**Useful commands:**
```bash
# Test PDF extraction
pdftotext -layout "/path/to/doc.pdf" -

# Check document status
SELECT id, filename, status, "processingError"
FROM documents
WHERE "projectId" = 'xxx';
```

### 4. Regenerating Embeddings for Edited Document

**Automatic:** On version save, `queueEmbeddingRegeneration()` is called

**Manual (if needed):**
```typescript
// Delete old chunks
await prisma.documentChunk.deleteMany({ where: { documentId } })

// Re-process document
// ... processing logic ...

// Re-embed
await embedDocumentChunks(documentId)
```

## Testing Strategy

### Manual Testing Checklist
- [ ] Upload PDF, verify status → completed
- [ ] Upload DOCX, verify text extraction
- [ ] Upload XLSX, verify sheets as sections
- [ ] Check outline generated with section IDs
- [ ] Verify chunks created (check database)
- [ ] Test RAG search returns relevant chunks
- [ ] Edit document, verify new version created
- [ ] Rollback, verify non-destructive

### Smoke Tests
```bash
# Upload document
curl -X POST -F "file=@test.pdf" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/projects/$PROJECT_ID/documents

# Check processing status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/documents/$DOC_ID
```

### Debugging Tips
- Check `document.processingError` for failure details
- Look for `[Processing Queue]` logs in backend
- Test PDF tools directly: `pdftotext`, `pdfinfo`
- Monitor memory usage during large file processing

## Quick Reference

### File Format Support

| Format | MIME Type | Library | Editable | Notes |
|--------|-----------|---------|----------|-------|
| PDF | `application/pdf` | pdftotext/pdf-parse | No | Native binary preferred |
| DOCX | `application/.../wordprocessingml.document` | mammoth | Yes | Dynamic import |
| XLSX | `application/.../spreadsheetml.sheet` | xlsx | Yes | Sheets → sections |
| MD | `text/markdown` | Native fs | Yes | # headings → outline |

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/projects/:projectId/documents` | Upload file |
| GET | `/api/documents/:documentId` | Get metadata |
| GET | `/api/documents/:documentId/edit` | Get for editing |
| POST | `/api/documents/:documentId/versions` | Save new version |
| GET | `/api/documents/:documentId/versions` | List versions |
| POST | `/api/documents/:documentId/rollback/:v` | Rollback |

### Configuration Summary

| Setting | Value | Location |
|---------|-------|----------|
| Max file size | 50MB | upload.ts |
| Queue interval | 15 seconds | processingQueue.ts |
| Processing timeout | 2 minutes | processingQueue.ts |
| Chunk size | 1000 chars | documentChunker.ts |
| Chunk overlap | 200 chars | documentChunker.ts |
| Embedding model | text-embedding-3-small | embeddingService.ts |
| Embedding dimensions | 1536 | embeddingService.ts |
| Embedding batch size | 100 | embeddingService.ts |
| Worker heap (dev) | 8GB | processDocumentChild.ts |

### Critical Files Checklist
1. `backend/src/services/documentProcessor.ts` - Text extraction
2. `backend/src/services/documentChunker.ts` - Chunking logic
3. `backend/src/services/embeddingService.ts` - Vector operations
4. `backend/src/services/processingQueue.ts` - Background jobs
5. `backend/src/services/documentVersioning.ts` - Version management
6. `backend/src/middleware/upload.ts` - File validation
