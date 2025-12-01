import { prisma } from '../utils/prisma'
import { getOpenAI } from '../utils/openai'
import { retryWithBackoff } from '../utils/retry'
import { LLMError } from '../utils/errors'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await retryWithBackoff(
      async () => {
        return await getOpenAI().embeddings.create({
          model: EMBEDDING_MODEL,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        })
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        shouldRetry: (error: Error) => {
          // Retry on rate limit or network errors
          return error.message.includes('rate') || error.message.includes('network')
        },
      }
    )

    return response.data[0].embedding
  } catch (error) {
    throw new LLMError(`Failed to generate embedding: ${(error as Error).message}`)
  }
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    try {
      const response = await retryWithBackoff(
        async () => {
          return await getOpenAI().embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
          })
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
        }
      )

      embeddings.push(...response.data.map((d: { embedding: number[] }) => d.embedding))
    } catch (error) {
      throw new LLMError(`Failed to generate embeddings for batch: ${(error as Error).message}`)
    }
  }

  return embeddings
}

/**
 * Generate and store embeddings for all chunks of a document
 */
export async function embedDocumentChunks(documentId: string): Promise<void> {
  // Get all chunks for this document
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' },
  })

  if (chunks.length === 0) {
    return
  }

  // Generate embeddings in batches
  const texts = chunks.map((c) => c.content)
  const embeddings = await generateEmbeddings(texts)

  // Update chunks with embeddings
  // Note: Direct embedding assignment not supported by Prisma, need raw SQL
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = embeddings[i]

    await prisma.$executeRaw`
      UPDATE document_chunks
      SET embedding = ${JSON.stringify(embedding)}::vector
      WHERE id = ${chunk.id}
    `
  }

  console.warn(`✅ Generated ${embeddings.length} embeddings for document ${documentId}`)
}

/**
 * Search for similar chunks using vector similarity
 */
export async function searchSimilarChunks(
  projectId: string,
  query: string,
  limit: number = 5
): Promise<Array<{ chunkId: string; content: string; similarity: number; sectionTitle: string | null }>> {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query)

  // Search for similar chunks using cosine similarity
  const results = await prisma.$queryRaw<
    Array<{
      id: string
      content: string
      section_title: string | null
      similarity: number
    }>
  >`
    SELECT
      dc.id,
      dc.content,
      dc.section_title,
      1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM document_chunks dc
    INNER JOIN documents d ON dc.document_id = d.id
    WHERE d.project_id = ${projectId}
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `

  return results.map((r) => ({
    chunkId: r.id,
    content: r.content,
    similarity: r.similarity,
    sectionTitle: r.section_title,
  }))
}
