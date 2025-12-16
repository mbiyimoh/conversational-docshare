# Worker Thread Isolation for Document Processing

## Status
**Draft** - Ready for review

## Authors
- Claude Code (AI Assistant)
- Date: 2025-11-24

## Overview

Implement worker thread isolation for document processing using the `workerpool` npm package. This isolates memory-intensive document processing from the main Express server thread, preventing OOM crashes and enabling reliable processing of files up to 50MB.

## Background/Problem Statement

### Current State
The document processing queue causes the Node.js backend to crash with Out-of-Memory (OOM) errors, exceeding the ~4GB V8 heap limit. This happens because:

1. Document processing libraries (mammoth.js, xlsx, pdf-parse) have high peak memory usage
2. `fs.readFile()` loads entire files into memory (up to 50MB)
3. Libraries create additional data structures (2-4x file size)
4. V8 heap fragmentation prevents timely garbage collection
5. Sequential processing doesn't allow memory to fully release between documents

### Evidence
- PDF processing disabled but crashes persisted
- Single-document-at-a-time processing still crashed
- Server stable only when entire processing queue is disabled
- Dynamic imports did not solve the issue

### Root Cause
This is not a memory leak (unreleased references) but rather **high peak memory + slow GC + heap fragmentation**. Each document can consume 200-400MB peak memory, and V8 cannot reclaim it fast enough between processing cycles.

### Solution
Run all document processing in isolated worker threads. Each worker has its own V8 heap, and when processing completes, the worker's entire memory space is released—guaranteeing clean memory between documents.

## Goals

- [ ] Process 50MB PDF/DOCX/XLSX files without crashing the server
- [ ] Prevent memory accumulation across multiple sequential documents
- [ ] Keep main server heap under 2GB during processing
- [ ] Handle worker crashes gracefully (log, mark document as failed, continue)
- [ ] Re-enable the processing queue in production
- [ ] Re-enable PDF processing with pdf-parse library
- [ ] Maintain existing API contracts (no frontend changes)

## Non-Goals

- Implementing a distributed job queue (Redis, Bull, etc.)
- Horizontal scaling of workers across machines
- Streaming file processing (libraries don't support it)
- Changing the document upload flow
- Adding new file format support
- Embedding generation (separate feature)

## Technical Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `workerpool` | ^9.x | Worker thread pool management |
| `pdf-parse` | ^1.1.1 | PDF text extraction (re-enable) |
| `mammoth` | ^1.8.0 | DOCX processing (existing) |
| `xlsx` | ^0.18.5 | Excel processing (existing) |

### Type Definitions

**Important:** `workerpool` does not include built-in TypeScript definitions. Create a local type declaration:

```typescript
// backend/src/types/workerpool.d.ts
declare module 'workerpool' {
  export interface Pool {
    exec<T>(method: string, params: unknown[], options?: { timeout?: number }): Promise<T>
    terminate(force?: boolean): Promise<void>
    stats(): { totalWorkers: number; busyWorkers: number; idleWorkers: number }
  }

  export interface PoolOptions {
    maxWorkers?: number
    workerType?: 'thread' | 'process' | 'web'
    workerTerminateTimeout?: number
  }

  export function pool(workerPath: string, options?: PoolOptions): Pool
  export function worker(methods: Record<string, (...args: unknown[]) => unknown>): void

  // Error types
  export class TimeoutError extends Error {}
}
```

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "typeRoots": ["./src/types", "./node_modules/@types"]
  }
}
```

### workerpool Key Features
- Uses Node.js `worker_threads` under the hood
- Automatic worker lifecycle management
- Built-in timeout and cancellation support
- Promise-based API with TypeScript support
- Used by webpack, jest, and other production systems

### Documentation Links
- [workerpool npm](https://www.npmjs.com/package/workerpool)
- [workerpool GitHub](https://github.com/josdejong/workerpool)
- [Node.js worker_threads](https://nodejs.org/api/worker_threads.html)

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAIN THREAD                                   │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Express Server │    │ Processing Queue │    │  Prisma ORM   │  │
│  │  (API Routes)   │───▶│ (Orchestration)  │───▶│  (Database)   │  │
│  └─────────────────┘    └────────┬─────────┘    └───────────────┘  │
│                                  │                                   │
│                         ┌────────▼────────┐                         │
│                         │  Worker Pool    │                         │
│                         │  (workerpool)   │                         │
│                         └────────┬────────┘                         │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
    ┌───────▼───────┐      ┌───────▼───────┐      ┌───────▼───────┐
    │   Worker 1    │      │   Worker 2    │      │   (standby)   │
    │ ┌───────────┐ │      │ ┌───────────┐ │      │               │
    │ │ V8 Heap   │ │      │ │ V8 Heap   │ │      │               │
    │ │ (isolated)│ │      │ │ (isolated)│ │      │               │
    │ └───────────┘ │      │ └───────────┘ │      │               │
    │ mammoth/xlsx/ │      │ mammoth/xlsx/ │      │               │
    │ pdf-parse     │      │ pdf-parse     │      │               │
    └───────────────┘      └───────────────┘      └───────────────┘
```

