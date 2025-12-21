/**
 * Document Reference Utilities
 *
 * Handles conversion and parsing of document citations in the format:
 * [DOC:filename:section-id]
 *
 * Supports two citation modes:
 * 1. Numbered pills: [1], [2], etc. with citation block at end
 * 2. Legacy full text: Clickable text showing document + section name
 *
 * Example: "According to the Financial Projections [DOC:financial.pdf:section-3-2], the ROI is 35%"
 */

/**
 * Parsed citation URL data
 */
export interface ParsedCitation {
  filename: string
  sectionId: string
  /** Citation number (if using numbered mode) */
  number?: number
}

/**
 * Collected citation data for numbered mode
 */
export interface CollectedCitation {
  number: number
  filename: string
  sectionId: string
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
 * Convert [DOC:filename:section-id] citations to numbered references [1], [2], etc.
 * Also collects all citations for display in a citation block.
 *
 * @param content - The message content
 * @returns Object with processed content and collected citations
 */
export function convertCitationsToNumbered(content: string): {
  content: string
  citations: CollectedCitation[]
} {
  DOC_REFERENCE_REGEX.lastIndex = 0
  const citations: CollectedCitation[] = []
  const seenCitations = new Map<string, number>() // Track unique citations

  const processedContent = content.replace(
    DOC_REFERENCE_REGEX,
    (_match, filename, sectionId) => {
      // Create a unique key for this citation
      const citationKey = `${filename}:${sectionId}`

      // Check if we've seen this citation before
      let citationNumber: number
      if (seenCitations.has(citationKey)) {
        citationNumber = seenCitations.get(citationKey)!
      } else {
        // New citation - assign next number
        citationNumber = citations.length + 1
        seenCitations.set(citationKey, citationNumber)
        citations.push({
          number: citationNumber,
          filename,
          sectionId,
        })
      }

      // Return numbered citation link
      const encodedFilename = encodeURIComponent(filename)
      const encodedSectionId = encodeURIComponent(sectionId)
      return `[${citationNumber}](cite://${encodedFilename}/${encodedSectionId}/${citationNumber})`
    }
  )

  return { content: processedContent, citations }
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

/**
 * Parse a cite:// URL into filename and sectionId components.
 * Used by components rendering citation links to extract document info.
 *
 * Supports both formats:
 * - cite://filename/section-id (legacy)
 * - cite://filename/section-id/number (numbered)
 *
 * @param href - The cite:// URL
 * @returns Parsed citation data, or null if not a valid citation URL
 */
export function parseCitationUrl(href: string): ParsedCitation | null {
  if (!href?.startsWith('cite://')) {
    return null
  }

  const [, pathPart] = href.split('cite://')
  if (!pathPart) {
    return null
  }

  const parts = pathPart.split('/')
  if (parts.length < 2) {
    return null
  }

  const [encodedFilename, encodedSectionId, numberStr] = parts

  if (!encodedFilename || !encodedSectionId) {
    return null
  }

  const result: ParsedCitation = {
    filename: decodeURIComponent(encodedFilename),
    sectionId: decodeURIComponent(encodedSectionId),
  }

  // Parse citation number if present
  if (numberStr) {
    const number = parseInt(numberStr, 10)
    if (!isNaN(number)) {
      result.number = number
    }
  }

  return result
}
