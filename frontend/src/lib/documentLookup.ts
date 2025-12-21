/**
 * Document Lookup Utility
 *
 * Provides O(1) filename -> documentId resolution for citation navigation.
 * Caches document metadata from share link endpoints.
 */

import { api } from './api'

export interface DocumentInfo {
  id: string
  filename: string // Display name (originalName || filename)
  internalFilename?: string // Internal storage filename for citation matching
  title: string
  mimeType: string
  outline: Array<{ id: string; title: string; level: number; position: number }>
  status: string
}

interface DocumentCache {
  byFilename: Map<string, DocumentInfo>
  byId: Map<string, DocumentInfo>
  byTitle: Map<string, DocumentInfo>
  slug: string
  loadedAt: number
}

// Cache storage
let documentCache: DocumentCache | null = null

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

/**
 * Initialize document lookup cache for a share link
 * @param slug - The share link slug
 * @param force - Force refresh even if cache exists
 */
export async function initDocumentLookup(
  slug: string,
  force = false
): Promise<void> {
  // Return cached data if valid and same slug
  if (
    documentCache &&
    documentCache.slug === slug &&
    !force &&
    Date.now() - documentCache.loadedAt < CACHE_TTL
  ) {
    return
  }

  try {
    const { documents } = await api.getShareLinkDocuments(slug)


    // Build lookup maps
    const byFilename = new Map<string, DocumentInfo>()
    const byId = new Map<string, DocumentInfo>()
    const byTitle = new Map<string, DocumentInfo>()

    for (const doc of documents) {
      // Map by display filename (for UI lookups)
      byFilename.set(doc.filename.toLowerCase(), doc)

      // Also map without extension for flexibility
      const nameWithoutExt = doc.filename.replace(/\.[^.]+$/, '').toLowerCase()
      if (!byFilename.has(nameWithoutExt)) {
        byFilename.set(nameWithoutExt, doc)
      }

      // CRITICAL: Also map by internal filename for citation resolution
      // Citations use internal filenames (e.g., "1766337527304_631ff5d36a408576.docx")
      // but the display shows original names (e.g., "Board_Memo.docx")
      if (doc.internalFilename && doc.internalFilename !== doc.filename) {
        byFilename.set(doc.internalFilename.toLowerCase(), doc)
        // Also map internal filename without extension
        const internalWithoutExt = doc.internalFilename.replace(/\.[^.]+$/, '').toLowerCase()
        if (!byFilename.has(internalWithoutExt)) {
          byFilename.set(internalWithoutExt, doc)
        }
      }

      // Map by ID
      byId.set(doc.id, doc)

      // Map by title
      if (doc.title) {
        byTitle.set(doc.title.toLowerCase(), doc)
      }
    }

    documentCache = {
      byFilename,
      byId,
      byTitle,
      slug,
      loadedAt: Date.now(),
    }
  } catch (error) {
    console.error('Failed to initialize document lookup:', error)
    throw error
  }
}

/**
 * Look up document by filename
 * Used for resolving [DOC:filename:section-id] citations
 *
 * @param filename - The filename from the citation
 * @returns DocumentInfo or null if not found
 */
export function lookupDocumentByFilename(filename: string): DocumentInfo | null {
  if (!documentCache) {
    console.warn('Document lookup not initialized. Call initDocumentLookup first.')
    return null
  }

  // Try exact match first (case-insensitive)
  const exactMatch = documentCache.byFilename.get(filename.toLowerCase())
  if (exactMatch) {
    return exactMatch
  }

  // Try without extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '').toLowerCase()
  const withoutExtMatch = documentCache.byFilename.get(nameWithoutExt)
  if (withoutExtMatch) {
    return withoutExtMatch
  }

  // Try title match as fallback
  const titleMatch = documentCache.byTitle.get(filename.toLowerCase())
  if (titleMatch) {
    return titleMatch
  }

  return null
}

/**
 * Look up document by ID
 *
 * @param id - The document ID
 * @returns DocumentInfo or null if not found
 */
export function lookupDocumentById(id: string): DocumentInfo | null {
  if (!documentCache) {
    console.warn('Document lookup not initialized. Call initDocumentLookup first.')
    return null
  }

  return documentCache.byId.get(id) || null
}

/**
 * Get all cached documents
 *
 * @returns Array of all documents in cache
 */
export function getAllDocuments(): DocumentInfo[] {
  if (!documentCache) {
    return []
  }

  return Array.from(documentCache.byId.values())
}

/**
 * Verify a section exists in a document
 *
 * @param documentId - The document ID
 * @param sectionId - The section ID to verify
 * @returns true if section exists, false otherwise
 */
export function verifySectionExists(documentId: string, sectionId: string): boolean {
  const doc = lookupDocumentById(documentId)
  if (!doc) {
    return false
  }

  return doc.outline.some((section) => section.id === sectionId)
}

/**
 * Clear the document cache
 */
export function clearDocumentCache(): void {
  documentCache = null
}

/**
 * Check if cache is initialized for a given slug
 *
 * @param slug - The share link slug
 * @returns true if cache exists for this slug
 */
export function isCacheInitialized(slug: string): boolean {
  return (
    documentCache !== null &&
    documentCache.slug === slug &&
    Date.now() - documentCache.loadedAt < CACHE_TTL
  )
}

/**
 * Get document display name by filename (internal or original)
 * Used for fallback when section lookup fails but we still need the document name.
 *
 * @param filename - The filename from the citation (could be internal or display name)
 * @returns Display filename or null if not found
 */
export function getDocumentDisplayName(filename: string): string | null {
  const doc = lookupDocumentByFilename(filename)
  if (!doc) {
    return null
  }
  // doc.filename is already the display name (originalName || internal_filename from API)
  return doc.filename
}

/**
 * Get section title by filename and section ID
 * Used for displaying human-readable section names in citations
 *
 * @param filename - The document filename
 * @param sectionId - The section ID to look up
 * @returns Object with document title and section title, or null if not found
 */
export function getSectionInfo(
  filename: string,
  sectionId: string
): { documentTitle: string; sectionTitle: string } | null {
  const doc = lookupDocumentByFilename(filename)
  if (!doc) {
    return null
  }

  const section = doc.outline.find((s) => s.id === sectionId)
  if (!section) {
    return null
  }

  return {
    // Use filename (which is already originalName || internal_filename from API)
    // NOT doc.title - that often contains the first section heading, not the document name
    documentTitle: doc.filename,
    sectionTitle: section.title,
  }
}
