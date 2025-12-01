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
 * Create a share link
 */
export async function createShareLink(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { accessType, password, allowedEmails, allowedDomains, maxViews, expiresAt } = req.body

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
    },
  })

  res.status(201).json({
    shareLink: {
      id: shareLink.id,
      slug: shareLink.slug,
      accessType: shareLink.accessType,
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
    shareLinks: shareLinks.map((link) => ({
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

  // Check if link is active
  if (!shareLink.isActive) {
    res.status(403).json({
      error: {
        code: 'LINK_INACTIVE',
        message: 'This link has been deactivated',
        retryable: false,
      },
    })
    return
  }

  // Check expiration
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    res.status(403).json({
      error: {
        code: 'LINK_EXPIRED',
        message: 'This link has expired',
        retryable: false,
      },
    })
    return
  }

  // Check max views
  if (shareLink.maxViews && shareLink.currentViews >= shareLink.maxViews) {
    res.status(403).json({
      error: {
        code: 'MAX_VIEWS_EXCEEDED',
        message: 'This link has reached its maximum number of views',
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
    if (!shareLink.allowedDomains.some((domain) => emailDomain === domain)) {
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
    access: {
      granted: true,
      projectId: shareLink.project.id,
      projectName: shareLink.project.name,
      shareLinkId: shareLink.id,
    },
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
