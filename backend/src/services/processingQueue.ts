import { prisma } from '../utils/prisma'
import { Prisma } from '@prisma/client'
import { chunkDocumentBySection } from './documentChunker'
import { getDocumentWorkerPool, processInChildProcess, isDevelopment } from './worker/workerPool'
import type { ProcessedDocument } from './documentProcessor'
import type { ProcessedDocumentWithChunks } from './worker/processDocumentChild'

const MAX_RETRIES = 3
const WORKER_TIMEOUT = 120000 // 2 minutes per document
const AUTO_RETRY_FAILED_INTERVAL = 60000 // Check for failed docs to auto-retry every 60s
const MAX_AUTO_RETRIES = 2 // Auto-retry failed docs up to 2 times before giving up

/**
 * Check if an error is retryable (transient errors that may succeed on retry).
 * Permanent errors (file not found, invalid format) should NOT be retried.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    // Permanent errors - don't retry these
    if (
      msg.includes('not found') ||
      msg.includes('invalid file') ||
      msg.includes('unsupported') ||
      msg.includes('corrupt') ||
      msg.includes('permission denied')
    ) {
      return false
    }
  }
  // Default: retry all other errors (timeouts, network issues, unknown errors)
  return true
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
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      // Check if error is retryable (transient vs permanent)
      const shouldRetry = isRetryableError(error) && retries <= MAX_RETRIES

      if (shouldRetry) {
        // Use exponential backoff with jitter: base * 2^retry * (0.5 + random 0-0.5)
        // This prevents "thundering herd" when multiple docs retry simultaneously
        const baseDelay = 1000 * Math.pow(2, retries - 1)
        const jitter = 0.5 + Math.random() * 0.5 // 0.5 to 1.0 multiplier
        const delay = Math.min(Math.floor(baseDelay * jitter), 4000)
        console.warn(`⚠️ Retryable error, retry ${retries}/${MAX_RETRIES} for document ${documentId} in ${delay}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else if (!isRetryableError(error)) {
        // Permanent error, don't retry
        console.warn(`❌ Permanent error for document ${documentId}, not retrying: ${lastError.message}`)
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
 * Auto-retry failed documents that haven't exceeded max auto-retry attempts.
 * This runs on a separate interval to give failed docs a second chance.
 */
async function autoRetryFailedDocuments(): Promise<number> {
  // Find failed documents that haven't been retried too many times
  // We track retries by counting how many times processingError has been updated
  const failedDocs = await prisma.document.findMany({
    where: {
      status: 'failed',
      // Only retry docs that failed recently (within last hour)
      uploadedAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
    orderBy: { uploadedAt: 'asc' },
    take: MAX_AUTO_RETRIES, // Limit batch size
  })

  let retriedCount = 0

  for (const doc of failedDocs) {
    // Check if error message suggests it's been auto-retried before
    const retryMatch = doc.processingError?.match(/\[auto-retry (\d+)\]/)
    const previousRetries = retryMatch ? parseInt(retryMatch[1], 10) : 0

    if (previousRetries >= MAX_AUTO_RETRIES) {
      continue // Skip - already hit max auto-retries
    }

    // Reset to pending with retry count in error field for tracking
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: 'pending',
        processingError: `[auto-retry ${previousRetries + 1}] Previous error: ${doc.processingError}`,
      },
    })

    // Delete existing chunks (in case of partial failure)
    await prisma.documentChunk.deleteMany({
      where: { documentId: doc.id },
    })

    console.warn(`🔄 Auto-retrying failed document ${doc.id} (attempt ${previousRetries + 1}/${MAX_AUTO_RETRIES})`)
    retriedCount++
  }

  return retriedCount
}

/**
 * Start processing queue worker - processes one document per interval
 */
export function startProcessingQueue(intervalMs: number = 5000): NodeJS.Timeout {
  console.warn('📋 Starting document processing queue (worker pool mode)...')

  let isProcessing = false

  // Main processing queue - runs every 5 seconds (reduced from 15s)
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

  // Auto-retry queue - runs every 60 seconds to retry failed docs
  setInterval(async () => {
    try {
      const retriedCount = await autoRetryFailedDocuments()
      if (retriedCount > 0) {
        console.warn(`🔄 Auto-retry queue: ${retriedCount} failed documents queued for retry`)
      }
    } catch (error) {
      console.error('Error in auto-retry queue:', (error as Error).message)
    }
  }, AUTO_RETRY_FAILED_INTERVAL)

  return interval
}
