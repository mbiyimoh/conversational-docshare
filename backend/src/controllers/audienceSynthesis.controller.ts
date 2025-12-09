import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'
import {
  getLatestSynthesis,
  regenerateAudienceSynthesis,
} from '../services/audienceSynthesis'

/**
 * Get current (latest) synthesis
 * GET /api/projects/:projectId/audience-synthesis
 */
export async function getCurrentSynthesis(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized to view this project')
  }

  const synthesis = await getLatestSynthesis(projectId)

  res.json({
    synthesis: synthesis
      ? {
          id: synthesis.id,
          version: synthesis.version,
          overview: synthesis.overview,
          commonQuestions: synthesis.commonQuestions,
          knowledgeGaps: synthesis.knowledgeGaps,
          documentSuggestions: synthesis.documentSuggestions,
          sentimentTrend: synthesis.sentimentTrend,
          insights: synthesis.insights,
          conversationCount: synthesis.conversationCount,
          totalMessages: synthesis.totalMessages,
          dateRangeFrom: synthesis.dateRangeFrom,
          dateRangeTo: synthesis.dateRangeTo,
          createdAt: synthesis.createdAt,
        }
      : null,
  })
}

/**
 * Get synthesis version history (metadata only)
 * GET /api/projects/:projectId/audience-synthesis/versions
 */
export async function getSynthesisVersions(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })

  if (!project || project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const versions = await prisma.audienceSynthesis.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      conversationCount: true,
      createdAt: true,
    },
  })

  res.json({ versions })
}

/**
 * Get specific synthesis version
 * GET /api/projects/:projectId/audience-synthesis/versions/:version
 */
export async function getSynthesisVersion(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId, version } = req.params
  const versionNum = parseInt(version, 10)

  if (isNaN(versionNum)) {
    throw new ValidationError('Invalid version number')
  }

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })

  if (!project || project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const synthesis = await prisma.audienceSynthesis.findUnique({
    where: {
      projectId_version: { projectId, version: versionNum },
    },
  })

  if (!synthesis) {
    throw new NotFoundError('Synthesis version')
  }

  res.json({
    synthesis: {
      id: synthesis.id,
      version: synthesis.version,
      overview: synthesis.overview,
      commonQuestions: synthesis.commonQuestions,
      knowledgeGaps: synthesis.knowledgeGaps,
      documentSuggestions: synthesis.documentSuggestions,
      sentimentTrend: synthesis.sentimentTrend,
      insights: synthesis.insights,
      conversationCount: synthesis.conversationCount,
      totalMessages: synthesis.totalMessages,
      dateRangeFrom: synthesis.dateRangeFrom,
      dateRangeTo: synthesis.dateRangeTo,
      createdAt: synthesis.createdAt,
    },
  })
}

/**
 * Regenerate synthesis from all conversations
 * POST /api/projects/:projectId/audience-synthesis/regenerate
 */
export async function regenerateSynthesis(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })

  if (!project || project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Not authorized')
  }

  const synthesis = await regenerateAudienceSynthesis(projectId)

  res.json({
    synthesis: synthesis
      ? {
          id: synthesis.id,
          version: synthesis.version,
          overview: synthesis.overview,
          commonQuestions: synthesis.commonQuestions,
          knowledgeGaps: synthesis.knowledgeGaps,
          documentSuggestions: synthesis.documentSuggestions,
          sentimentTrend: synthesis.sentimentTrend,
          insights: synthesis.insights,
          conversationCount: synthesis.conversationCount,
          totalMessages: synthesis.totalMessages,
          dateRangeFrom: synthesis.dateRangeFrom,
          dateRangeTo: synthesis.dateRangeTo,
          createdAt: synthesis.createdAt,
        }
      : null,
    regenerated: true,
  })
}
