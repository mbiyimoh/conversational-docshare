import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import {
  generateRecommendations,
  applyRecommendations,
  rollbackToVersion,
  getVersionHistory,
  dismissRecommendation,
} from '../services/recommendationEngine'
import { NotFoundError, AuthorizationError, RateLimitError, ValidationError } from '../utils/errors'
import type { GenerateRecommendationsResponse, RollbackResponse, VersionHistoryResponse } from '../types/recommendation'

// Rate limiting: track requests per project
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10  // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000  // 1 hour in ms

function checkRateLimit(projectId: string): void {
  const now = Date.now()
  const record = requestCounts.get(projectId)

  if (!record || now > record.resetAt) {
    // Start new window
    requestCounts.set(projectId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return
  }

  if (record.count >= RATE_LIMIT) {
    const minutesRemaining = Math.ceil((record.resetAt - now) / (60 * 1000))
    throw new RateLimitError(
      `Rate limit exceeded. Please try again in ${minutesRemaining} minutes.`
    )
  }

  record.count++
}

/**
 * Verify project ownership
 */
async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== userId) {
    throw new AuthorizationError('You do not own this project')
  }

  return project
}

/**
 * Generate profile-direct recommendations from testing comments
 * POST /api/projects/:projectId/recommendations
 */
export async function getRecommendations(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  await verifyProjectOwnership(projectId, req.user.userId)

  // Check rate limit (10 requests per hour per project)
  checkRateLimit(projectId)

  const result = await generateRecommendations(projectId)

  const response: GenerateRecommendationsResponse = {
    setId: result.setId,
    recommendations: result.recommendations,
    analysisSummary: result.analysisSummary,
    totalComments: result.totalComments,
    sessionsAnalyzed: result.sessionsAnalyzed,
    generatedAt: result.generatedAt,
  }

  res.json(response)
}

/**
 * Apply all pending recommendations from a set
 * POST /api/projects/:projectId/recommendations/apply-all
 */
export async function applyAllRecommendations(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { setId } = req.body

  if (!setId || typeof setId !== 'string') {
    throw new ValidationError('setId is required')
  }

  await verifyProjectOwnership(projectId, req.user.userId)

  const result = await applyRecommendations(projectId, setId)

  // Count applied recommendations (works for both V1 and V2 profiles)
  const countEditedItems = (): number => {
    const profile = result.profile
    if ('sections' in profile && profile.sections) {
      // V1 profile
      return Object.values(profile.sections).filter(
        section => section.isEdited
      ).length
    } else if ('fields' in profile && profile.fields) {
      // V2 profile
      return Object.values(profile.fields).filter(
        field => field.isEdited
      ).length
    }
    return 0
  }

  const response = {
    success: true as const,
    appliedCount: countEditedItems(),
    profile: result.profile,
    version: {
      number: result.version.version,
      createdAt: result.version.createdAt,
    },
    rollbackAvailable: true as const,
  }

  res.json(response)
}

/**
 * Rollback profile to a previous version
 * POST /api/projects/:projectId/profile/rollback
 */
export async function rollbackProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { toVersion } = req.body

  if (typeof toVersion !== 'number' || toVersion < 1) {
    throw new ValidationError('toVersion must be a positive number')
  }

  await verifyProjectOwnership(projectId, req.user.userId)

  const profile = await rollbackToVersion(projectId, toVersion)

  const response: RollbackResponse = {
    success: true,
    profile,
    restoredVersion: toVersion,
  }

  res.json(response)
}

/**
 * Get version history for a project
 * GET /api/projects/:projectId/profile/versions
 */
export async function getProfileVersionHistory(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  await verifyProjectOwnership(projectId, req.user.userId)

  const result = await getVersionHistory(projectId)

  const response: VersionHistoryResponse = result

  res.json(response)
}

/**
 * Dismiss a single recommendation
 * POST /api/projects/:projectId/recommendations/:recommendationId/dismiss
 */
export async function dismissSingleRecommendation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId, recommendationId } = req.params

  await verifyProjectOwnership(projectId, req.user.userId)

  await dismissRecommendation(projectId, recommendationId)

  res.json({ success: true })
}