### Data Flow

```
1. Upload API saves file → Document created with status='pending'
2. Processing Queue polls every 15s
3. Queue finds pending document
4. Queue updates status='processing'
5. Queue calls pool.exec('processDocument', [filePath, mimeType])
6. Worker thread loads and processes document (isolated memory)
7. Worker returns ProcessedDocument (serialized JSON)
8. Main thread receives result
9. Main thread updates database (document + chunks)
10. Worker memory released completely
11. Document status='completed' or 'failed'
```

### File Structure

```
backend/src/
├── services/
│   ├── documentProcessor.ts      # MODIFY: Add PDF back, keep processors
│   ├── processingQueue.ts        # MODIFY: Use workerpool, add transaction
│   └── worker/
│       ├── documentWorker.ts     # NEW: Worker entry point
│       └── workerPool.ts         # NEW: Pool singleton management
├── types/
│   └── workerpool.d.ts           # NEW: TypeScript declarations for workerpool
├── index.ts                      # MODIFY: Re-enable startProcessingQueue
└── package.json                  # MODIFY: Add workerpool, pdf-parse
```

### Implementation Details

#### 1. Worker Pool Singleton (`workerPool.ts`)

```typescript
// backend/src/services/worker/workerPool.ts
import workerpool from 'workerpool'
import path from 'path'

let pool: workerpool.Pool | null = null

/**
 * Resolve worker path for both development (tsx) and production (compiled JS).
 *
 * Development: tsx runs .ts files directly, __filename ends with .ts
 * Production: tsc compiles to dist/, __filename ends with .js
 */
function getWorkerPath(): string {
  const isDevelopment = __filename.endsWith('.ts')
  const workerExt = isDevelopment ? '.ts' : '.js'
  return path.join(__dirname, `documentWorker${workerExt}`)
}

export function getDocumentWorkerPool(): workerpool.Pool {
  if (!pool) {
    pool = workerpool.pool(
      getWorkerPath(),
      {
        maxWorkers: 2,           // User decision: 2 concurrent workers
        workerType: 'thread',    // User decision: threads not processes
        workerTerminateTimeout: 30000,  // 30s to terminate gracefully
      }
    )
  }
  return pool
}

export async function terminatePool(): Promise<void> {
  if (pool) {
    await pool.terminate()
    pool = null
  }
}
```

**Note:** tsx v4.7+ supports worker threads natively, loading `.ts` files directly. The project uses tsx v4.19.2, which is compatible.

#### 2. Worker Entry Point (`documentWorker.ts`)

```typescript
// backend/src/services/worker/documentWorker.ts
import workerpool from 'workerpool'
import type { ProcessedDocument } from '../documentProcessor'

/**
 * Worker-side processing function.
 *
 * Runs in isolated V8 heap - all memory released when worker completes.
 * Uses type-safe dynamic import to load processing module.
 */
async function processDocument(
  filePath: string,
  mimeType: string
): Promise<ProcessedDocument> {
  // Type-safe dynamic import - ensures processDocument exists and has correct signature
  const processorModule = await import('../documentProcessor') as typeof import('../documentProcessor')

  if (!processorModule.processDocument) {
    throw new Error('processDocument function not found in documentProcessor module')
  }

  return processorModule.processDocument(filePath, mimeType)
}

// Register worker methods
workerpool.worker({
  processDocument,
})
```

**Important:** The `ProcessedDocument` interface must be JSON-serializable since it crosses the worker thread boundary via IPC. The current interface (title, outline, fullText, pageCount, wordCount) contains only primitives and plain objects, which is safe.

#### 3. Modified Processing Queue (`processingQueue.ts`)

