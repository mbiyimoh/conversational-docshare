/**
 * Script to reprocess documents to fix truncated section titles.
 *
 * Usage: npx ts-node scripts/reprocess-documents.ts
 *
 * This marks all 'ready' documents as 'pending', deletes their existing chunks,
 * and lets the processing queue reprocess them with the fixed outline extraction.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.warn('Finding documents to reprocess...')

  // Get all processed documents (completed or failed status)
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { status: 'completed' },
        { status: 'failed' }
      ]
    },
    include: {
      project: {
        select: { name: true }
      }
    }
  })

  console.warn(`Found ${documents.length} documents to reprocess`)

  for (const doc of documents) {
    console.warn(`\nReprocessing: ${doc.originalName || doc.filename}`)
    console.warn(`  Project: ${doc.project.name}`)

    // Delete existing chunks
    const deletedChunks = await prisma.documentChunk.deleteMany({
      where: { documentId: doc.id }
    })
    console.warn(`  Deleted ${deletedChunks.count} existing chunks`)

    // Reset to pending status
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: 'pending',
        processingError: null
      }
    })
    console.warn(`  Status reset to 'pending'`)
  }

  console.warn('\nAll documents queued for reprocessing.')
  console.warn('The processing queue will pick them up automatically.')
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