// ============================================================================
// CONVERSATION RECOMMENDATIONS (Post-conversation document improvements)
// ============================================================================

/**
 * Get recommendations for a conversation
 * GET /api/conversations/:id/recommendations
 */
export async function getConversationRecommendations(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify conversation exists and user is project owner
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      project: { select: { ownerId: true } },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can view recommendations')
  }

  const recommendations = await prisma.conversationRecommendation.findMany({
    where: { conversationId: id },
    orderBy: [{ priority: 'asc' }, { confidence: 'desc' }],
    include: {
      targetDocument: {
        select: { id: true, filename: true },
      },
    },
  })

  res.json({
    recommendations: recommendations.map((r: typeof recommendations[0]) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      proposedContent: r.proposedContent,
      changeHighlight: r.changeHighlight,
      evidenceQuotes: r.evidenceQuotes,
      reasoning: r.reasoning,
      confidence: r.confidence,
      impactLevel: r.impactLevel,
      status: r.status,
      targetDocument: r.targetDocument,
      targetSectionId: r.targetSectionId,
      reviewedAt: r.reviewedAt?.toISOString() || null,
      appliedAt: r.appliedAt?.toISOString() || null,
      appliedToVersion: r.appliedToVersion,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}

/**
 * Apply a conversation recommendation
 * POST /api/recommendations/:id/apply
 */
export async function applyConversationRecommendation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Load recommendation with conversation and project info
  const recommendation = await prisma.conversationRecommendation.findUnique({
    where: { id },
    include: {
      conversation: {
        include: {
          project: { select: { id: true, ownerId: true } },
        },
      },
      targetDocument: { select: { id: true, isEditable: true, currentVersion: true } },
    },
  })

  if (!recommendation) {
    throw new NotFoundError('Recommendation')
  }

  if (recommendation.conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can apply recommendations')
  }

  if (recommendation.status !== 'pending') {
    throw new ValidationError(`Recommendation is already ${recommendation.status}`)
  }

  // For document_update type, update the document
  let appliedToVersion: number | null = null

  if (recommendation.type === 'document_update' && recommendation.targetDocument) {
    if (!recommendation.targetDocument.isEditable) {
      throw new ValidationError('Target document is not editable')
    }

    if (!recommendation.proposedContent) {
      throw new ValidationError('Recommendation has no proposed content')
    }

    // Import document versioning service
    const { createDocumentVersion, plainTextToTipTap } = await import('../services/documentVersioning')

    // Create new version with proposed content
    const content = plainTextToTipTap(recommendation.proposedContent)
    const { version } = await createDocumentVersion(
      recommendation.targetDocument.id,
      content,
      req.user.userId,
      `Applied recommendation: ${recommendation.title}`,
      'recommendation',
      recommendation.id
    )

    appliedToVersion = version.version
  }

  // Update recommendation status
  const updated = await prisma.conversationRecommendation.update({
    where: { id },
    data: {
      status: 'applied',
      reviewedAt: new Date(),
      appliedAt: new Date(),
      appliedToVersion,
    },
  })

  res.json({
    success: true,
    recommendation: {
      id: updated.id,
      status: updated.status,
      appliedAt: updated.appliedAt?.toISOString(),
      appliedToVersion: updated.appliedToVersion,
    },
    documentVersion: appliedToVersion
      ? {
          version: appliedToVersion,
        }
      : undefined,
  })
}

/**
 * Dismiss a conversation recommendation
 * POST /api/recommendations/:id/dismiss
 */
export async function dismissConversationRecommendation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Load recommendation
  const recommendation = await prisma.conversationRecommendation.findUnique({
    where: { id },
    include: {
      conversation: {
        include: {
          project: { select: { ownerId: true } },
        },
      },
    },
  })

  if (!recommendation) {
    throw new NotFoundError('Recommendation')
  }

  if (recommendation.conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can dismiss recommendations')
  }

  if (recommendation.status !== 'pending') {
    throw new ValidationError(`Recommendation is already ${recommendation.status}`)
  }

  const updated = await prisma.conversationRecommendation.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedAt: new Date(),
    },
  })

  res.json({
    success: true,
    recommendation: {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString(),
    },
  })
}
