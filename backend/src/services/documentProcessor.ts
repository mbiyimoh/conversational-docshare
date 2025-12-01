import fs from 'fs/promises'
import crypto from 'crypto'
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
    const startsWithNumber = /^\d+\./.test(trimmed) || /^[A-Z]\./.test(trimmed)

    if (isAllCaps || startsWithNumber) {
      const level = startsWithNumber ? 2 : 1
      const sectionTitle = trimmed.replace(/^\d+\.\s*/, '').replace(/^[A-Z]\.\s*/, '')

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
 * Process DOCX document - uses dynamic import
 */
export async function processDOCX(filePath: string): Promise<ProcessedDocument> {
  try {
    // Dynamic import - only loads mammoth when processing DOCX
    const mammoth = (await import('mammoth')).default

    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value

    const firstLine = text.split('\n')[0]?.trim() || 'Untitled'
    const title = firstLine.length > 100 ? firstLine.substring(0, 100) : firstLine

    const outline = extractOutlineFromText(text)

    return {
      title,
      outline,
      fullText: text,
      wordCount: text.split(/\s+/).length,
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
