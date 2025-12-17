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
 * Regular expression to match legacy markdown citation links:
 * [CITE](cite://encoded-filename/encoded-section-id)
 *
 * This handles any messages that might have been saved with the old format
 * Group 1: URL-encoded filename
 * Group 2: URL-encoded section-id
 */
const LEGACY_CITE_REGEX = /\[CITE\]\(cite:\/\/([^/]+)\/([^)]+)\)/g

/**
 * Parses a message for document references
 *
 * @param content - The message content to parse
 * @returns Parsed message with extracted references
 */
export function parseDocumentReferences(content: string): ParsedMessage {
  const references: DocumentReference[] = []
  let match: RegExpExecArray | null

  // Reset regex indices
  DOC_REFERENCE_REGEX.lastIndex = 0
  LEGACY_CITE_REGEX.lastIndex = 0

  // Extract all [DOC:filename:section-id] references
  while ((match = DOC_REFERENCE_REGEX.exec(content)) !== null) {
    references.push({
      filename: match[1],
      sectionId: match[2],
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Also extract legacy [CITE](cite://...) references
  while ((match = LEGACY_CITE_REGEX.exec(content)) !== null) {
    references.push({
      filename: decodeURIComponent(match[1]),
      sectionId: decodeURIComponent(match[2]),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Sort by position in content
  references.sort((a, b) => a.startIndex - b.startIndex)

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
  DOC_REFERENCE_REGEX.lastIndex = 0
  return DOC_REFERENCE_REGEX.test(content)
}

/**
 * Convert [DOC:filename:section-id] citations to markdown links
 * for processing by ReactMarkdown with custom link components
 *
 * @param content - The message content
 * @returns Content with citations converted to cite:// links
 */
export function convertCitationsToMarkdownLinks(content: string): string {
  DOC_REFERENCE_REGEX.lastIndex = 0
  return content.replace(DOC_REFERENCE_REGEX, (_match, filename, sectionId) => {
    const encodedFilename = encodeURIComponent(filename)
    const encodedSectionId = encodeURIComponent(sectionId)
    return `[CITE](cite://${encodedFilename}/${encodedSectionId})`
  })
}

/**
 * Custom URL transform for ReactMarkdown that allows cite:// protocol.
 * React-markdown v10 sanitizes URLs by default and blocks custom protocols.
 * This transform preserves cite:// URLs while applying default sanitization to others.
 *
 * @param url - The URL to transform
 * @returns The transformed URL (or empty string to block)
 */
export function citationUrlTransform(url: string): string {
  // Allow cite:// protocol for our citation links
  if (url.startsWith('cite://')) {
    return url
  }
  // For other URLs, apply default behavior (allow http, https, mailto, tel)
  const protocols = ['http', 'https', 'mailto', 'tel']
  const protocol = url.split(':')[0]?.toLowerCase()
  if (protocols.includes(protocol)) {
    return url
  }
  // Block other protocols (javascript:, data:, etc.) for security
  return ''
}
