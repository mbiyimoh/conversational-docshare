# Document Processing Memory Optimization

**Date:** 2025-11-24
**Status:** Research Complete - Ready for Implementation Decision

---

## Intent & Assumptions

### User's Goal
Make document processing robust enough that only REALLY big documents (100MB+) would fail, not normal documents (under 50MB which is our configured limit).

### Problem Statement
The document processing queue causes the Node.js backend to crash with OOM (Out of Memory) errors, exceeding the ~4GB V8 heap limit. This happens even with relatively small documents and prevents the application from processing uploaded documents.

### Assumptions
1. Current 50MB file size limit is reasonable for target users (consultants sharing board materials)
2. Most real-world uploads will be 1-20MB (typical business PDFs, DOCX files)
3. Processing should be reliable for files under 50MB, graceful degradation above
4. Solution should not require additional infrastructure (Redis, external services)
5. Implementation time should be minimal (1-2 days)

---

## Pre-reading Log

| File | Key Takeaways |
|------|---------------|
| `backend/src/services/documentProcessor.ts` | Uses dynamic imports for mammoth/xlsx. PDF processing disabled. Each processor buffers entire file with `fs.readFile()`. |
| `backend/src/services/processingQueue.ts` | Single-document processing pattern (good). Processes one doc at a time with 15s interval. Still crashes server. |
| `backend/src/services/documentChunker.ts` | Pure string processing - not the memory issue. Splits text into chunks by section. |
| `backend/src/index.ts` | Processing queue currently DISABLED. Server stable without it. |
| `backend/package.json` | Dependencies: mammoth, xlsx, openai, prisma. No pdf-parse currently. |
| `specs/01-document-processing-algorithms.md` | MAX_FILE_SIZE: 50MB. Notes streaming and worker threads as optimization strategies. |
| `developer-guides/Phase-1-Architecture-Overview.md` | Shows processingQueue as background service. 10s polling interval documented. |

---

## Codebase Map

### Files That Would Change

```
backend/src/
├── services/
│   ├── documentProcessor.ts    ← Move processing logic to worker
│   ├── processingQueue.ts      ← Use workerpool instead of direct calls
│   └── worker/
│       └── documentWorker.ts   ← NEW: Worker thread implementation
├── index.ts                    ← Re-enable processing queue
└── package.json                ← Add workerpool dependency
```

### Blast Radius
- **Low risk**: Changes isolated to processing services
- **No API changes**: Frontend unchanged
- **No schema changes**: Database unchanged
- **Testing**: Will need integration tests for worker behavior

---

## Root Cause Analysis

### Reproduction Steps
1. Start backend server with processing queue enabled
2. Upload a document (even small DOCX files trigger issue)
3. Wait for processing queue to pick up the document
4. Server crashes with: `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`

### Evidence Collected
1. **PDF processing disabled but crash persists** - Issue is not specific to pdf-parse
2. **Single document processing still crashes** - Not a concurrency issue
3. **Server stable when queue disabled** - Confirms processing is the culprit
4. **Dynamic imports don't help** - Memory still accumulates in main process

### Root Cause Hypothesis
The document processing libraries (mammoth.js, xlsx) have high peak memory usage that cannot be released fast enough by V8's garbage collector. Even with single-document processing:

1. `fs.readFile()` loads entire file into memory (up to 50MB)
2. Library parses file, creating additional data structures (2-4x file size)
3. Text extraction creates string copies
4. Peak memory can reach 200-400MB for a single document
5. V8 heap fragmentation prevents timely cleanup
6. If processing starts again before full GC, memory accumulates
7. Eventually exceeds 4GB heap limit

**Key insight**: This is not a "leak" (unreleased references) but rather **high peak memory + slow GC + heap fragmentation**.

---

## Research: Potential Solutions

### Option 1: Worker Thread Pool (workerpool)

**Description**: Use `workerpool` npm package to run document processing in isolated worker threads. Each worker has its own V8 heap, and when it completes, all memory is released.

**Implementation**:
```typescript
// documentWorker.ts
import workerpool from 'workerpool'
import { processDOCX, processXLSX, processMarkdown } from './documentProcessor'

async function processInWorker(filePath: string, mimeType: string) {
  // Processing happens here, in isolated memory space
  return await processDocument(filePath, mimeType)
}

workerpool.worker({ processInWorker })

// processingQueue.ts
import workerpool from 'workerpool'

const pool = workerpool.pool('./worker/documentWorker.ts', {
  maxWorkers: 2,
  workerType: 'thread'
})

async function processDocumentById(documentId: string) {
  const result = await pool.exec('processInWorker', [filePath, mimeType])
  // Worker memory released after completion
}
```

