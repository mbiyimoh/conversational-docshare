import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'
import crypto from 'crypto'
import { generateWelcomeMessage } from '../services/welcomeService'
import { getOpenAI } from '../utils/openai'
import type { Prisma } from '@prisma/client'

/**
 * Type for opening message version history
 */
interface OpeningMessageVersion {
  version: number
  content: string
  source: 'generated' | 'manual' | 'refined'
  createdAt: string
}

/**
 * Add a new version to opening message history, keeping last 10
 */
function addOpeningMessageVersion(
  existingVersions: OpeningMessageVersion[] | null,
  content: string,
  source: 'generated' | 'manual' | 'refined'
): OpeningMessageVersion[] {
  const versions = existingVersions || []
  const newVersion: OpeningMessageVersion = {
    version: versions.length + 1,
    content,
    source,
    createdAt: new Date().toISOString(),
  }
  return [...versions, newVersion].slice(-10)
}

/**
 * Generate unique slug for share link
 */
function generateSlug(): string {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * Validate custom slug format.
 * Must start/end with alphanumeric, hyphens only between words, 3-50 chars.
 */
function isValidCustomSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 50
}

/**
 * Generate default share link name from project and profile.
 * Format: "{Project Name} - {Profile Name} - {Mon DD}" or "{Project Name} - {Mon DD}"
 */