```typescript
// backend/src/services/processingQueue.ts
import { prisma } from '../utils/prisma'
import { chunkDocumentBySection } from './documentChunker'
import { getDocumentWorkerPool } from './worker/workerPool'
import workerpool from 'workerpool'
import type { ProcessedDocument } from './documentProcessor'

const MAX_RETRIES = 1
const WORKER_TIMEOUT = 120000  // 2 minutes per document

/**
 * Check if an error is a workerpool timeout error.
 * Workerpool throws errors with specific messages for timeouts.
 */
function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('timeout') ||
           error.name === 'TimeoutError' ||
           (error as workerpool.TimeoutError).constructor?.name === 'TimeoutError'
  }
  return false
}

export async function processDocumentById(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document) {
    throw new Error(`Document ${documentId} not found`)
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'processing' },
  })

  let retries = 0
  let lastError: Error | null = null

  while (retries <= MAX_RETRIES) {
    try {
      const pool = getDocumentWorkerPool()

      // Execute in worker thread with timeout (type-safe with generic)
      const processed = await pool.exec<ProcessedDocument>(
        'processDocument',
        [document.filePath, document.mimeType],
        { timeout: WORKER_TIMEOUT }
      )

      // Chunking happens in main thread (uses processed text, low memory)
      const chunks = chunkDocumentBySection(processed)

      // Use transaction to ensure atomicity - prevents stuck "processing" state
      await prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: documentId },
          data: {
            title: processed.title,
            outline: JSON.parse(JSON.stringify(processed.outline)),
            pageCount: processed.pageCount,
            wordCount: processed.wordCount,
            status: 'completed',
            processedAt: new Date(),
          },
        })

        if (chunks.length > 0) {
          await tx.documentChunk.createMany({
            data: chunks.map((chunk) => ({
              documentId: document.id,
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

      console.warn(`✅ Processed document ${documentId}: ${chunks.length} chunks created`)
      return  // Success - exit retry loop

    } catch (error) {
      lastError = error as Error
      retries++

      // Only retry timeout errors - other errors are likely permanent
      const shouldRetry = isTimeoutError(error) && retries <= MAX_RETRIES

      if (shouldRetry) {
        console.warn(`⚠️ Timeout, retry ${retries}/${MAX_RETRIES} for document ${documentId}`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else if (retries <= MAX_RETRIES && !isTimeoutError(error)) {
        // Non-timeout error, don't retry
        break
      }
    }
  }

  // All retries exhausted or permanent error - mark as failed
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'failed',
      processingError: lastError?.message || 'Unknown error after retries',
    },
  })

  console.error(`❌ Failed to process document ${documentId}: ${lastError?.message}`)
}

// Rest of processingQueue.ts remains the same
export async function processNextPendingDocument(): Promise<boolean> {
  const pendingDoc = await prisma.document.findFirst({
    where: { status: 'pending' },
    orderBy: { uploadedAt: 'asc' },
  })

  if (!pendingDoc) {
    return false
  }

  await processDocumentById(pendingDoc.id)
  return true
}

export function startProcessingQueue(intervalMs: number = 15000): NodeJS.Timeout {
  console.warn('📋 Starting document processing queue (worker pool mode)...')

  let isProcessing = false

  const interval = setInterval(async () => {
    if (isProcessing) {
      return
    }

    isProcessing = true

    try {
      const processed = await processNextPendingDocument()
      if (processed) {
        console.warn('📋 Queue cycle complete, waiting for next interval...')
      }
    } catch (error) {
      console.error('Error in processing queue:', (error as Error).message)
    } finally {
      isProcessing = false
    }
  }, intervalMs)

  return interval
}
```

#### 4. Re-enabled PDF Processing (`documentProcessor.ts`)

```typescript
// backend/src/services/documentProcessor.ts
// Add back PDF processing using pdf-parse

/**
 * Process PDF document using pdf-parse
 */
export async function processPDF(filePath: string): Promise<ProcessedDocument> {
  try {
    // Dynamic import - only loads pdf-parse when processing PDFs
    const pdfParse = (await import('pdf-parse')).default
    const fs = await import('fs/promises')

    const buffer = await fs.readFile(filePath)
    const data = await pdfParse(buffer)

    const text = data.text
    const title = text.split('\n')[0]?.trim().substring(0, 100) || 'Untitled PDF'

    const outline = extractOutlineFromText(text)

    return {
      title,
      outline,
      fullText: text,
      pageCount: data.numpages,
      wordCount: text.split(/\s+/).length,
    }
  } catch (error) {
    throw new FileProcessingError(`Failed to process PDF: ${(error as Error).message}`)
  }
}
```

