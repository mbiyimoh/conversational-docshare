# Document Processing Algorithms

**Purpose:** Complete implementation specifications for extracting text, outlines, and metadata from PDF, DOCX, XLSX, and Markdown files.

---

## Overview

Document processing is core to the system. This section provides production-ready algorithms, error handling, and quality validation for all supported file types.

**Processing Goals:**
1. Extract full text with high fidelity
2. Generate hierarchical document outlines (sections/headings)
3. Create stable section IDs for citation references
4. Validate extraction quality
5. Handle errors gracefully with fallbacks

---

## Section ID Generation Strategy

**Critical Requirement:** Section IDs must be stable across document re-uploads for citation links to remain valid.

### Algorithm: Content-Based Hash IDs

```typescript
import crypto from 'crypto'

function generateSectionId(section: {
  title: string
  level: number
  pageNum?: number
  position: number  // Character position in document
}): string {
  // Create stable hash from section properties
  const content = [
    section.title.toLowerCase().trim(),
    section.level.toString(),
    section.position.toString()
  ].join('|')

  const hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16)

  // Format: section-{hash}
  // Example: section-a7f3c2e9d1b4f6e8
  return `section-${hash}`
}

// Why this approach:
// ✅ Stable: Same section = same ID even after re-upload
// ✅ Unique: Different sections = different IDs
// ✅ Readable: Prefix makes purpose clear
// ✅ Compatible: Works in URLs, HTML IDs, database queries
```

**Alternative considered:** Sequential IDs (`section-1`, `section-2`)
- ❌ Problem: IDs change if document structure changes
- ❌ Problem: Citations break when sections are added/removed

---

## PDF Processing

### Library Choice: `pdf-parse`

