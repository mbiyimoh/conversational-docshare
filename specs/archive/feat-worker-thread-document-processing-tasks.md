# Task Breakdown: Worker Thread Isolation for Document Processing

**Spec:** `specs/feat-worker-thread-document-processing.md`
**Created:** 2025-11-24
**Status:** Ready for Implementation

---

## Overview

This document breaks down the Worker Thread Isolation spec into atomic, implementable tasks. Each task includes:
- Clear completion criteria
- Required code changes
- Dependencies on other tasks

---

## Phase 1: Core Worker Infrastructure

### Task 1.1: Install Dependencies

**Description:** Add workerpool and pdf-parse packages

**Commands:**
```bash
cd backend && npm install workerpool pdf-parse
```

**Completion Criteria:**
- [ ] `workerpool` appears in package.json dependencies
- [ ] `pdf-parse` appears in package.json dependencies
- [ ] `npm install` completes without errors

**Files Changed:**
- `backend/package.json`

**Dependencies:** None

---

### Task 1.2: Create TypeScript Type Definitions for workerpool

**Description:** Create local type declarations since workerpool lacks built-in TypeScript support

**Files to Create:**
- `backend/src/types/workerpool.d.ts`

**Code:**
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

**Files Changed:**
- `backend/tsconfig.json` - Add typeRoots configuration

**Completion Criteria:**
- [ ] Type definition file exists at `backend/src/types/workerpool.d.ts`
- [ ] `tsconfig.json` includes `"typeRoots": ["./src/types", "./node_modules/@types"]`
- [ ] No TypeScript errors when importing workerpool

**Dependencies:** Task 1.1

---

### Task 1.3: Create Worker Pool Singleton

**Description:** Create the pool management module with dev/prod path resolution

**Files to Create:**
- `backend/src/services/worker/workerPool.ts`

**Code:**
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
        maxWorkers: 2,
        workerType: 'thread',
        workerTerminateTimeout: 30000,
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

**Directory to Create:**
- `backend/src/services/worker/`

**Completion Criteria:**
- [ ] Directory `backend/src/services/worker/` exists
- [ ] File `workerPool.ts` exports `getDocumentWorkerPool()` and `terminatePool()`
- [ ] Pool uses singleton pattern (returns same instance)
- [ ] Path resolution works for both `.ts` and `.js` extensions

**Dependencies:** Task 1.2

---

### Task 1.4: Create Document Worker Entry Point

**Description:** Create the worker file that runs in isolated thread

**Files to Create:**
- `backend/src/services/worker/documentWorker.ts`

**Code:**
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
  // Type-safe dynamic import
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

**Completion Criteria:**
- [ ] File `documentWorker.ts` exists in worker directory
- [ ] Worker registers `processDocument` method with workerpool
- [ ] Dynamic import uses type-safe pattern with validation

**Dependencies:** Task 1.3

---

### Task 1.5: Update Processing Queue to Use Worker Pool

**Description:** Modify processingQueue.ts to execute processing through worker pool with transactions and retry logic

**Files to Modify:**
- `backend/src/services/processingQueue.ts`

**Key Changes:**
1. Import worker pool: `import { getDocumentWorkerPool } from './worker/workerPool'`
2. Add timeout detection function `isTimeoutError()`
3. Replace direct `processDocument()` call with `pool.exec()`
4. Wrap database updates in `prisma.$transaction()`
5. Add retry logic for timeout errors (1 retry)