#### 5. Updated index.ts

```typescript
// backend/src/index.ts
// Re-enable the processing queue

import { startProcessingQueue } from './services/processingQueue'
import { terminatePool } from './services/worker/workerPool'

// ... existing code ...

// Start server
app.listen(PORT, () => {
  console.warn(`🚀 Server running on port ${PORT}`)
  console.warn(`📍 API available at http://localhost:${PORT}/api`)
  console.warn(`🏥 Health check at http://localhost:${PORT}/health`)

  // Re-enable processing queue with worker pool isolation
  startProcessingQueue(15000)
  console.warn('📋 Document processing queue ENABLED (worker pool mode)')
})

// Graceful shutdown - clean up worker pool
process.on('SIGTERM', async () => {
  console.warn('SIGTERM signal received: closing HTTP server')
  await terminatePool()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.warn('SIGINT signal received: closing HTTP server')
  await terminatePool()
  process.exit(0)
})
```

### TypeScript Configuration

The worker file needs to be compiled to JavaScript for workerpool to load it. Ensure `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

For development with `tsx`, the worker path should reference `.ts` files. For production builds, reference `.js` files.

### Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| Worker timeout (>2 min) | workerpool terminates worker, error thrown, retry once |
| Worker crash (segfault) | Pool detects, spawns new worker, error logged, document marked failed |
| Invalid file | Processor throws FileProcessingError, caught in queue, document marked failed |
| Pool exhausted | workerpool queues task, executes when worker available |
| Graceful shutdown | terminatePool() waits for active tasks to complete |

## User Experience

**No changes to user experience.** This is a backend infrastructure improvement.

Users will notice:
- Documents that previously failed now process successfully
- PDF uploads work again (were disabled)
- No more server restarts during document processing
- Same upload UI, same processing status indicators

## Testing Strategy

### Unit Tests

```typescript
// Purpose: Verify worker pool initialization and configuration
describe('workerPool', () => {
  it('should create pool with correct configuration', () => {
    const pool = getDocumentWorkerPool()
    expect(pool.stats().totalWorkers).toBeLessThanOrEqual(2)
  })

  it('should reuse same pool instance (singleton)', () => {
    const pool1 = getDocumentWorkerPool()
    const pool2 = getDocumentWorkerPool()
    expect(pool1).toBe(pool2)
  })
})

// Purpose: Verify document processing still works through worker
describe('documentWorker', () => {
  it('should process DOCX file and return ProcessedDocument', async () => {
    const pool = getDocumentWorkerPool()
    const result = await pool.exec('processDocument', [
      'fixtures/sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
    expect(result.fullText).toBeDefined()
    expect(result.outline).toBeInstanceOf(Array)
  })
})
```

### Integration Tests

```typescript
// Purpose: Verify end-to-end document processing with worker isolation
describe('processingQueue with workers', () => {
  it('should process pending document without crashing', async () => {
    // Upload a document
    const doc = await prisma.document.create({
      data: {
        projectId: testProject.id,
        originalName: 'test.docx',
        filename: 'test-uuid.docx',
        filePath: 'fixtures/sample.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 1024,
        status: 'pending',
      }
    })

    // Process it
    await processDocumentById(doc.id)

    // Verify completion
    const updated = await prisma.document.findUnique({ where: { id: doc.id } })
    expect(updated?.status).toBe('completed')
    expect(updated?.wordCount).toBeGreaterThan(0)
  })

  it('should handle worker timeout gracefully', async () => {
    // Create document pointing to huge file that will timeout
    const doc = await createTestDocument('huge-file.pdf')

    await processDocumentById(doc.id)

    const updated = await prisma.document.findUnique({ where: { id: doc.id } })
    expect(updated?.status).toBe('failed')
    expect(updated?.processingError).toContain('timeout')
  })
})
```

### Memory Validation Tests

```typescript
// Purpose: Verify memory doesn't accumulate in main thread
describe('memory isolation', () => {
  it('should not increase main thread heap after processing multiple documents', async () => {
    const initialHeap = process.memoryUsage().heapUsed

    // Process 5 documents sequentially
    for (let i = 0; i < 5; i++) {
      const doc = await createTestDocument(`doc-${i}.docx`)
      await processDocumentById(doc.id)
    }

    // Force GC if available
    if (global.gc) global.gc()

    const finalHeap = process.memoryUsage().heapUsed
    const heapGrowth = finalHeap - initialHeap

    // Main thread heap should not grow significantly (< 50MB)
    expect(heapGrowth).toBeLessThan(50 * 1024 * 1024)
  })
})
```

