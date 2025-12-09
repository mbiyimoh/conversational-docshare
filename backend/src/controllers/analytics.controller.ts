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

  // Validate projectId is a valid CUID
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(projectId)) {
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
      viewerName: true,
      messageCount: true,
      durationSeconds: true,
      sentiment: true,
      topics: true,
      summary: true,
      startedAt: true,
      endedAt: true,
    },
  })

  // Get conversations by day (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Note: PostgreSQL requires quoted identifiers for camelCase column names
  const conversationsByDay = await prisma.$queryRaw<
    Array<{ date: string; count: number }>
  >`
    SELECT
      DATE("startedAt") as date,
      COUNT(*)::int as count
    FROM conversations
    WHERE "projectId" = ${projectId}
      AND "startedAt" >= ${thirtyDaysAgo}
    GROUP BY DATE("startedAt")
    ORDER BY DATE("startedAt") ASC
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

  // Validate conversationId is a valid CUID
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(conversationId)) {
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

/**
 * Export project conversations as CSV
 */
export async function exportConversationsCSV(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Validate projectId is a valid CUID
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(projectId)) {
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

  // Get all conversations for the project
  const conversations = await prisma.conversation.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      viewerEmail: true,
      viewerName: true,
      messageCount: true,
      durationSeconds: true,
      sentiment: true,
      topics: true,
      summary: true,
      startedAt: true,
      endedAt: true,
    },
  })

  // Helper function to escape CSV fields
  const escapeCsvField = (field: string | number | boolean | null | undefined | string[]): string => {
    if (field === null || field === undefined) {
      return ''
    }
    const value = String(field)
    // Escape quotes by doubling them and wrap in quotes if contains special chars
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // Build CSV content
  const headers = [
    'ID',
    'Viewer Email',
    'Viewer Name',
    'Messages',
    'Duration (seconds)',
    'Sentiment',
    'Topics',
    'Summary',
    'Started At',
    'Ended At',
  ]

  const csvRows = [headers.join(',')]

  // Add data rows
  conversations.forEach((conversation) => {
    const row = [
      escapeCsvField(conversation.id),
      escapeCsvField(conversation.viewerEmail),
      escapeCsvField(conversation.viewerName),
      escapeCsvField(conversation.messageCount),
      escapeCsvField(conversation.durationSeconds),
      escapeCsvField(conversation.sentiment),
      escapeCsvField(conversation.topics ? conversation.topics.join('; ') : ''),
      escapeCsvField(conversation.summary),
      escapeCsvField(conversation.startedAt.toISOString()),
      escapeCsvField(conversation.endedAt ? conversation.endedAt.toISOString() : ''),
    ]
    csvRows.push(row.join(','))
  })

  const csvContent = csvRows.join('\n')

  // Generate safe filename from project name
  const safeProjectName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const filename = `${safeProjectName}_conversations_${new Date().toISOString().split('T')[0]}.csv`

  // Set response headers
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  // Send CSV content
  res.send(csvContent)
}
