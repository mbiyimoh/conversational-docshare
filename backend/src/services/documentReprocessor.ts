import fs from 'fs/promises'
import { prisma } from '../utils/prisma'
import { processDOCX } from './documentProcessor'
import { chunkDocumentBySection } from './documentChunker'

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

  console.warn('[Reprocessor] Starting DOCX reprocessing...')

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
      title: true, // Preserve existing title
    },
  })

  stats.total = docxDocuments.length
  console.warn(`[Reprocessor] Found ${stats.total} DOCX documents to reprocess`)

  if (stats.total === 0) {
    console.warn('[Reprocessor] No documents to reprocess')
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

        // Update document metadata (preserve existing title if set)
        await tx.document.update({
          where: { id: doc.id },
          data: {
            title: doc.title || processed.title, // Keep existing title
            outline: JSON.parse(JSON.stringify(processed.outline)),
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
      console.warn(`[Reprocessor] Reprocessed: ${doc.filename} (${chunks.length} chunks)`)
    } catch (error) {
      stats.failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      stats.errors.push({ documentId: doc.id, error: errorMessage })
      console.error(`[Reprocessor] Failed: ${doc.filename} - ${errorMessage}`)
    }
  }

  // Log summary
  console.warn('[Reprocessor] Reprocessing complete:')
  console.warn(`  - Total: ${stats.total}`)
  console.warn(`  - Successful: ${stats.successful}`)
  console.warn(`  - Failed: ${stats.failed}`)
  console.warn(`  - Skipped: ${stats.skipped}`)

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
    console.warn('[Reprocessor] Reprocessing already completed, skipping')
    return
  }

  // Run in background (don't block server startup)
  setImmediate(async () => {
    try {
      await reprocessAllDocxDocuments()
      console.warn('[Reprocessor] Set DOCX_REPROCESSING_COMPLETE=true to skip on next restart')
    } catch (error) {
      console.error('[Reprocessor] Fatal error during reprocessing:', error)
    }
  })
}