**Code (processDocumentById replacement):**
```typescript
import { prisma } from '../utils/prisma'
import { chunkDocumentBySection } from './documentChunker'
import { getDocumentWorkerPool } from './worker/workerPool'
import workerpool from 'workerpool'
import type { ProcessedDocument } from './documentProcessor'

const MAX_RETRIES = 1
const WORKER_TIMEOUT = 120000  // 2 minutes per document

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

      const processed = await pool.exec<ProcessedDocument>(
        'processDocument',
        [document.filePath, document.mimeType],
        { timeout: WORKER_TIMEOUT }
      )

      const chunks = chunkDocumentBySection(processed)

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
      return

    } catch (error) {
      lastError = error as Error
      retries++

      const shouldRetry = isTimeoutError(error) && retries <= MAX_RETRIES

      if (shouldRetry) {
        console.warn(`⚠️ Timeout, retry ${retries}/${MAX_RETRIES} for document ${documentId}`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else if (retries <= MAX_RETRIES && !isTimeoutError(error)) {
        break
      }
    }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'failed',
      processingError: lastError?.message || 'Unknown error after retries',
    },
  })

  console.error(`❌ Failed to process document ${documentId}: ${lastError?.message}`)
}
```

**Completion Criteria:**
- [ ] Worker pool used instead of direct function call
- [ ] Database operations wrapped in transaction
- [ ] Timeout error detection implemented
- [ ] Retry logic present (1 retry for timeouts)
- [ ] No TypeScript errors
- [ ] Existing queue polling logic preserved

**Dependencies:** Task 1.4

---

## Phase 2: Re-enable Processing

### Task 2.1: Re-implement PDF Processing

**Description:** Replace the disabled PDF processor with working pdf-parse implementation

**Files to Modify:**
- `backend/src/services/documentProcessor.ts`

**Code (replace processPDF function):**
```typescript
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

**Completion Criteria:**
- [ ] `processPDF()` no longer throws "temporarily disabled" error
- [ ] PDF processing uses `pdf-parse` library
- [ ] Returns `ProcessedDocument` with title, outline, fullText, pageCount, wordCount
- [ ] Dynamic import pattern preserved

**Dependencies:** Task 1.1

---

### Task 2.2: Update Server Entry Point

**Description:** Re-enable the processing queue and add graceful shutdown

**Files to Modify:**
- `backend/src/index.ts`

**Changes:**
1. Import `startProcessingQueue` from processingQueue
2. Import `terminatePool` from workerPool
3. Uncomment/add `startProcessingQueue(15000)` call
4. Update shutdown handlers to call `terminatePool()`
5. Update console messages

**Code (key sections):**
```typescript
import { startProcessingQueue } from './services/processingQueue'
import { terminatePool } from './services/worker/workerPool'

// In app.listen callback:
app.listen(PORT, () => {
  console.warn(`🚀 Server running on port ${PORT}`)
  console.warn(`📍 API available at http://localhost:${PORT}/api`)
  console.warn(`🏥 Health check at http://localhost:${PORT}/health`)

  // Re-enable processing queue with worker pool isolation
  startProcessingQueue(15000)
  console.warn('📋 Document processing queue ENABLED (worker pool mode)')
})

// Update shutdown handlers:
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

**Completion Criteria:**
- [ ] `startProcessingQueue(15000)` called on server start
- [ ] Console shows "Document processing queue ENABLED (worker pool mode)"
- [ ] SIGTERM handler calls `terminatePool()` before exit
- [ ] SIGINT handler calls `terminatePool()` before exit
- [ ] No TypeScript errors

**Dependencies:** Task 1.5

---

### Task 2.3: Verify Basic Functionality

**Description:** Manual verification that processing works with small files

**Steps:**
1. Start the backend server
2. Upload a small DOCX file (<1MB)
3. Wait for processing queue to pick it up (15s interval)
4. Verify document status changes to 'completed'
5. Verify chunks are created in database

**Completion Criteria:**
- [ ] Server starts without errors
- [ ] Console shows queue is enabled
- [ ] Small DOCX processes successfully
- [ ] Document status = 'completed'
- [ ] DocumentChunks exist for document

**Dependencies:** Task 2.2

---

## Phase 3: Validation & Hardening

### Task 3.1: Test Large File Processing

**Description:** Verify 50MB files process without crashing server