**Pros**:
- Complete memory isolation per document
- Automatic cleanup when worker completes
- Pool management handles concurrency
- Battle-tested library (17k+ GitHub stars)
- 1-2 day implementation

**Cons**:
- Adds ~50KB dependency
- Worker startup has small overhead (~100ms)
- Need to handle serialization of results

**Effort**: 1-2 days

---

### Option 2: Child Process Spawning

**Description**: Use Node.js `child_process` to spawn a separate Node process for each document.

**Implementation**:
```typescript
import { fork } from 'child_process'

function processInChildProcess(filePath: string, mimeType: string): Promise<ProcessedDocument> {
  return new Promise((resolve, reject) => {
    const child = fork('./processWorker.js', [filePath, mimeType])
    child.on('message', resolve)
    child.on('error', reject)
  })
}
```

**Pros**:
- Maximum memory isolation (separate process)
- No external dependencies
- Process crash doesn't affect main server

**Cons**:
- Higher overhead than worker threads
- More complex IPC (inter-process communication)
- File descriptor management needed
- 2-3 day implementation

**Effort**: 2-3 days

---

### Option 3: Streaming Processing

**Description**: Refactor processors to use streaming instead of buffering entire files.

**Pros**:
- Lower peak memory usage
- Could handle arbitrarily large files

**Cons**:
- Not all libraries support streaming (mammoth doesn't)
- Would require library replacements
- Major refactor (1-2 weeks)
- May not solve the core issue (libraries still buffer internally)

**Effort**: 1-2 weeks

---

### Option 4: External Service (Microservice)

**Description**: Move document processing to a separate microservice that can be scaled independently.

**Pros**:
- Complete isolation
- Can scale independently
- Production-grade solution

**Cons**:
- Significant infrastructure complexity
- Overkill for current scale
- Deployment complexity increases
- 1-2 weeks implementation

**Effort**: 1-2 weeks

---

### Option 5: Increase Heap Size

**Description**: Run Node.js with `--max-old-space-size=8192` flag.

**Pros**:
- Zero code changes
- Immediate fix

**Cons**:
- Just delays the problem
- Requires machines with 8GB+ RAM
- Doesn't fix underlying memory usage
- Not a real solution

**Effort**: 5 minutes

---

## Recommendation

### Primary: Worker Thread Pool (workerpool)

**Why workerpool wins:**

1. **Right level of isolation**: Worker threads share less overhead than child processes but provide complete memory isolation
2. **Minimal complexity**: Single npm package, clear API, good TypeScript support
3. **Battle-tested**: Used by webpack, jest, and many production systems
4. **Fast implementation**: Can be done in 1-2 days
5. **No infrastructure changes**: Works with existing setup
6. **Graceful degradation**: If worker crashes, pool recovers automatically

### Implementation Plan

1. **Install workerpool**: `npm install workerpool`
2. **Create worker file**: `backend/src/services/worker/documentWorker.ts`
3. **Modify processingQueue.ts**: Use pool instead of direct calls
4. **Add error handling**: Catch worker crashes, retry logic
5. **Re-enable queue**: Update index.ts
6. **Test with various document sizes**: Verify stability

### Success Criteria

- [ ] 50MB PDF processes without crashing server
- [ ] 50MB DOCX processes without crashing server
- [ ] Multiple documents in sequence don't accumulate memory
- [ ] Server heap stays under 2GB during processing
- [ ] Worker crashes are handled gracefully (logged, retried)

---

## Clarification Questions

None at this time. The research clearly points to **workerpool** as the optimal solution for the stated requirements.

---

## Next Steps

1. **Create spec file** (`specs/document-processing-worker-isolation.md`) with implementation details
2. **Implement** following the plan above
3. **Test** with various document sizes
4. **Re-enable** PDF processing with pdf-parse or alternative library
5. **Monitor** memory usage in production

---

## References

- [workerpool npm](https://www.npmjs.com/package/workerpool) - Worker thread pool library
- [Node.js worker_threads](https://nodejs.org/api/worker_threads.html) - Native API
- [V8 Memory Management](https://v8.dev/blog/trash-talk) - Understanding GC behavior
