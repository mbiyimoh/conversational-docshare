import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'

/**
 * Get analytics for a project
 */
export async function getProjectAnalytics(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Validate projectId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(projectId)) {
    throw new ValidationError('Invalid project ID format')
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

  // Get conversation statistics
  const conversationStats = await prisma.conversation.aggregate({
    where: { projectId },
    _count: true,
    _avg: {
      messageCount: true,
      durationSeconds: true,
    },
  })

  // Get total message count
  const totalMessages = await prisma.message.count({
    where: {
      conversation: {
        projectId,
      },
    },
  })

  // Get view count (from access logs)
  const viewCount = await prisma.accessLog.count({
    where: {
      shareLink: {
        projectId,
      },
    },
  })

  // Get recent conversations
  const recentConversations = await prisma.conversation.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      viewerEmail: true,
      messageCount: true,
      durationSeconds: true,
      sentiment: true,
      startedAt: true,
      endedAt: true,
    },
  })

  // Get conversations by day (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const conversationsByDay = await prisma.$queryRaw<
    Array<{ date: string; count: number }>
  >`
    SELECT
      DATE(started_at) as date,
      COUNT(*)::int as count
    FROM conversations
    WHERE project_id = ${projectId}
      AND started_at >= ${thirtyDaysAgo}
    GROUP BY DATE(started_at)
    ORDER BY DATE(started_at) ASC
  `

  res.json({
    analytics: {
      overview: {
        totalConversations: conversationStats._count,
        totalMessages,
        totalViews: viewCount,
        avgMessagesPerConversation: conversationStats._avg.messageCount || 0,
        avgDurationSeconds: conversationStats._avg.durationSeconds || 0,
      },
      recentConversations,
      conversationsByDay,
    },
  })
}

/**
 * Get conversation details
 */
export async function getConversationAnalytics(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { conversationId } = req.params

  // Validate conversationId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(conversationId)) {
    throw new ValidationError('Invalid conversation ID format')
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          citations: {
            select: {
              id: true,
              documentId: true,
              sectionTitle: true,
              citedText: true,
            },
          },
        },
      },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this conversation')
  }

  res.json({
    conversation: {
      id: conversation.id,
      viewerEmail: conversation.viewerEmail,
      viewerName: conversation.viewerName,
      messageCount: conversation.messageCount,
      durationSeconds: conversation.durationSeconds,
      summary: conversation.summary,
      sentiment: conversation.sentiment,
      topics: conversation.topics,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      messages: conversation.messages,
    },
  })
}
