import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors'
import path from 'path'
import fs from 'fs/promises'

/**
 * Upload a document to a project
 */
export async function uploadDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const file = req.file

  if (!file) {
    throw new ValidationError('No file uploaded')
  }

  // Verify project exists and user owns it
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    // Clean up uploaded file
    await fs.unlink(file.path).catch(() => {
      // Ignore errors
    })
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    // Clean up uploaded file
    await fs.unlink(file.path).catch(() => {
      // Ignore errors
    })
    throw new AuthorizationError('You do not own this project')
  }

  // Create document record
  const document = await prisma.document.create({
    data: {
      projectId,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      status: 'pending',
    },
  })

  res.status(201).json({
    document: {
      id: document.id,
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      status: document.status,
      uploadedAt: document.uploadedAt,
    },
  })
}

/**
 * Get all documents for a project
 */
export async function getProjectDocuments(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project exists and user owns it
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Get documents
  const documents = await prisma.document.findMany({
    where: { projectId },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      title: true,
      pageCount: true,
      wordCount: true,
      uploadedAt: true,
      processedAt: true,
    },
  })

  res.json({ documents })
}

/**
 * Get a single document
 */
export async function getDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: {
        select: {
          id: true,
          ownerId: true,
        },
      },
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this document')
  }

  res.json({
    document: {
      id: document.id,
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      status: document.status,
      processingError: document.processingError,
      title: document.title,
      outline: document.outline,
      pageCount: document.pageCount,
      wordCount: document.wordCount,
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt,
    },
  })
}

/**
 * Delete a document
 */
export async function deleteDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this document')
  }

  // Delete file from filesystem
  try {
    await fs.unlink(document.filePath)
  } catch (error) {
    // File might already be deleted, continue anyway
    console.warn(`Failed to delete file ${document.filePath}:`, error)
  }

  // Delete document from database (cascades to chunks and citations)
  await prisma.document.delete({
    where: { id: documentId },
  })

  res.status(204).send()
}

/**
 * Get document file download
 */
export async function downloadDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this document')
  }

  // Check if file exists
  try {
    await fs.access(document.filePath)
  } catch {
    throw new NotFoundError('Document file')
  }

  // Set headers for download
  res.setHeader('Content-Type', document.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`)
  res.setHeader('Content-Length', document.fileSize.toString())

  // Stream file
  res.sendFile(path.resolve(document.filePath))
}

/**
 * Retry processing a failed document
 */
export async function retryDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this document')
  }

  if (document.status !== 'failed') {
    return res.status(400).json({
      error: { message: 'Only failed documents can be retried' }
    })
  }

  // Reset document to pending status so the queue picks it up
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'pending',
      processingError: null,
    },
  })

  // Also delete any existing chunks (in case of partial failure)
  await prisma.documentChunk.deleteMany({
    where: { documentId },
  })

  res.json({ message: 'Document queued for reprocessing' })
}