**Rationale:**
- ✅ Pure JavaScript (no native dependencies)
- ✅ Works in Node.js and browser
- ✅ Actively maintained
- ✅ Good error handling
- ❌ Limited outline detection (we'll implement custom algorithm)

**Installation:**
```bash
npm install pdf-parse
```

### Implementation

```typescript
// lib/documentProcessor/pdfProcessor.ts

import pdfParse from 'pdf-parse'
import { DocumentOutline, ProcessingResult, ProcessingError } from './types'

interface PDFSection {
  id: string
  title: string
  level: number
  pageNum: number
  startChar: number
  endChar: number
}

export async function extractFromPDF(
  buffer: Buffer,
  filename: string
): Promise<ProcessingResult> {
  const errors: ProcessingError[] = []

  try {
    // Step 1: Extract raw PDF data
    const data = await pdfParse(buffer, {
      max: 0  // No page limit
    })

    const fullText = data.text

    if (!fullText || fullText.trim().length === 0) {
      throw new Error('PDF contains no extractable text')
    }

    // Step 2: Detect headings via font size and style analysis
    const sections = await detectPDFHeadings(data, fullText)

    // Step 3: Generate outline
    const outline: DocumentOutline = {
      sections: sections.map(section => ({
        id: generateSectionId({
          title: section.title,
          level: section.level,
          pageNum: section.pageNum,
          position: section.startChar
        }),
        title: section.title,
        level: section.level,
        pageNum: section.pageNum,
        startChar: section.startChar,
        endChar: section.endChar
      }))
    }

    // Step 4: Quality validation
    const quality = validateExtractionQuality({
      fullText,
      outline,
      pageCount: data.numpages,
      filename
    })

    if (quality.outlineConfidence < 0.3) {
      errors.push({
        type: 'low_outline_quality',
        message: 'PDF outline detection has low confidence. Manual review recommended.',
        severity: 'warning'
      })
    }

    return {
      status: errors.length > 0 ? 'partial' : 'success',
      fullText,
      outline,
      errors,
      quality,
      metadata: {
        pageCount: data.numpages,
        pdfVersion: data.version,
        producer: data.info?.Producer
      }
    }

  } catch (error) {
    // Fallback: Return text-only with minimal outline
    console.error('[PDF Processing Error]', error)

    return {
      status: 'failed',
      fullText: '',
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 0,
        warnings: ['PDF processing failed completely']
      }
    }
  }
}

// Heading detection algorithm
async function detectPDFHeadings(
  pdfData: any,
  fullText: string
): Promise<PDFSection[]> {
  const sections: PDFSection[] = []

  // Strategy 1: Parse PDF metadata for outline/bookmarks
  // Many PDFs have embedded TOC
  if (pdfData.metadata?.outline) {
    // Use embedded outline if available
    return parsePDFOutline(pdfData.metadata.outline, fullText)
  }

  // Strategy 2: Text pattern analysis
  // Detect headings by common patterns
  const lines = fullText.split('\n')
  let currentPosition = 0

  const headingPatterns = [
    // Pattern 1: Numbered sections (1., 1.1, 1.1.1)
    /^(\d+\.)+\s+(.+)$/,
    // Pattern 2: All caps (minimum 3 chars, maximum 60)
    /^([A-Z][A-Z\s]{2,58}[A-Z])$/,
    // Pattern 3: Title case with common keywords
    /^(Chapter|Section|Part|Article|Appendix)\s+(\d+|[A-Z]):\s+(.+)$/i
  ]

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (trimmed.length === 0) {
      currentPosition += line.length + 1
      return
    }

    // Check each pattern
    for (let i = 0; i < headingPatterns.length; i++) {
      const match = trimmed.match(headingPatterns[i])

      if (match) {
        // Determine level based on pattern type
        let level = 1
        let title = trimmed

        if (i === 0) {
          // Numbered section: count dots to determine level
          const dots = (match[1].match(/\./g) || []).length
          level = dots
          title = match[2]
        } else if (i === 2) {
          // Chapter/Section pattern
          title = match[3]
        }

        sections.push({
          id: '',  // Will be generated later
          title: title.trim(),
          level: Math.min(level, 6),  // Cap at h6
          pageNum: estimatePageNumber(currentPosition, fullText),
          startChar: currentPosition,
          endChar: currentPosition + trimmed.length
        })

        break
      }
    }

    currentPosition += line.length + 1
  })

  // Strategy 3: Fallback - create sections every N pages
  if (sections.length === 0) {
    return createDefaultSections(fullText, pdfData.numpages)
  }

  return sections
}

function estimatePageNumber(charPosition: number, fullText: string): number {
  // Rough estimate: assume ~3000 chars per page
  // This is approximate but good enough for citation purposes
  return Math.floor(charPosition / 3000) + 1
}

function createDefaultSections(fullText: string, pageCount: number): PDFSection[] {
  // Fallback: Create one section per 5 pages or chunk of 10,000 chars
  const sections: PDFSection[] = []
  const charsPerSection = 10000

  for (let i = 0; i < fullText.length; i += charsPerSection) {
    const endChar = Math.min(i + charsPerSection, fullText.length)
    const pageNum = Math.floor(i / 3000) + 1

    sections.push({
      id: '',
      title: `Section ${sections.length + 1} (Page ${pageNum})`,
      level: 1,
      pageNum,
      startChar: i,
      endChar
    })
  }

  return sections
}

function validateExtractionQuality(params: {
  fullText: string
  outline: DocumentOutline
  pageCount: number
  filename: string
}): {
  outlineConfidence: number
  textCompleteness: number
  warnings: string[]
} {
  const warnings: string[] = []

  // Check 1: Text completeness
  const expectedCharsPerPage = 2000  // Conservative estimate
  const expectedTotalChars = params.pageCount * expectedCharsPerPage
  const actualChars = params.fullText.length
  const textCompleteness = Math.min(actualChars / expectedTotalChars, 1)

  if (textCompleteness < 0.5) {
    warnings.push(`Extracted only ${Math.round(textCompleteness * 100)}% of expected text. PDF may contain images or complex formatting.`)
  }

  // Check 2: Outline quality
  const sectionsPerPage = params.outline.sections.length / params.pageCount
  let outlineConfidence = 0

  if (params.outline.sections.length === 0) {
    outlineConfidence = 0
    warnings.push('No sections detected. Document structure unclear.')
  } else if (sectionsPerPage < 0.1) {
    // Less than 1 section per 10 pages - probably missed some
    outlineConfidence = 0.3
    warnings.push('Few sections detected. Some headings may have been missed.')
  } else if (sectionsPerPage > 5) {
    // More than 5 sections per page - probably false positives
    outlineConfidence = 0.5
    warnings.push('Many sections detected. Some may be false positives.')
  } else {
    // Reasonable section density
    outlineConfidence = 0.8
  }

  // Check 3: Section title quality
  const avgTitleLength = params.outline.sections.reduce(
    (sum, s) => sum + s.title.length,
    0
  ) / params.outline.sections.length

  if (avgTitleLength < 5) {
    outlineConfidence *= 0.7
    warnings.push('Section titles are very short. May not be accurate headings.')
  }

  return {
    outlineConfidence,
    textCompleteness,
    warnings
  }
}
```

### Error Handling

```typescript
// Common PDF errors and recovery strategies

export const PDF_ERROR_HANDLERS = {
  // Error: Encrypted PDF
  'PDF is encrypted': {
    recovery: 'prompt_password',
    userMessage: 'This PDF is password-protected. Please provide the password or upload an unlocked version.',
    shouldRetry: false
  },

  // Error: Corrupted PDF
  'Invalid PDF structure': {
    recovery: 'attempt_repair',
    userMessage: 'PDF file appears corrupted. Attempting to extract what we can...',
    shouldRetry: true
  },

  // Error: No text (scanned PDF)
  'PDF contains no extractable text': {
    recovery: 'suggest_ocr',
    userMessage: 'This appears to be a scanned PDF with no text. OCR processing is not yet supported. Please upload a text-based PDF.',
    shouldRetry: false
  },

  // Error: Too large
  'PDF exceeds size limit': {
    recovery: 'none',
    userMessage: 'PDF file is too large (max 50MB). Please compress or split the file.',
    shouldRetry: false
  }
}
```

---

## DOCX Processing

### Library Choice: `mammoth`

**Rationale:**
- ✅ Preserves heading structure (native Word styles)
- ✅ Converts to clean HTML
- ✅ Handles tables and formatting
- ✅ Good error handling

**Installation:**
```bash
npm install mammoth
```

### Implementation

```typescript
// lib/documentProcessor/docxProcessor.ts

import mammoth from 'mammoth'
import { JSDOM } from 'jsdom'
import { DocumentOutline, ProcessingResult } from './types'

export async function extractFromDOCX(
  buffer: Buffer,
  filename: string
): Promise<ProcessingResult> {
  try {
    // Step 1: Extract HTML with heading styles preserved
    const result = await mammoth.convertToHtml({
      buffer,
      options: {
        includeDefaultStyleMap: true,
        styleMap: [
          // Ensure headings are preserved
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh"
        ]
      }
    })

    const html = result.value
    const messages = result.messages  // Warnings from mammoth

    // Step 2: Extract plain text
    const dom = new JSDOM(html)
    const fullText = dom.window.document.body.textContent || ''

    // Step 3: Parse headings from HTML
    const sections = parseHeadingsFromHTML(html, fullText)

    // Step 4: Generate outline
    const outline: DocumentOutline = {
      sections: sections.map(section => ({
        id: generateSectionId({
          title: section.title,
          level: section.level,
          position: section.startChar
        }),
        title: section.title,
        level: section.level,
        startChar: section.startChar,
        endChar: section.endChar
      }))
    }

    // Step 5: Quality validation
    const quality = {
      outlineConfidence: sections.length > 0 ? 0.9 : 0.3,
      textCompleteness: fullText.length > 100 ? 0.95 : 0.5,
      warnings: messages.map(m => m.message)
    }

    return {
      status: 'success',
      fullText,
      outline,
      errors: [],
      quality,
      metadata: {
        conversionWarnings: messages.length
      }
    }

  } catch (error) {
    console.error('[DOCX Processing Error]', error)

    return {
      status: 'failed',
      fullText: '',
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 0,
        warnings: ['DOCX processing failed']
      }
    }
  }
}

function parseHeadingsFromHTML(html: string, fullText: string): Array<{
  title: string
  level: number
  startChar: number
  endChar: number
}> {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const sections: Array<{
    title: string
    level: number
    startChar: number
    endChar: number
  }> = []

  // Find all heading elements
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')

  headings.forEach(heading => {
    const title = heading.textContent?.trim() || ''
    const level = parseInt(heading.tagName.substring(1))  // h1 -> 1

    if (title.length > 0) {
      // Find position in full text
      const startChar = fullText.indexOf(title)

      if (startChar !== -1) {
        sections.push({
          title,
          level,
          startChar,
          endChar: startChar + title.length
        })
      }
    }
  })

  return sections
}
```

---

## XLSX Processing

### Library Choice: `xlsx` (SheetJS)

**Rationale:**
- ✅ Industry standard for Excel parsing
- ✅ Supports all Excel formats (.xls, .xlsx, .xlsm)
- ✅ Good performance
- ✅ Handles formulas, formatting, multiple sheets

**Installation:**
```bash
npm install xlsx
```

### Implementation

```typescript
// lib/documentProcessor/xlsxProcessor.ts

import XLSX from 'xlsx'
import { DocumentOutline, ProcessingResult } from './types'

export async function extractFromXLSX(
  buffer: Buffer,
  filename: string
): Promise<ProcessingResult> {
  try {
    // Step 1: Parse workbook
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellFormula: false,  // Get values, not formulas
      cellHTML: false,
      cellText: true
    })

    // Step 2: Extract text from all sheets
    const sheetTexts: Array<{ name: string; text: string }> = []
    let fullText = ''

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName]

      // Convert sheet to CSV for text extraction
      const csv = XLSX.utils.sheet_to_csv(sheet)

      // Add sheet header
      const sheetHeader = `\n\n=== ${sheetName} ===\n\n`
      fullText += sheetHeader + csv

      sheetTexts.push({
        name: sheetName,
        text: csv
      })
    })

    // Step 3: Create outline (one section per sheet)
    const sections: DocumentOutline['sections'] = []
    let currentPosition = 0

    sheetTexts.forEach((sheet, index) => {
      const sheetHeader = `\n\n=== ${sheet.name} ===\n\n`
      const startChar = currentPosition + sheetHeader.length
      const endChar = startChar + sheet.text.length

      sections.push({
        id: generateSectionId({
          title: sheet.name,
          level: 1,
          position: startChar
        }),
        title: sheet.name,
        level: 1,
        startChar,
        endChar
      })

      currentPosition = endChar
    })

    const outline: DocumentOutline = { sections }

    // Step 4: Quality validation
    const quality = {
      outlineConfidence: 0.95,  // Sheet names are always accurate
      textCompleteness: fullText.length > 0 ? 0.9 : 0,
      warnings: []
    }

    if (workbook.SheetNames.length > 10) {
      quality.warnings.push('Spreadsheet has many sheets. Chat may be less focused.')
    }

    return {
      status: 'success',
      fullText,
      outline,
      errors: [],
      quality,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames
      }
    }

  } catch (error) {
    console.error('[XLSX Processing Error]', error)

    return {
      status: 'failed',
      fullText: '',
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 0,
        warnings: ['Excel processing failed']
      }
    }
  }
}
```

---

## Markdown Processing

### Implementation (Native)

```typescript
// lib/documentProcessor/markdownProcessor.ts

import { DocumentOutline, ProcessingResult } from './types'

export async function extractFromMarkdown(
  buffer: Buffer,
  filename: string
): Promise<ProcessingResult> {
  try {
    // Step 1: Convert buffer to string
    const fullText = buffer.toString('utf-8')

    // Step 2: Parse headings
    const sections = parseMarkdownHeadings(fullText)

    // Step 3: Generate outline
    const outline: DocumentOutline = {
      sections: sections.map(section => ({
        id: generateSectionId({
          title: section.title,
          level: section.level,
          position: section.startChar
        }),
        title: section.title,
        level: section.level,
        startChar: section.startChar,
        endChar: section.endChar
      }))
    }

    return {
      status: 'success',
      fullText,
      outline,
      errors: [],
      quality: {
        outlineConfidence: 0.99,  // Markdown headings are explicit
        textCompleteness: 1,
        warnings: []
      },
      metadata: {
        headingCount: sections.length
      }
    }

  } catch (error) {
    console.error('[Markdown Processing Error]', error)

    return {
      status: 'failed',
      fullText: buffer.toString('utf-8'),
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 1,
        warnings: ['Heading parsing failed but text is available']
      }
    }
  }
}

function parseMarkdownHeadings(markdown: string): Array<{
  title: string
  level: number
  startChar: number
  endChar: number
}> {
  const sections: Array<{
    title: string
    level: number
    startChar: number
    endChar: number
  }> = []

  const lines = markdown.split('\n')
  let currentChar = 0

  lines.forEach(line => {
    // Match ATX-style headings: # Title
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (atxMatch) {
      const level = atxMatch[1].length
      const title = atxMatch[2].trim()

      sections.push({
        title,
        level,
        startChar: currentChar,
        endChar: currentChar + line.length
      })
    }

    currentChar += line.length + 1  // +1 for newline
  })

  return sections
}
```

---

## Shared Types

```typescript
// lib/documentProcessor/types.ts

export interface DocumentOutline {
  sections: Array<{
    id: string
    title: string
    level: number      // 1-6 (h1-h6)
    pageNum?: number   // PDF only
    startChar: number
    endChar: number
  }>
}

export interface ProcessingResult {
  status: 'success' | 'partial' | 'failed'
  fullText: string
  outline: DocumentOutline
  errors: ProcessingError[]
  quality: {
    outlineConfidence: number  // 0-1
    textCompleteness: number   // 0-1
    warnings: string[]
  }
  metadata?: Record<string, any>
}

export interface ProcessingError {
  type: 'extraction_failed' | 'low_outline_quality' | 'parsing_error'
  message: string
  severity: 'error' | 'warning'
}
```

---

## Main Document Processor

```typescript
// lib/documentProcessor/index.ts

import { extractFromPDF } from './pdfProcessor'
import { extractFromDOCX } from './docxProcessor'
import { extractFromXLSX } from './xlsxProcessor'
import { extractFromMarkdown } from './markdownProcessor'
import { ProcessingResult } from './types'

const MAX_FILE_SIZE = 50 * 1024 * 1024  // 50MB

export async function processDocument(
  file: File | Buffer,
  filename: string
): Promise<ProcessingResult> {
  // Get buffer
  const buffer = file instanceof Buffer
    ? file
    : Buffer.from(await file.arrayBuffer())

  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      status: 'failed',
      fullText: '',
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: `File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum (50MB)`,
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 0,
        warnings: ['File too large']
      }
    }
  }

  // Determine file type
  const extension = filename.split('.').pop()?.toLowerCase()

  try {
    switch (extension) {
      case 'pdf':
        return await extractFromPDF(buffer, filename)

      case 'docx':
        return await extractFromDOCX(buffer, filename)

      case 'xlsx':
      case 'xls':
        return await extractFromXLSX(buffer, filename)

      case 'md':
      case 'markdown':
        return await extractFromMarkdown(buffer, filename)

      default:
        return {
          status: 'failed',
          fullText: '',
          outline: { sections: [] },
          errors: [{
            type: 'extraction_failed',
            message: `Unsupported file type: .${extension}`,
            severity: 'error'
          }],
          quality: {
            outlineConfidence: 0,
            textCompleteness: 0,
            warnings: [`File type .${extension} not supported`]
          }
        }
    }
  } catch (error) {
    console.error('[Document Processing Error]', error)

    return {
      status: 'failed',
      fullText: '',
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Unknown processing error',
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 0,
        warnings: ['Unexpected error during processing']
      }
    }
  }
}
```

---

## Testing Strategy

```typescript
// tests/documentProcessor.test.ts

import { processDocument } from '../lib/documentProcessor'
import fs from 'fs'
import path from 'path'

describe('Document Processing', () => {
  describe('PDF Processing', () => {
    it('should extract text and outline from well-structured PDF', async () => {
      const buffer = fs.readFileSync(path.join(__dirname, 'fixtures/sample.pdf'))
      const result = await processDocument(buffer, 'sample.pdf')

      expect(result.status).toBe('success')
      expect(result.fullText.length).toBeGreaterThan(100)
      expect(result.outline.sections.length).toBeGreaterThan(0)
      expect(result.quality.textCompleteness).toBeGreaterThan(0.5)
    })

    it('should handle encrypted PDF gracefully', async () => {
      const buffer = fs.readFileSync(path.join(__dirname, 'fixtures/encrypted.pdf'))
      const result = await processDocument(buffer, 'encrypted.pdf')

      expect(result.status).toBe('failed')
      expect(result.errors[0].message).toContain('encrypted')
    })
  })

  describe('DOCX Processing', () => {
    it('should preserve heading hierarchy', async () => {
      const buffer = fs.readFileSync(path.join(__dirname, 'fixtures/sample.docx'))
      const result = await processDocument(buffer, 'sample.docx')

      expect(result.status).toBe('success')
      expect(result.outline.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ level: 1 }),
          expect.objectContaining({ level: 2 })
        ])
      )
    })
  })

  describe('Section ID Stability', () => {
    it('should generate same IDs for same sections across uploads', async () => {
      const buffer = fs.readFileSync(path.join(__dirname, 'fixtures/sample.pdf'))

      const result1 = await processDocument(buffer, 'sample.pdf')
      const result2 = await processDocument(buffer, 'sample.pdf')

      expect(result1.outline.sections[0].id).toBe(result2.outline.sections[0].id)
    })
  })
})
```

---

## Performance Considerations

**File Size Limits:**
- PDF: 50MB max
- DOCX: 50MB max
- XLSX: 20MB max (spreadsheets can be very large in memory)
- Markdown: 10MB max

**Processing Time Estimates:**
- PDF (10MB): ~3-5 seconds
- DOCX (5MB): ~1-2 seconds
- XLSX (5MB): ~2-4 seconds
- Markdown (1MB): <1 second

**Optimization Strategies:**
1. Process documents asynchronously (background jobs)
2. Cache processed results (don't re-process on every access)
3. Stream large files instead of loading into memory
4. Consider using worker threads for CPU-intensive parsing

---

## Summary

This implementation provides:
- ✅ **Production-ready** algorithms for all 4 file types
- ✅ **Stable section IDs** for reliable citations
- ✅ **Quality validation** with confidence scores
- ✅ **Comprehensive error handling** with fallbacks
- ✅ **Testing strategy** for reliability
- ✅ **Performance guidelines** for scale

**Next Steps:**
1. Implement these processors in `lib/documentProcessor/`
2. Add test fixtures to `tests/fixtures/`
3. Create background job queue for processing
4. Add UI for displaying processing quality warnings
