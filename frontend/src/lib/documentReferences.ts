/**
 * Document Reference Parser
 *
 * Parses AI assistant messages for document reference markers in the format:
 * [DOC:filename:section-id]
 *
 * Example: "According to the Financial Projections [DOC:financial.pdf:section-3-2], the ROI is 35%"
 */

export interface DocumentReference {
  filename: string
  sectionId: string
  fullMatch: string
  startIndex: number
  endIndex: number
}

export interface ParsedMessage {
  originalContent: string
  parsedContent: string
  references: DocumentReference[]
}

/**
 * Regular expression to match document references:
 * [DOC:filename:section-id]
 *
 * Group 1: filename (can contain letters, numbers, spaces, dots, dashes, underscores)
 * Group 2: section-id (can contain letters, numbers, dashes, underscores)
 */
const DOC_REFERENCE_REGEX = /\[DOC:([a-zA-Z0-9\s._-]+):([a-zA-Z0-9_-]+)\]/g

/**
 * Parses a message for document references
 *
 * @param content - The message content to parse
 * @returns Parsed message with extracted references
 */
export function parseDocumentReferences(content: string): ParsedMessage {
  const references: DocumentReference[] = []
  let match: RegExpExecArray | null

  // Reset regex index
  DOC_REFERENCE_REGEX.lastIndex = 0

  // Extract all references
  while ((match = DOC_REFERENCE_REGEX.exec(content)) !== null) {
    references.push({
      filename: match[1],
      sectionId: match[2],
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return {
    originalContent: content,
    parsedContent: content,
    references,
  }
}

export interface MessagePart {
  type: 'text' | 'reference'
  content: string
  reference?: DocumentReference
}

/**
 * Splits message into parts (text and references) for rendering
 *
 * @param content - The message content
 * @returns Array of message parts ready for rendering
 */
export function splitMessageIntoParts(content: string): MessagePart[] {
  const parsed = parseDocumentReferences(content)

  if (parsed.references.length === 0) {
    // No references, return single text part
    return [{ type: 'text', content }]
  }

  const parts: MessagePart[] = []
  let lastIndex = 0

  // Build array of text and reference parts
  parsed.references.forEach((ref) => {
    // Add text before reference
    if (ref.startIndex > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, ref.startIndex),
      })
    }

    // Add reference part
    parts.push({
      type: 'reference',
      content: ref.filename,
      reference: ref,
    })

    lastIndex = ref.endIndex
  })

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    })
  }

  return parts
}

/**
 * Extracts all unique document filenames from references
 *
 * @param content - The message content
 * @returns Array of unique filenames
 */
export function extractReferencedDocuments(content: string): string[] {
  const parsed = parseDocumentReferences(content)
  const uniqueFilenames = new Set(parsed.references.map(ref => ref.filename))
  return Array.from(uniqueFilenames)
}

/**
 * Checks if content contains any document references
 *
 * @param content - The message content
 * @returns True if references are found
 */
export function hasDocumentReferences(content: string): boolean {
  return DOC_REFERENCE_REGEX.test(content)
}
