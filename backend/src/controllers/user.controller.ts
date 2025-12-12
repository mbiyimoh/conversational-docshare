import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError } from '../utils/errors'

/**
 * Get all saved conversations for the authenticated user
 * @route GET /api/users/me/saved-conversations
 */
export async function getSavedConversations(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      savedByUserId: req.user.userId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  })

  const total = conversations.length

  res.json({
    conversations: conversations.map((conv: typeof conversations[0]) => ({
      id: conv.id,
      projectId: conv.projectId,
      project: {
        id: conv.project.id,
        name: conv.project.name,
      },
      messageCount: conv.messageCount,
      summary: conv.summary,
      sentiment: conv.sentiment,
      topics: conv.topics,
      viewerEmail: conv.viewerEmail,
      viewerName: conv.viewerName,
      startedAt: conv.startedAt,
      endedAt: conv.endedAt,
      durationSeconds: conv.durationSeconds,
    })),
    total,
  })
}

/**
 * Get unified dashboard data for the authenticated user
 * Includes: projects (owned), saved conversations (limited), and stats
 * @route GET /api/users/me/dashboard
 */
export async function getDashboardData(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  // Parallel queries for efficiency
  const [projects, savedConversations] = await Promise.all([
    // Get all projects owned by user
    prisma.project.findMany({
      where: { ownerId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            documents: true,
            conversations: true,
            shareLinks: true,
          },
        },
        agentConfig: {
          select: {
            status: true,
            completionLevel: true,
          },
        },
      },
    }),

    // Get limited saved conversations (max 10 for dashboard)
    prisma.conversation.findMany({
      where: {
        savedByUserId: req.user.userId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 10,
    }),
  ])

  // Count total saved conversations for stats
  const totalSavedConversations = await prisma.conversation.count({
    where: {
      savedByUserId: req.user.userId,
    },
  })

  res.json({
    projects: projects.map((p: typeof projects[0]) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      documentCount: p._count.documents,
      conversationCount: p._count.conversations,
      shareLinkCount: p._count.shareLinks,
      agentConfigured: p.agentConfig?.status === 'complete',
      agentCompletionLevel: p.agentConfig?.completionLevel || 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    savedConversations: savedConversations.map((conv: typeof savedConversations[0]) => ({
      id: conv.id,
      projectId: conv.projectId,
      project: {
        id: conv.project.id,
        name: conv.project.name,
      },
      messageCount: conv.messageCount,
      summary: conv.summary,
      sentiment: conv.sentiment,
      topics: conv.topics,
      viewerEmail: conv.viewerEmail,
      viewerName: conv.viewerName,
      startedAt: conv.startedAt,
      endedAt: conv.endedAt,
      durationSeconds: conv.durationSeconds,
    })),
    stats: {
      projectCount: projects.length,
      savedConversationCount: totalSavedConversations,
    },
  })
}
