import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'
import {
  createDocumentVersion,
  getDocumentVersions,
  getVersionContent,
  rollbackToVersion,
  getCurrentVersionContent,
  tipTapToPlainText,
  type DocumentContentJSON,
} from '../services/documentVersioning'
import { queueEmbeddingRegeneration } from '../services/embeddingService'

/**
 * Get document for editing
 * GET /api/documents/:documentId/edit
 */
export async function getDocumentForEdit(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can edit documents')
  }
  if (!document.isEditable) {
    throw new ValidationError('This document type cannot be edited (PDF)')
  }

  // Get current version content
  let content = null
  try {
    const versionContent = await getCurrentVersionContent(documentId)
    content = versionContent?.content || null
  } catch {
    // No version exists yet - document may not have been initialized
    content = null
  }

  res.json({
    document: {
      id: document.id,
      filename: document.filename,
      isEditable: document.isEditable,
      currentVersion: document.currentVersion,
    },
    content,
  })
}

/**
 * Save new document version
 * POST /api/documents/:documentId/versions
 */
export async function saveDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params
  const { content, changeNote } = req.body

  // Validate content structure
  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) {
    throw new ValidationError('Invalid TipTap content format')
  }

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can edit documents')
  }

  // Create new version
  const { version } = await createDocumentVersion(
    documentId,
    content,
    req.user.userId,
    changeNote,
    'manual'
  )

  // Queue embedding regeneration (async, non-blocking)
  const plainText = tipTapToPlainText(content)
  queueEmbeddingRegeneration(documentId, plainText).catch((err) => {
    console.error('Failed to queue embedding regeneration:', err)
  })

  res.json({
    version: {
      id: version.id,
      version: version.version,
      createdAt: version.createdAt,
    },
  })
}

/**
 * List all document versions
 * GET /api/documents/:documentId/versions
 */
export async function listDocumentVersions(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can view version history')
  }

  const versions = await getDocumentVersions(documentId)

  res.json({
    versions,
    currentVersion: document.currentVersion,
  })
}

/**
 * Get specific version content
 * GET /api/documents/:documentId/versions/:versionNum
 */
export async function getDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId, versionNum } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can view versions')
  }

  const version = await getVersionContent(documentId, parseInt(versionNum, 10))
  if (!version) throw new NotFoundError('Version')

  res.json({ version })
}

/**
 * Rollback to a previous version
 * POST /api/documents/:documentId/rollback/:versionNum
 */
export async function rollbackDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId, versionNum } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can rollback')
  }

  const result = await rollbackToVersion(documentId, parseInt(versionNum, 10), req.user.userId)

  // Queue embedding regeneration for the rolled-back content
  const plainText = tipTapToPlainText(result.version.content as unknown as DocumentContentJSON)
  queueEmbeddingRegeneration(documentId, plainText).catch((err) => {
    console.error('Failed to queue embedding regeneration:', err)
  })

  res.json({
    newVersion: result.version.version,
    content: result.version.content,
  })
}
