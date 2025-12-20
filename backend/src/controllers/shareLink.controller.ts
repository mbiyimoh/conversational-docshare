import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'
import crypto from 'crypto'

/**
 * Generate unique slug for share link
 */
function generateSlug(): string {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * Validation result for share link status checks
 */
interface ShareLinkValidationResult {
  isValid: boolean
  errorCode?: 'LINK_INACTIVE' | 'LINK_EXPIRED' | 'MAX_VIEWS_EXCEEDED'
  errorMessage?: string
  httpStatus?: number
}

/**
 * Validate share link is active and not expired
 * Extracted to avoid duplication across endpoints
 */
function validateShareLinkStatus(shareLink: {
  isActive: boolean
  expiresAt: Date | null
  maxViews?: number | null
  currentViews?: number
}): ShareLinkValidationResult {
  if (!shareLink.isActive) {
    return {
      isValid: false,
      errorCode: 'LINK_INACTIVE',
      errorMessage: 'This link has been deactivated',
      httpStatus: 403,
    }
  }

  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return {
      isValid: false,
      errorCode: 'LINK_EXPIRED',
      errorMessage: 'This link has expired',
      httpStatus: 410,
    }
  }

  if (shareLink.maxViews && shareLink.currentViews !== undefined &&
      shareLink.currentViews >= shareLink.maxViews) {
    return {
      isValid: false,
      errorCode: 'MAX_VIEWS_EXCEEDED',
      errorMessage: 'This link has reached its maximum number of views',
      httpStatus: 403,
    }
  }

  return { isValid: true }
}

/**
 * Create a share link
 */
export async function createShareLink(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { accessType, password, allowedEmails, allowedDomains, maxViews, expiresAt } = req.body
  const recipientRole = req.body.recipientRole || 'viewer'

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Validate access type
  if (!['open', 'email', 'password', 'domain'].includes(accessType)) {
    throw new ValidationError('Invalid access type')
  }

  // Validate recipientRole
  if (!['viewer', 'collaborator'].includes(recipientRole)) {
    throw new ValidationError('recipientRole must be viewer or collaborator')
  }

  // Hash password if provided
  let passwordHash: string | undefined
  if (accessType === 'password') {
    if (!password) {
      throw new ValidationError('Password is required for password-protected links')
    }
    // Validate password strength (hashPassword will throw if weak)
    passwordHash = await hashPassword(password)
  }

  // Generate unique slug
  let slug = generateSlug()
  let attempts = 0
  while (attempts < 10) {
    const existing = await prisma.shareLink.findUnique({ where: { slug } })
    if (!existing) break
    slug = generateSlug()
    attempts++
  }

  // Create share link
  const shareLink = await prisma.shareLink.create({
    data: {
      projectId,
      slug,
      accessType,
      passwordHash,
      allowedEmails: allowedEmails || [],
      allowedDomains: allowedDomains || [],
      maxViews,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      recipientRole,
    },
  })

  res.status(201).json({
    shareLink: {
      id: shareLink.id,
      slug: shareLink.slug,
      accessType: shareLink.accessType,
      recipientRole: shareLink.recipientRole,
      maxViews: shareLink.maxViews,
      currentViews: shareLink.currentViews,
      expiresAt: shareLink.expiresAt,
      isActive: shareLink.isActive,
      createdAt: shareLink.createdAt,
    },
  })
}

/**
 * Get all share links for a project
 */
export async function getProjectShareLinks(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const shareLinks = await prisma.shareLink.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          accessLogs: true,
          conversations: true,
        },
      },
    },
  })

  res.json({
    shareLinks: shareLinks.map((link: typeof shareLinks[0]) => ({
      id: link.id,
      slug: link.slug,
      accessType: link.accessType,
      maxViews: link.maxViews,
      currentViews: link.currentViews,
      expiresAt: link.expiresAt,
      isActive: link.isActive,
      accessLogCount: link._count.accessLogs,
      conversationCount: link._count.conversations,
      createdAt: link.createdAt,
    })),
  })
}

/**
 * Get share link and project info by slug (public endpoint)
 * Used by SharePage to fetch basic info before access verification
 */
export async function getShareLinkBySlug(req: Request, res: Response) {
  const { slug } = req.params

  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  // Validate share link status (active, not expired, within view limits)
  const validation = validateShareLinkStatus(shareLink)
  if (!validation.isValid) {
    res.status(validation.httpStatus || 403).json({
      error: {
        code: validation.errorCode,
        message: validation.errorMessage,
        retryable: false,
      },
    })
    return
  }

  // Return share link and project info (don't expose password hash)
  res.json({
    shareLink: {
      id: shareLink.id,
      slug: shareLink.slug,
      accessType: shareLink.accessType,
      projectId: shareLink.projectId,
      recipientRole: shareLink.recipientRole,
    },
    project: {
      id: shareLink.project.id,
      name: shareLink.project.name,
      description: shareLink.project.description,
    },
  })
}

/**
 * Verify access to a share link (public endpoint)
 */
