/**
 * Document Reference Utilities
 *
 * Handles conversion and parsing of document citations in the format:
 * [DOC:filename:section-id]
 *
 * Example: "According to the Financial Projections [DOC:financial.pdf:section-3-2], the ROI is 35%"
 */

/**
 * Parsed citation URL data
 */
export interface ParsedCitation {
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
 * @param href - The cite:// URL (e.g., "cite://filename/section-id")
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

  const [encodedFilename, encodedSectionId] = pathPart.split('/')
  if (!encodedFilename || !encodedSectionId) {
    return null
  }

  return {
    filename: decodeURIComponent(encodedFilename),
    sectionId: decodeURIComponent(encodedSectionId),
  }
}
