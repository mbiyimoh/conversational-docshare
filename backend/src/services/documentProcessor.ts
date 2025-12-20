import fs from 'fs/promises'
import crypto from 'crypto'
import TurndownService from 'turndown'
import { FileProcessingError } from '../utils/errors'

export interface DocumentSection {
  id: string
  title: string
  level: number
  position: number
  content?: string
}

export interface ProcessedDocument {
  title: string
  outline: DocumentSection[]
  fullText: string
  pageCount?: number
  wordCount: number
}

/**
 * Generate stable section ID from title and position
 */
function generateSectionId(title: string, level: number, position: number): string {
  const content = [title.toLowerCase().trim(), level.toString(), position.toString()].join('|')
  const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
  return `section-${hash}`
}

/**
 * Extract outline from text (shared logic for PDF/DOCX)
 */
function extractOutlineFromText(text: string): DocumentSection[] {
  const lines = text.split('\n')
  const outline: DocumentSection[] = []
  let position = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-Z]/.test(trimmed)
    // Match multi-level numbering like "1.", "10.2", "10.2.3" or single letter "A."
    const startsWithNumber = /^[\d.]+\s/.test(trimmed) || /^[A-Z]\.\s/.test(trimmed)

    if (isAllCaps || startsWithNumber) {
      // Determine level based on numbering depth
      // "1." = level 1, "10.2" = level 2, "10.2.3" = level 3, all-caps = level 1
      let level = 1
      if (startsWithNumber) {
        const numberMatch = trimmed.match(/^([\d.]+)\s/)
        if (numberMatch) {
          // Count dots to determine level (1. = level 1, 1.2 = level 2, etc.)
          level = (numberMatch[1].match(/\./g) || []).length + 1
        } else {
          level = 2 // Letter prefix like "A."
        }
      }

      // Keep the FULL title including numbering for display
      // Only strip leading/trailing whitespace
      const sectionTitle = trimmed

      outline.push({
        id: generateSectionId(sectionTitle, level, position),
        title: sectionTitle,
        level,
        position: position++,
      })
    }
  }

  if (outline.length === 0) {
    outline.push({
      id: generateSectionId('Document Content', 1, 0),
      title: 'Document Content',
      level: 1,
      position: 0,
    })
  }

  return outline
}

/**
 * Turndown configuration optimized for document viewing
 * - ATX headings (# style) for clear hierarchy
 * - Dash bullets for consistent list rendering
 * - Fenced code blocks for any code content
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx', // # Heading style
    bulletListMarker: '-', // - for unordered lists
    codeBlockStyle: 'fenced', // ```code``` style
    emDelimiter: '*', // *italic*
    strongDelimiter: '**', // **bold**
  })

  // Skip table conversion (focus on lists/headings per spec)
  turndown.remove('table')

  // Clean up excessive whitespace in output
  turndown.addRule('cleanParagraphs', {
    filter: 'p',
    replacement: (content) => {
      const trimmed = content.trim()
      return trimmed ? `\n\n${trimmed}\n\n` : ''
    },
  })

  return turndown
}

// Singleton instance for reuse
let turndownInstance: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = createTurndownService()
  }
  return turndownInstance
}

/**
 * Clean up markdown output from Turndown
 * - Remove excessive blank lines (3+ → 2)
 * - Trim trailing whitespace from lines
 * - Ensure single newline at end
 */
function cleanupMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ \t]+$/gm, '') // Trim trailing whitespace per line
    .replace(/^\s+/, '') // Trim leading whitespace
    .replace(/\s+$/, '\n') // Single trailing newline
}

/**
 * Extract title from markdown content
 * Priority: First H1 heading > First line > "Untitled"
 */
function extractTitleFromMarkdown(markdown: string): string {
  // Try to find first H1 heading
  const h1Match = markdown.match(/^#\s+(.+)$/m)
  if (h1Match) {
    return h1Match[1].trim().substring(0, 100)
  }

  // Fall back to first non-empty line
  const firstLine = markdown.split('\n').find((line) => line.trim())
  if (firstLine) {
    return firstLine.trim().substring(0, 100)
  }

  return 'Untitled'
}

/**
 * Extract document outline from markdown headings
 * Parses # heading syntax and builds section hierarchy
 */
function extractOutlineFromMarkdown(markdown: string): DocumentSection[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const outline: DocumentSection[] = []
  let match
  let position = 0

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length // Number of # characters
    const headingTitle = match[2].trim()

    outline.push({
      id: generateSectionId(headingTitle, level, position),
      title: headingTitle,
      level,
      position: position++,
    })
  }

  // Fall back to existing text-based outline detection if no markdown headings
  if (outline.length === 0) {
    return extractOutlineFromText(markdown)
  }

  return outline
}

/**
 * Process PDF document using pdftotext (poppler-utils) for text extraction.
 * This is MUCH more memory-efficient than any JavaScript PDF library.
 * Falls back to pdf-parse if pdftotext is not available.
 */