**Test Cases:**
1. 20MB DOCX file - should complete
2. 20MB XLSX file - should complete
3. 20MB PDF file - should complete
4. 50MB file (any type) - should complete or timeout gracefully

**Completion Criteria:**
- [ ] 20MB files of each type process successfully
- [ ] Server heap stays under 2GB during processing
- [ ] No OOM crashes
- [ ] Timeout errors handled gracefully (status='failed')

**Dependencies:** Task 2.3

---

### Task 3.2: Test Memory Isolation

**Description:** Verify main thread memory doesn't accumulate

**Test Procedure:**
1. Note initial heap usage
2. Process 5 documents sequentially
3. Wait for processing to complete
4. Check heap usage hasn't grown significantly (<50MB growth)

**Completion Criteria:**
- [ ] Main thread heap growth < 50MB after processing 5 documents
- [ ] No memory leak warnings
- [ ] Workers release memory after each document

**Dependencies:** Task 3.1

---

### Task 3.3: Test Worker Crash Recovery

**Description:** Verify pool recovers if a worker crashes

**Test Procedure:**
1. Create/upload a file that causes worker crash (e.g., corrupted file)
2. Verify document marked as 'failed'
3. Upload another valid document
4. Verify second document processes successfully (pool recovered)

**Completion Criteria:**
- [ ] Corrupted file results in status='failed' not server crash
- [ ] Error message logged
- [ ] Subsequent documents still process
- [ ] Pool auto-recovers

**Dependencies:** Task 3.1

---

### Task 3.4: Update Documentation

**Description:** Update project docs to reflect enabled queue

**Files to Update:**
- `CLAUDE.md` - Remove "processing queue temporarily disabled" references

**Completion Criteria:**
- [ ] CLAUDE.md no longer mentions disabled processing queue
- [ ] Any developer guides updated to show worker pool architecture

**Dependencies:** Task 3.1

---

## Task Dependencies Graph

```
Task 1.1 (Install deps)
    │
    ├──▶ Task 1.2 (Type definitions)
    │        │
    │        └──▶ Task 1.3 (Worker pool singleton)
    │                 │
    │                 └──▶ Task 1.4 (Document worker)
    │                          │
    │                          └──▶ Task 1.5 (Update processing queue)
    │                                   │
    └──▶ Task 2.1 (Re-implement PDF)    │
                                        │
                                        └──▶ Task 2.2 (Update index.ts)
                                                 │
                                                 └──▶ Task 2.3 (Basic verification)
                                                          │
                                                          └──▶ Task 3.1 (Large file test)
                                                                   │
                                                                   ├──▶ Task 3.2 (Memory test)
                                                                   ├──▶ Task 3.3 (Crash recovery)
                                                                   └──▶ Task 3.4 (Update docs)
```

---

## Estimated Implementation Order

1. **Task 1.1** - Install dependencies (2 min)
2. **Task 1.2** - TypeScript types (5 min)
3. **Task 1.3** - Worker pool singleton (10 min)
4. **Task 1.4** - Document worker (10 min)
5. **Task 2.1** - Re-implement PDF (5 min) - can run parallel with 1.3/1.4
6. **Task 1.5** - Update processing queue (20 min)
7. **Task 2.2** - Update index.ts (5 min)
8. **Task 2.3** - Basic verification (10 min)
9. **Task 3.1** - Large file tests (15 min)
10. **Task 3.2** - Memory tests (10 min)
11. **Task 3.3** - Crash recovery tests (10 min)
12. **Task 3.4** - Documentation (5 min)

**Total estimated time:** ~1.5-2 hours

---

## Success Criteria (from spec)

- [ ] 50MB PDF processes without crashing server
- [ ] 50MB DOCX processes without crashing server
- [ ] Multiple documents in sequence don't accumulate memory
- [ ] Server heap stays under 2GB during processing
- [ ] Worker crashes are handled gracefully (logged, retried)
