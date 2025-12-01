/* eslint-disable no-console */
/**
 * Child process script for document processing in development mode.
 * This runs in a separate Node.js process to isolate memory-intensive PDF processing.
 * ALL heavy operations (parsing + chunking) happen here to avoid OOM in main process.
 *
 * Usage: npx tsx src/services/worker/processDocumentChild.ts <filePath> <mimeType> <outputPath>
 * Output: Writes ProcessedDocumentWithChunks JSON to outputPath file
 */

import { writeFileSync } from 'fs'
import { processDocument } from '../documentProcessor'
import { chunkDocumentBySection, DocumentChunk } from '../documentChunker'

export interface ProcessedDocumentWithChunks {
  title: string
  outline: Array<{ id: string; title: string; level: number; position: number }>
  pageCount?: number
  wordCount: number
  chunks: DocumentChunk[]
  // Note: fullText is NOT included to avoid OOM when transferring large strings
}

async function main() {
  const [, , filePath, mimeType, outputPath] = process.argv

  if (!filePath || !mimeType || !outputPath) {
    console.log(JSON.stringify({ success: false, error: 'Missing arguments' }))
    process.exit(1)
  }

  try {
    // Process document (extract text, outline, etc.)
    const processed = await processDocument(filePath, mimeType)

    // Chunk the document while we still have it in memory
    const chunks = chunkDocumentBySection(processed)

    // Create result WITHOUT fullText to avoid OOM in main process
    const result: ProcessedDocumentWithChunks = {
      title: processed.title,
      outline: processed.outline,
      pageCount: processed.pageCount,
      wordCount: processed.wordCount,
      chunks,
    }

    // Write result to temp file
    writeFileSync(outputPath, JSON.stringify(result), 'utf-8')

    // Signal success with minimal output
    console.log(JSON.stringify({ success: true }))
    process.exit(0)
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }))
    process.exit(1)
  }
}

main()
