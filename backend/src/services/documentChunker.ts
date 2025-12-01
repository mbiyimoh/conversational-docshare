import { ProcessedDocument } from './documentProcessor'

export interface DocumentChunk {
  content: string
  sectionId: string | null
  sectionTitle: string | null
  chunkIndex: number
  startChar: number
  endChar: number
}

const CHUNK_SIZE = 1000 // ~1000 characters per chunk
const CHUNK_OVERLAP = 200 // 200 character overlap between chunks

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  let startChar = 0
  let chunkIndex = 0

  // Handle empty text
  if (!text || text.trim().length === 0) {
    return chunks
  }

  // If text is smaller than chunk size, return single chunk
  if (text.length <= chunkSize) {
    chunks.push({
      content: text.trim(),
      sectionId: null,
      sectionTitle: null,
      chunkIndex: 0,
      startChar: 0,
      endChar: text.length,
    })
    return chunks
  }

  while (startChar < text.length) {
    const endChar = Math.min(startChar + chunkSize, text.length)
    const content = text.substring(startChar, endChar).trim()

    if (content.length > 0) {
      chunks.push({
        content,
        sectionId: null,
        sectionTitle: null,
        chunkIndex: chunkIndex++,
        startChar,
        endChar,
      })
    }

    // Move start position, accounting for overlap
    // Ensure we always make forward progress to avoid infinite loops
    const nextStart = endChar - overlap
    if (nextStart <= startChar) {
      // If overlap would cause us to go backwards or stay in place, move forward instead
      startChar = endChar
    } else {
      startChar = nextStart
    }

    // Stop if we've reached the end
    if (endChar >= text.length) break
  }

  return chunks
}

/**
 * Chunk document by sections with overlapping chunks
 */
export function chunkDocumentBySection(doc: ProcessedDocument): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  let globalChunkIndex = 0

  // For each section, find its content and chunk it
  for (let i = 0; i < doc.outline.length; i++) {
    const section = doc.outline[i]
    const nextSection = doc.outline[i + 1]

    // Find section content in full text
    const sectionStart = doc.fullText.indexOf(section.title)
    if (sectionStart === -1) continue

    const sectionEnd = nextSection
      ? doc.fullText.indexOf(nextSection.title, sectionStart + section.title.length)
      : doc.fullText.length

    const sectionContent = doc.fullText.substring(
      sectionStart,
      sectionEnd === -1 ? doc.fullText.length : sectionEnd
    ).trim()

    // Chunk this section's content
    const sectionChunks = chunkText(sectionContent)

    // Add section metadata to chunks
    for (const chunk of sectionChunks) {
      chunks.push({
        ...chunk,
        sectionId: section.id,
        sectionTitle: section.title,
        chunkIndex: globalChunkIndex++,
        startChar: sectionStart + chunk.startChar,
        endChar: sectionStart + chunk.endChar,
      })
    }
  }

  // If no chunks were created (sections not found in text), chunk the entire document
  if (chunks.length === 0) {
    return chunkText(doc.fullText).map((chunk, index) => ({
      ...chunk,
      chunkIndex: index,
    }))
  }

  return chunks
}