export async function processPDF(filePath: string): Promise<ProcessedDocument> {
  try {
    // Try native pdftotext first (from poppler-utils) - very memory efficient
    const { execSync } = await import('child_process')

    try {
      // Use pdftotext for text extraction - minimal memory usage
      const text = execSync(`pdftotext -layout "${filePath}" -`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB max output
        timeout: 60000, // 60 second timeout
      })

      // Get page count using pdfinfo
      let pageCount: number | undefined
      try {
        const pdfinfo = execSync(`pdfinfo "${filePath}"`, { encoding: 'utf-8' })
        const pagesMatch = pdfinfo.match(/Pages:\s*(\d+)/)
        if (pagesMatch) {
          pageCount = parseInt(pagesMatch[1], 10)
        }
      } catch {
        // pdfinfo failed, pageCount stays undefined
      }

      const title = text.split('\n')[0]?.trim().substring(0, 100) || 'Untitled PDF'
      const outline = extractOutlineFromText(text)

      return {
        title,
        outline,
        fullText: text,
        pageCount,
        wordCount: text.split(/\s+/).length,
      }
    } catch {
      // pdftotext not available or failed, fall back to pdf-parse
      // eslint-disable-next-line no-console
      console.log('pdftotext not available, falling back to pdf-parse')

      const pdfParseModule = await import('pdf-parse')
      const pdfParse = pdfParseModule.default || pdfParseModule

      const buffer = await fs.readFile(filePath)
      const data = await pdfParse(buffer)

      const text = data.text
      const title = text.split('\n')[0]?.trim().substring(0, 100) || 'Untitled PDF'

      const outline = extractOutlineFromText(text)

      return {
        title,
        outline,
        fullText: text,
        pageCount: data.numpages,
        wordCount: text.split(/\s+/).length,
      }
    }
  } catch (error) {
    throw new FileProcessingError(`Failed to process PDF: ${(error as Error).message}`)
  }
}

/**
 * Process DOCX document with formatting preservation
 *
 * Pipeline: DOCX → HTML (mammoth) → Markdown (turndown) → ProcessedDocument
 *
 * Note: We intentionally do NOT regenerate embeddings after reprocessing.
 * Markdown formatting doesn't significantly change semantic meaning for RAG purposes.
 */
export async function processDOCX(filePath: string): Promise<ProcessedDocument> {
  try {
    // Dynamic import - only loads mammoth when processing DOCX
    const mammoth = (await import('mammoth')).default

    const buffer = await fs.readFile(filePath)

    // Convert to HTML instead of raw text (preserves formatting)
    const htmlResult = await mammoth.convertToHtml({ buffer })
    const html = htmlResult.value

    // Convert HTML to Markdown
    const turndown = getTurndown()
    let markdown = turndown.turndown(html)

    // Clean up markdown (excessive newlines, trailing whitespace)
    markdown = cleanupMarkdown(markdown)

    // Extract title from first heading or first line
    const title = extractTitleFromMarkdown(markdown)

    // Extract outline from markdown headings
    const outline = extractOutlineFromMarkdown(markdown)

    return {
      title,
      outline,
      fullText: markdown, // Now contains formatted markdown
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
    }
  } catch (error) {
    throw new FileProcessingError(`Failed to process DOCX: ${(error as Error).message}`)
  }
}

/**
 * Process XLSX document - uses dynamic import
 */
export async function processXLSX(filePath: string): Promise<ProcessedDocument> {
  try {
    // Dynamic import - only loads xlsx when processing spreadsheets
    const xlsx = await import('xlsx')

    const buffer = await fs.readFile(filePath)
    const workbook = xlsx.read(buffer)

    const title = workbook.SheetNames[0] || 'Untitled Spreadsheet'

    const outline: DocumentSection[] = workbook.SheetNames.map((sheetName, index) => ({
      id: generateSectionId(sheetName, 1, index),
      title: sheetName,
      level: 1,
      position: index,
    }))

    let fullText = ''
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const sheetText = xlsx.utils.sheet_to_txt(sheet)
      fullText += `\n\n=== ${sheetName} ===\n\n${sheetText}`
    }

    return {
      title,
      outline,
      fullText: fullText.trim(),
      wordCount: fullText.split(/\s+/).length,
    }
  } catch (error) {
    throw new FileProcessingError(`Failed to process XLSX: ${(error as Error).message}`)
  }
}

/**
 * Process Markdown document
 */
export async function processMarkdown(filePath: string): Promise<ProcessedDocument> {
  try {
    const text = await fs.readFile(filePath, 'utf-8')

    const titleMatch = text.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : text.split('\n')[0]?.trim() || 'Untitled'

    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    const outline: DocumentSection[] = []
    let match
    let position = 0

    while ((match = headingRegex.exec(text)) !== null) {
      const level = match[1].length
      const headingTitle = match[2].trim()

      outline.push({
        id: generateSectionId(headingTitle, level, position),
        title: headingTitle,
        level,
        position: position++,
      })
    }

    if (outline.length === 0) {
      outline.push({
        id: generateSectionId('Document Content', 1, 0),
        title: 'Document Content',
        level: 1,
        position: 0,
      })
    }

    return {
      title,
      outline,
      fullText: text,
      wordCount: text.split(/\s+/).length,
    }
  } catch (error) {
    throw new FileProcessingError(`Failed to process Markdown: ${(error as Error).message}`)
  }
}

/**
 * Process document based on MIME type
 */
export async function processDocument(filePath: string, mimeType: string): Promise<ProcessedDocument> {
  if (mimeType === 'application/pdf') {
    return processPDF(filePath)
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return processDOCX(filePath)
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return processXLSX(filePath)
  } else if (mimeType === 'text/markdown' || mimeType === 'text/plain') {
    return processMarkdown(filePath)
  } else {
    throw new FileProcessingError(`Unsupported file type: ${mimeType}`)
  }
}