function generateDefaultName(projectName: string, profileName?: string): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (profileName) {
    return `${projectName} - ${profileName} - ${date}`
  }
  return `${projectName} - ${date}`
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
  const { accessType, password, allowedEmails, allowedDomains, maxViews, expiresAt, customSlug, name, profileName, openingMessage, openingMessageVersions } = req.body
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

  // Generate or validate slug
  let slug: string
  if (customSlug) {
    if (!isValidCustomSlug(customSlug)) {
      res.status(400).json({
        error: {
          code: 'INVALID_SLUG',
          message: 'Slug must be 3-50 lowercase alphanumeric characters or hyphens, starting and ending with alphanumeric',
          retryable: false,
        },
      })
      return
    }
    const existing = await prisma.shareLink.findUnique({ where: { slug: customSlug } })
    if (existing) {
      res.status(400).json({
        error: {
          code: 'SLUG_TAKEN',
          message: 'This custom URL is already taken',
          retryable: false,
        },
      })
      return
    }
    slug = customSlug
  } else {
    // Generate random slug with collision check
    slug = generateSlug()
    let attempts = 0
    while (attempts < 10) {
      const existing = await prisma.shareLink.findUnique({ where: { slug } })
      if (!existing) break
      slug = generateSlug()
      attempts++
    }
  }

  // Generate name if not provided
  const linkName = name || generateDefaultName(project.name, profileName)

  // Create share link with optional opening message
  const shareLink = await prisma.shareLink.create({
    data: {
      projectId,
      slug,
      name: linkName,
      accessType,
      passwordHash,
      allowedEmails: allowedEmails || [],
      allowedDomains: allowedDomains || [],
      maxViews,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      recipientRole,
      // Opening message (optional, from preview editor)
      openingMessage: openingMessage || undefined,
      openingMessageVersions: openingMessageVersions
        ? (openingMessageVersions as unknown as Prisma.InputJsonValue)
        : undefined,
      openingMessageSource: openingMessage ? 'generated' : undefined,
    },
  })

  res.status(201).json({
    shareLink: {
      id: shareLink.id,
      slug: shareLink.slug,
      name: shareLink.name,
      accessType: shareLink.accessType,
      recipientRole: shareLink.recipientRole,
      maxViews: shareLink.maxViews,
      currentViews: shareLink.currentViews,
      expiresAt: shareLink.expiresAt,
      isActive: shareLink.isActive,
      createdAt: shareLink.createdAt,
      openingMessage: shareLink.openingMessage,
      openingMessageVersions: shareLink.openingMessageVersions,
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
      name: link.name,
      accessType: link.accessType,
      maxViews: link.maxViews,
      currentViews: link.currentViews,
      expiresAt: link.expiresAt,
      isActive: link.isActive,
      accessLogCount: link._count.accessLogs,
      conversationCount: link._count.conversations,
      createdAt: link.createdAt,
      openingMessage: link.openingMessage,
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
  const { isActive, expiresAt, maxViews, name } = req.body

  // Validate name if provided
  if (name !== undefined) {
    if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
      res.status(400).json({
        error: {
          code: 'INVALID_NAME',
          message: 'Name must be 1-100 characters',
          retryable: false,
        },
      })
      return
    }
  }

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
      ...(name !== undefined && { name }),
    },
  })

  res.json({
    shareLink: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
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
      filename: document.originalName || document.filename, // Display name for UI
      internalFilename: document.filename, // Internal filename for citation matching
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
      filename: doc.originalName || doc.filename, // Display name for UI
      internalFilename: doc.filename, // Internal filename for citation matching
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

// ============================================================================
// OPENING MESSAGE ENDPOINTS
// ============================================================================

/**
 * Generate an opening message for a share link
 * Uses the welcomeService to create a context-aware greeting
 */
export async function generateOpeningMessage(req: Request, res: Response) {
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
          id: true,
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

  try {
    // Use existing welcomeService logic
    const message = await generateWelcomeMessage(shareLink.projectId)

    // Build version history using utility function
    const updatedVersions = addOpeningMessageVersion(
      shareLink.openingMessageVersions as OpeningMessageVersion[] | null,
      message,
      'generated'
    )

    // Update share link
    await prisma.shareLink.update({
      where: { id: shareLinkId },
      data: {
        openingMessage: message,
        openingMessageVersions: updatedVersions as unknown as Prisma.InputJsonValue,
        openingMessageSource: 'generated',
      },
    })

    res.json({
      message,
      versions: updatedVersions,
    })
  } catch (error) {
    console.error('Failed to generate opening message:', error)

    // Return default message as fallback
    const defaultMessage = `**Hello! I'm your AI assistant for this document collection.**

I'm here to help you explore and understand the materials shared with you. Feel free to ask me questions about specific topics, request summaries, or help finding particular information.

What would you like to know?`

    res.status(503).json({
      error: 'Failed to generate message. Using default.',
      message: defaultMessage,
      isDefault: true,
    })
  }
}

/**
 * Refine an existing opening message with AI
 * Takes a refinement prompt and modifies the message accordingly
 */
export async function refineOpeningMessage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { shareLinkId } = req.params
  const { prompt } = req.body

  if (!prompt || typeof prompt !== 'string') {
    throw new ValidationError('Refinement prompt is required')
  }

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

  if (!shareLink.openingMessage) {
    throw new ValidationError('No opening message to refine. Generate one first.')
  }

  try {
    const openai = getOpenAI()
    const refinedResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You refine opening messages for document sharing. Maintain markdown formatting. Keep it concise (2-3 short paragraphs). IMPORTANT: Keep the total message under 900 characters. Make targeted changes based on the request.',
        },
        {
          role: 'user',
          content: `Current message:\n${shareLink.openingMessage}\n\nRefinement request: ${prompt}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const message = refinedResponse.choices[0].message.content || shareLink.openingMessage

    // Build version history using utility function
    const updatedVersions = addOpeningMessageVersion(
      shareLink.openingMessageVersions as OpeningMessageVersion[] | null,
      message,
      'refined'
    )

    // Update share link
    await prisma.shareLink.update({
      where: { id: shareLinkId },
      data: {
        openingMessage: message,
        openingMessageVersions: updatedVersions as unknown as Prisma.InputJsonValue,
        openingMessageSource: 'refined',
      },
    })

    res.json({
      message,
      versions: updatedVersions,
    })
  } catch (error) {
    console.error('Failed to refine opening message:', error)
    res.status(503).json({
      error: 'Failed to refine message. Please try again.',
    })
  }
}

/**
 * Update opening message manually
 * Allows direct editing of the message content
 */
export async function updateOpeningMessage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { shareLinkId } = req.params
  const { message } = req.body

  if (message !== undefined && typeof message !== 'string') {
    throw new ValidationError('Message must be a string')
  }

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

  // If clearing the message (empty string or null)
  if (!message) {
    await prisma.shareLink.update({
      where: { id: shareLinkId },
      data: {
        openingMessage: null,
        openingMessageSource: null,
      },
    })

    res.json({
      message: null,
      versions: shareLink.openingMessageVersions || [],
    })
    return
  }

  // Build version history using utility function
  const updatedVersions = addOpeningMessageVersion(
    shareLink.openingMessageVersions as OpeningMessageVersion[] | null,
    message,
    'manual'
  )

  // Update share link
  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: {
      openingMessage: message,
      openingMessageVersions: updatedVersions as unknown as Prisma.InputJsonValue,
      openingMessageSource: 'manual',
    },
  })

  res.json({
    message,
    versions: updatedVersions,
  })
}

/**
 * Restore a previous version of the opening message
 */
export async function restoreOpeningMessageVersion(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { shareLinkId } = req.params
  const { version } = req.body

  if (typeof version !== 'number' || version < 1) {
    throw new ValidationError('Valid version number is required')
  }

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

  const versions = (shareLink.openingMessageVersions as OpeningMessageVersion[] | null) || []
  const targetVersion = versions.find((v) => v.version === version)

  if (!targetVersion) {
    throw new NotFoundError('Version')
  }

  // Restoring sets the message but doesn't add to version history
  // (the version already exists in history)
  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: {
      openingMessage: targetVersion.content,
      openingMessageSource: targetVersion.source,
    },
  })

  res.json({
    message: targetVersion.content,
    versions,
    restoredVersion: version,
  })
}

// ============================================================================
// OPENING MESSAGE PREVIEW ENDPOINTS (No share link required)
// ============================================================================

/**
 * Generate opening message preview for a project (before link creation)
 * Allows pre-visualization without creating a share link
 */
export async function generateOpeningMessagePreview(req: Request, res: Response) {
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

  try {
    const message = await generateWelcomeMessage(projectId)

    // Return message without saving (client manages state)
    res.json({ message })
  } catch (error) {
    console.error('Failed to generate opening message preview:', error)

    const defaultMessage = `**Hello! I'm your AI assistant for this document collection.**

I'm here to help you explore and understand the materials shared with you. Feel free to ask me questions about specific topics, request summaries, or help finding particular information.

What would you like to know?`

    res.status(503).json({
      error: 'Failed to generate message. Using default.',
      message: defaultMessage,
      isDefault: true,
    })
  }
}

/**
 * Refine opening message preview (client-side state, no database)
 */
export async function refineOpeningMessagePreview(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { currentMessage, prompt } = req.body

  if (!prompt || typeof prompt !== 'string') {
    throw new ValidationError('Refinement prompt is required')
  }

  if (!currentMessage || typeof currentMessage !== 'string') {
    throw new ValidationError('Current message is required')
  }

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

  try {
    const openai = getOpenAI()
    const refinedResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You refine opening messages for document sharing. Maintain markdown formatting. Keep it concise (2-3 short paragraphs). IMPORTANT: Keep the total message under 900 characters. Make targeted changes based on the request.',
        },
        {
          role: 'user',
          content: `Current message:\n${currentMessage}\n\nRefinement request: ${prompt}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const message = refinedResponse.choices[0].message.content || currentMessage

    res.json({ message })
  } catch (error) {
    console.error('Failed to refine opening message preview:', error)
    res.status(503).json({
      error: 'Failed to refine message. Please try again.',
    })
  }
}
