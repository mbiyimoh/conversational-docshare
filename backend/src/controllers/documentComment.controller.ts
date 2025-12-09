import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError } from '../utils/errors'

/**
 * Create a new comment on a document
 * POST /api/documents/:documentId/comments
 *
 * Authorization: Public (for collaborators via share link)
 */
export async function createComment(req: Request, res: Response) {
  const { documentId } = req.params
  const {
    conversationId,
    chunkId,
    startOffset,
    endOffset,
    highlightedText,
    content,
    viewerEmail,
    viewerName,
  } = req.body

  // Validate required fields
  if (!chunkId || startOffset === undefined || endOffset === undefined || !highlightedText || !content) {
    throw new ValidationError('Missing required fields: chunkId, startOffset, endOffset, highlightedText, content')
  }

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  // Validate chunk exists and belongs to this document
  const chunk = await prisma.documentChunk.findFirst({
    where: {
      id: chunkId,
      documentId: documentId,
    },
    select: { id: true, content: true },
  })

  if (!chunk) {
    throw new ValidationError('Invalid chunk ID for this document')
  }

  // Validate offsets are within chunk bounds
  if (startOffset < 0 || endOffset > chunk.content.length || startOffset >= endOffset) {
    throw new ValidationError('Invalid text offsets - must be within chunk content bounds')
  }

  // Verify highlighted text matches chunk content at specified offsets
  const actualText = chunk.content.substring(startOffset, endOffset)
  if (actualText !== highlightedText) {
    throw new ValidationError('Highlighted text does not match chunk content at specified offsets')
  }

  // Create comment
  const comment = await prisma.documentComment.create({
    data: {
      documentId,
      conversationId: conversationId || null,
      chunkId,
      startOffset,
      endOffset,
      highlightedText,
      content,
      viewerEmail: viewerEmail || null,
      viewerName: viewerName || null,
      status: 'pending',
    },
  })

  res.status(201).json({
    comment: {
      id: comment.id,
      documentId: comment.documentId,
      chunkId: comment.chunkId,
      startOffset: comment.startOffset,
      endOffset: comment.endOffset,
      highlightedText: comment.highlightedText,
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt,
    },
  })
}

/**
 * Get all comments for a document
 * GET /api/documents/:documentId/comments
 *
 * Query params:
 * - conversationId (optional): Filter to specific conversation
 * - status (optional): Filter by status
 */
export async function getComments(req: Request, res: Response) {
  const { documentId } = req.params
  const { conversationId, status } = req.query

  // Build where clause
  const where: {
    documentId: string
    conversationId?: string
    status?: string
  } = { documentId }
  if (conversationId) where.conversationId = conversationId as string
  if (status) where.status = status as string

  const comments = await prisma.documentComment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      chunkId: true,
      startOffset: true,
      endOffset: true,
      highlightedText: true,
      content: true,
      viewerEmail: true,
      viewerName: true,
      status: true,
      createdAt: true,
    },
  })

  res.json({ comments })
}

/**
 * Update comment status
 * PATCH /api/comments/:id/status
 *
 * Authorization: Project owner only
 */
export async function updateCommentStatus(req: Request, res: Response) {
  if (!req.user) {
    throw new ValidationError('Authentication required')
  }

  const { id } = req.params
  const { status } = req.body

  // Validate status
  const validStatuses = ['pending', 'addressed', 'dismissed']
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`)
  }

  // Get comment with document and project info
  const comment = await prisma.documentComment.findUnique({
    where: { id },
    include: {
      document: {
        select: {
          project: {
            select: { ownerId: true },
          },
        },
      },
    },
  })

  if (!comment) {
    throw new NotFoundError('Comment')
  }

  // Verify ownership
  if (comment.document.project.ownerId !== req.user.userId) {
    throw new ValidationError('Only project owner can update comment status')
  }

  // Update status
  const updated = await prisma.documentComment.update({
    where: { id },
    data: { status },
  })

  res.json({
    comment: {
      id: updated.id,
      status: updated.status,
    },
  })
}