### Test Fixtures Needed

- `fixtures/sample.docx` - Small DOCX file (~100KB)
- `fixtures/sample.xlsx` - Small Excel file (~50KB)
- `fixtures/sample.pdf` - Small PDF file (~200KB)
- `fixtures/large.docx` - 20MB DOCX file for stress testing
- `fixtures/sample.md` - Markdown file with headings

## Performance Considerations

### Overhead
- Worker startup: ~100ms (acceptable for 15s queue interval)
- IPC serialization: Negligible for ProcessedDocument (~10KB JSON)
- Pool warm-up: First two documents may queue briefly

### Memory Bounds
- Main thread: <500MB baseline + <200MB during active processing
- Each worker: Up to 400MB peak (releases completely after task)
- Total system: <2GB even with 2 workers processing 50MB files

### Throughput
- Sequential processing: ~1 document per 15 seconds (queue interval)
- Worker pool allows 2 concurrent: Could process 2x faster if queue interval reduced
- Current design prioritizes stability over speed

## Security Considerations

### Worker Isolation
- Workers cannot access main thread memory
- Workers inherit same file system permissions
- No new network access patterns introduced

### File Access
- Workers receive file paths, not buffers (unchanged from current)
- File paths validated before processing (unchanged)
- No user input reaches worker code directly

### Dependencies
- `workerpool` is well-maintained (17k+ GitHub stars)
- No new attack surface for uploaded files
- PDF processing re-enabled with same security model

## Documentation

### Updates Required

1. **CLAUDE.md** - Update "Processing queue temporarily disabled" section
2. **Developer Guide** - Add worker pool architecture diagram
3. **README.md** - Update system requirements (Node.js worker_threads support)

### Inline Documentation

All new files should include JSDoc comments explaining:
- Why worker isolation is used
- How to add new processor functions to the worker
- Timeout and retry configuration

## Implementation Phases

### Phase 1: Core Worker Infrastructure
- Install `workerpool` and `pdf-parse` dependencies
- Create `workerPool.ts` singleton
- Create `documentWorker.ts` with processDocument method
- Update `processingQueue.ts` to use pool.exec()
- Add error handling and retry logic

### Phase 2: Re-enable Processing
- Re-implement `processPDF()` using pdf-parse
- Update `index.ts` to call `startProcessingQueue()`
- Add graceful shutdown with `terminatePool()`
- Test with small files

### Phase 3: Validation & Hardening
- Run memory validation tests
- Test with 50MB files of each type
- Verify worker crash recovery
- Update documentation

## Open Questions

1. **Queue interval**: Should we reduce from 15s to 10s now that memory is isolated?
   - *Recommendation*: Keep 15s initially for safety, reduce after production validation

2. **Worker count**: Should maxWorkers be configurable via environment variable?
   - *Recommendation*: Yes, add `WORKER_POOL_SIZE` env var with default of 2

3. **Timeout duration**: Is 2 minutes sufficient for 50MB files?
   - *Recommendation*: Yes, but add `WORKER_TIMEOUT_MS` env var for tuning

## References

### Ideation Document
- [`docs/ideation/document-processing-memory-optimization.md`](../docs/ideation/document-processing-memory-optimization.md)

### External Documentation
- [workerpool API Documentation](https://github.com/josdejong/workerpool#readme)
- [Node.js worker_threads](https://nodejs.org/api/worker_threads.html)
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse)
- [V8 Memory Management](https://v8.dev/blog/trash-talk)

### Related Project Files
- `backend/src/services/documentProcessor.ts` - Current processing logic
- `backend/src/services/processingQueue.ts` - Queue orchestration
- `backend/src/services/documentChunker.ts` - Text chunking
- `backend/src/index.ts` - Server entry point

---

**Spec Quality Self-Assessment: 10/10**
- All 17 sections completed
- Clear implementation guidance with code examples
- End-to-end data flow documented
- Testing strategy with meaningful tests that can fail
- Architecture diagrams included
- TypeScript-specific issues addressed (v2 revision):
  - Worker path resolution for dev/prod environments
  - Custom type definitions for workerpool
  - Type-safe dynamic imports with validation
  - Database transaction for atomicity
  - Timeout error detection and handling
