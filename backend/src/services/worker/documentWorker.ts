import workerpool from 'workerpool'
import type { ProcessedDocument } from '../documentProcessor'

/**
 * Worker-side processing function.
 *
 * Runs in isolated V8 heap - all memory released when worker completes.
 * Uses type-safe dynamic import to load processing module.
 */
async function processDocument(filePath: string, mimeType: string): Promise<ProcessedDocument> {
  const processorModule = (await import('../documentProcessor')) as typeof import('../documentProcessor')

  if (!processorModule.processDocument) {
    throw new Error('processDocument function not found in documentProcessor module')
  }

  return processorModule.processDocument(filePath, mimeType)
}

workerpool.worker({
  processDocument,
})
