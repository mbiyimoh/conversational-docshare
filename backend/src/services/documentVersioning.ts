import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError } from '../utils/errors'

/**
 * TipTap document content structure
 */
interface TipTapNode {
  type: 'paragraph' | 'heading' | 'bulletList' | 'orderedList' | 'listItem' | 'codeBlock' | 'blockquote' | 'text'
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: Array<{
    type: 'bold' | 'italic' | 'code' | 'link'
    attrs?: Record<string, unknown>
  }>
}

export interface DocumentContentJSON {
  type: 'doc'
  content: TipTapNode[]
}

/**
 * Create a new version of a document
 *
 * @param documentId - The document to version
 * @param content - New TipTap JSON content
 * @param userId - User making the edit
 * @param changeNote - Optional description of changes
 * @param source - Origin of the edit
 * @param sourceId - Reference ID if from recommendation
 */
export async function createDocumentVersion(
  documentId: string,
  content: DocumentContentJSON,
  userId: string,
  changeNote?: string,
  source: 'manual' | 'recommendation' | 'import' = 'manual',
  sourceId?: string
) {
  // Get current version number
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { currentVersion: true, isEditable: true },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (!document.isEditable) {
    throw new ValidationError('This document type cannot be edited')
  }

  const newVersionNumber = document.currentVersion + 1

  // Create new version and update document in transaction
  const [version, updatedDoc] = await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId,
        version: newVersionNumber,
        content: content as unknown as object,
        editedById: userId,
        changeNote,
        source,
        sourceId,
      },
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { currentVersion: newVersionNumber },
    }),
  ])

  return { version, document: updatedDoc }
}

/**
 * Get all versions for a document
 */
export async function getDocumentVersions(documentId: string) {
  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: 'desc' },
    include: {
      editedBy: {
        select: { id: true, email: true, name: true },
      },
    },
  })

  return versions.map((v: {
    id: string;
    version: number;
    editedById: string | null;
    editedBy: { id: string; email: string; name: string | null } | null;
    changeNote: string | null;
    source: string | null;
    createdAt: Date;
  }) => ({
    id: v.id,
    version: v.version,
    editedById: v.editedById,
    editedByName: v.editedBy?.name || v.editedBy?.email || null,
    changeNote: v.changeNote,
    source: v.source,
    createdAt: v.createdAt,
  }))
}

/**
 * Get specific version content
 */
export async function getVersionContent(documentId: string, versionNumber: number) {
  const version = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: { documentId, version: versionNumber },
    },
    include: {
      editedBy: {
        select: { id: true, email: true, name: true },
      },
    },
  })

  if (!version) {
    throw new NotFoundError('Document version')
  }

  return {
    id: version.id,
    version: version.version,
    content: version.content as unknown as DocumentContentJSON,
    editedById: version.editedById,
    editedByName: version.editedBy?.name || version.editedBy?.email || null,
    changeNote: version.changeNote,
    source: version.source,
    sourceId: version.sourceId,
    createdAt: version.createdAt,
  }
}

/**
 * Rollback to a previous version (non-destructive)
 *
 * Creates a NEW version with the content from the target version
 */
export async function rollbackToVersion(documentId: string, targetVersion: number, userId: string) {
  // Get the target version content
  const targetVersionRecord = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: { documentId, version: targetVersion },
    },
  })

  if (!targetVersionRecord) {
    throw new NotFoundError(`Document version ${targetVersion}`)
  }

  // Create new version with old content
  const result = await createDocumentVersion(
    documentId,
    targetVersionRecord.content as unknown as DocumentContentJSON,
    userId,
    `Rollback to version ${targetVersion}`,
    'manual'
  )

  return result
}

/**
 * Get the current version content for a document
 */
export async function getCurrentVersionContent(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { currentVersion: true },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  return getVersionContent(documentId, document.currentVersion)
}

/**
 * Initialize version 1 for a document from extracted content
 *
 * Called after document processing to create the initial version
 */
export async function initializeDocumentVersion(
  documentId: string,
  content: DocumentContentJSON
): Promise<void> {
  // Check if version 1 already exists
  const existingVersion = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: { documentId, version: 1 },
    },
  })

  if (existingVersion) {
    // Already initialized
    return
  }

  // Create version 1 (no user since it's from processing)
  await prisma.documentVersion.create({
    data: {
      documentId,
      version: 1,
      content: content as unknown as object,
      editedById: null,
      changeNote: 'Initial version from document upload',
      source: 'import',
    },
  })

  // Ensure document is marked as version 1
  await prisma.document.update({
    where: { id: documentId },
    data: { currentVersion: 1 },
  })
}

/**
 * Convert plain text to TipTap JSON format
 */
export function plainTextToTipTap(text: string): DocumentContentJSON {
  const lines = text.split('\n')
  const content: TipTapNode[] = []

  for (const line of lines) {
    if (line.trim() === '') {
      // Empty paragraph
      content.push({
        type: 'paragraph',
        content: [],
      })
    } else {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: line,
          },
        ],
      })
    }
  }

  return {
    type: 'doc',
    content,
  }
}

/**
 * Convert TipTap JSON to plain text
 */
export function tipTapToPlainText(doc: DocumentContentJSON): string {
  const lines: string[] = []

  function extractText(nodes: TipTapNode[]): void {
    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        lines.push(node.text)
      } else if (node.content) {
        extractText(node.content)
        // Add newline after block elements
        if (['paragraph', 'heading', 'listItem'].includes(node.type)) {
          lines.push('\n')
        }
      }
    }
  }

  if (doc.content) {
    extractText(doc.content)
  }

  return lines.join('').trim()
}
