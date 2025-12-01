import { prisma } from '../utils/prisma'
import { chunkDocumentBySection } from './documentChunker'
import { getDocumentWorkerPool, processInChildProcess, isDevelopment } from './worker/workerPool'
import type { ProcessedDocument } from './documentProcessor'
import type { ProcessedDocumentWithChunks } from './worker/processDocumentChild'

const MAX_RETRIES = 1
const WORKER_TIMEOUT = 120000 // 2 minutes per document

/**
 * Check if an error is a workerpool timeout error.
 */
function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('timeout') ||
      error.name === 'TimeoutError' ||
      error.constructor?.name === 'TimeoutError'
    )
  }
  return false
}

/**
 * Process document - in development uses child process with pre-chunking,
 * in production uses worker pool.
 * Both methods isolate memory-intensive PDF processing from the main thread.
 */
async function executeDocumentProcessing(
  filePath: string,
  mimeType: string
): Promise<ProcessedDocumentWithChunks> {
  const pool = getDocumentWorkerPool()

  if (pool) {
    // Production: use worker pool (thread-based)
    // NOTE: Worker pool returns ProcessedDocument with fullText, chunking happens here.
    // For very large documents (100MB+), this could still cause OOM. If needed, update
    // documentWorker.js to also do chunking inside the worker thread.
    const processed = await pool.exec<ProcessedDocument>(
      'processDocument',
      [filePath, mimeType],
      { timeout: WORKER_TIMEOUT }
    )
    const chunks = chunkDocumentBySection(processed)
    return {
      title: processed.title,
      outline: processed.outline,
      pageCount: processed.pageCount,
      wordCount: processed.wordCount,
      chunks,
    }
  } else if (isDevelopment()) {
    // Development: use child process (process-based isolation)
    // Child process does both parsing AND chunking to avoid OOM in main process
    return await processInChildProcess(filePath, mimeType, WORKER_TIMEOUT)
  } else {
    throw new Error('No document processing method available')
  }
}

/**
 * Process a single document using isolated worker thread (production) or main thread (development)
 */
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
      // Execute processing (worker pool in production, child process in development)
      // Result now includes pre-computed chunks to avoid OOM in main thread
      const processed = await executeDocumentProcessing(
        document.filePath,
        document.mimeType
      )

      // Use transaction to ensure atomicity
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

        if (processed.chunks.length > 0) {
          await tx.documentChunk.createMany({
            data: processed.chunks.map((chunk) => ({
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

      console.warn(`✅ Processed document ${documentId}: ${processed.chunks.length} chunks created`)
      return // Success - exit retry loop
    } catch (error) {
      lastError = error as Error
      retries++

      // Only retry timeout errors - other errors are likely permanent
      const shouldRetry = isTimeoutError(error) && retries <= MAX_RETRIES

      if (shouldRetry) {
        console.warn(`⚠️ Timeout, retry ${retries}/${MAX_RETRIES} for document ${documentId}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
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

/**
 * Process ONE pending document at a time
 */
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

/**
 * Start processing queue worker - processes one document per interval
 */
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