export async function verifyShareLinkAccess(req: Request, res: Response) {
  const { slug } = req.params
  const { email, password } = req.body

  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  // Validate share link status (active, not expired, within view limits)
  const validation = validateShareLinkStatus(shareLink)
  if (!validation.isValid) {
    res.status(validation.httpStatus || 403).json({
      error: {
        code: validation.errorCode,
        message: validation.errorMessage,
        retryable: false,
      },
    })
    return
  }

  // Check access type requirements
  if (shareLink.accessType === 'password') {
    if (!password || !shareLink.passwordHash) {
      res.status(401).json({
        error: {
          code: 'PASSWORD_REQUIRED',
          message: 'Password is required',
          retryable: false,
        },
        requiresPassword: true,
      })
      return
    }

    const isValid = await verifyPassword(password, shareLink.passwordHash)
    if (!isValid) {
      res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Invalid password',
          retryable: true,
        },
        requiresPassword: true,
      })
      return
    }
  }

  if (shareLink.accessType === 'email') {
    if (!email) {
      res.status(401).json({
        error: {
          code: 'EMAIL_REQUIRED',
          message: 'Email is required',
          retryable: false,
        },
        requiresEmail: true,
      })
      return
    }

    if (!shareLink.allowedEmails.includes(email)) {
      res.status(403).json({
        error: {
          code: 'EMAIL_NOT_ALLOWED',
          message: 'Your email is not authorized to access this link',
          retryable: false,
        },
      })
      return
    }
  }

  if (shareLink.accessType === 'domain' && email) {
    const emailDomain = email.split('@')[1]
    if (!shareLink.allowedDomains.some((domain: string) => emailDomain === domain)) {
      res.status(403).json({
        error: {
          code: 'DOMAIN_NOT_ALLOWED',
          message: 'Your email domain is not authorized to access this link',
          retryable: false,
        },
      })
      return
    }
  }

  // Log access
  await prisma.accessLog.create({
    data: {
      shareLinkId: shareLink.id,
      viewerEmail: email,
      accessGranted: true,
    },
  })

  // Increment view count
  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { currentViews: { increment: 1 } },
  })

  res.json({
    accessGranted: true,
    projectId: shareLink.project.id,
    projectName: shareLink.project.name,
    shareLinkId: shareLink.id,
    recipientRole: shareLink.recipientRole,
  })
}

/**
 * Update a share link
 */
export async function updateShareLink(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { shareLinkId } = req.params
  const { isActive, expiresAt, maxViews } = req.body

  // Get share link and verify ownership
  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  if (shareLink.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this share link')
  }

  const updated = await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      ...(maxViews !== undefined && { maxViews }),
    },
  })

  res.json({
    shareLink: {
      id: updated.id,
      slug: updated.slug,
      accessType: updated.accessType,
      isActive: updated.isActive,
      expiresAt: updated.expiresAt,
      maxViews: updated.maxViews,
      currentViews: updated.currentViews,
    },
  })
}

/**
 * Get a document via share link (public endpoint for viewers)
 * This allows viewers who have verified access to fetch documents
 * without requiring user authentication
 */
export async function getShareLinkDocument(req: Request, res: Response) {
  const { slug, documentId } = req.params

  // Find share link and verify it's valid
  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      project: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  // Validate share link status
  const validation = validateShareLinkStatus(shareLink)
  if (!validation.isValid) {
    res.status(validation.httpStatus || 403).json({
      error: {
        code: validation.errorCode,
        message: validation.errorMessage,
        retryable: false,
      },
    })
    return
  }

  // Verify document belongs to the project
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      projectId: shareLink.project.id,
    },
    select: {
      id: true,
      filename: true,
      originalName: true,
      title: true,
      mimeType: true,
      outline: true,
      status: true,
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  res.json({
    document: {
      id: document.id,
      filename: document.originalName || document.filename, // Prefer original name for display
      title: document.title,
      mimeType: document.mimeType,
      outline: document.outline,
      status: document.status,
    },
  })
}

/**
 * Get all documents for a project via share link (public endpoint)
 * Returns document list for the document lookup cache
 */
export async function getShareLinkDocuments(req: Request, res: Response) {
  const { slug } = req.params

  // Find share link and verify it's valid
  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      project: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  // Validate share link status
  const validation = validateShareLinkStatus(shareLink)
  if (!validation.isValid) {
    res.status(validation.httpStatus || 403).json({
      error: {
        code: validation.errorCode,
        message: validation.errorMessage,
        retryable: false,
      },
    })
    return
  }

  // Get all documents for the project
  const documents = await prisma.document.findMany({
    where: {
      projectId: shareLink.project.id,
    },
    select: {
      id: true,
      filename: true,
      originalName: true,
      title: true,
      mimeType: true,
      outline: true,
      status: true,
    },
    orderBy: {
      uploadedAt: 'asc',
    },
  })

  res.json({
    documents: documents.map((doc: typeof documents[0]) => ({
      id: doc.id,
      filename: doc.originalName || doc.filename, // Prefer original name for display
      title: doc.title,
      mimeType: doc.mimeType,
      outline: doc.outline,
      status: doc.status,
    })),
  })
}

/**
 * Get document chunks via share link (public endpoint for content rendering)
 * Returns the actual text content of a document for the viewer
 */
export async function getShareLinkDocumentChunks(req: Request, res: Response) {
  const { slug, documentId } = req.params

  // Find share link and verify it's valid
  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      project: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  // Validate share link status
  const validation = validateShareLinkStatus(shareLink)
  if (!validation.isValid) {
    res.status(validation.httpStatus || 403).json({
      error: {
        code: validation.errorCode,
        message: validation.errorMessage,
        retryable: false,
      },
    })
    return
  }

  // Verify document belongs to the project
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      projectId: shareLink.project.id,
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  // Fetch chunks ordered by index
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' },
    select: {
      id: true,
      content: true,
      sectionId: true,
      sectionTitle: true,
      chunkIndex: true,
    },
  })

  res.json({ chunks })
}

/**
 * Delete a share link
 */
export async function deleteShareLink(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { shareLinkId } = req.params

  // Get share link and verify ownership
  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  if (shareLink.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this share link')
  }

  await prisma.shareLink.delete({
    where: { id: shareLinkId },
  })

  res.status(204).send()
}
