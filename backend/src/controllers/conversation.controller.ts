import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'
import { generateConversationSummary } from '../services/conversationAnalysis'
import { generateHistorySummary, generateChatCompletionWithSummary } from '../services/chatService'

/**
 * Get conversation details
 * GET /api/conversations/:id
 *
 * Authorization: project owner OR savedByUser can view
 */
export async function getConversationDetail(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Validate id is a valid CUID
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(id)) {
    throw new ValidationError('Invalid conversation ID format')
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
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
      project: {
        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      },
      shareLink: {
        select: {
          slug: true,
        },
      },
      recipientMessage: {
        select: {
          id: true,
          content: true,
          viewerEmail: true,
          viewerName: true,
          createdAt: true,
        },
      },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Authorization: creator of project OR savedByUser
  const isOwner = conversation.project.ownerId === req.user.userId
  const isSaver = conversation.savedByUserId === req.user.userId

  if (!isOwner && !isSaver) {
    throw new AuthorizationError('Not authorized to view this conversation')
  }

  res.json({
    conversation: {
      id: conversation.id,
      projectId: conversation.projectId,
      project: {
        id: conversation.project.id,
        name: conversation.project.name,
      },
      shareLinkId: conversation.shareLinkId,
      shareLinkSlug: conversation.shareLink?.slug || null,
      viewerEmail: conversation.viewerEmail,
      viewerName: conversation.viewerName,
      messageCount: conversation.messageCount,
      durationSeconds: conversation.durationSeconds,
      summary: conversation.summary,
      sentiment: conversation.sentiment,
      topics: conversation.topics,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      savedByUserId: conversation.savedByUserId,
      messages: conversation.messages,
      recipientMessage: conversation.recipientMessage || null,
    },
  })
}

/**
 * Save a conversation to user's account
 * POST /api/conversations/:id/save
 *
 * Authorization: requires authentication
 */
export async function saveConversation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Find conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      savedByUserId: true,
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Check if already saved
  if (conversation.savedByUserId !== null) {
    throw new ValidationError('Conversation has already been saved')
  }

  // Update conversation with savedByUserId
  const savedConversation = await prisma.conversation.update({
    where: { id },
    data: { savedByUserId: req.user.userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  res.json({
    savedConversation: {
      id: savedConversation.id,
      projectId: savedConversation.projectId,
      project: {
        id: savedConversation.project.id,
        name: savedConversation.project.name,
      },
      shareLinkId: savedConversation.shareLinkId,
      viewerEmail: savedConversation.viewerEmail,
      viewerName: savedConversation.viewerName,
      messageCount: savedConversation.messageCount,
      durationSeconds: savedConversation.durationSeconds,
      summary: savedConversation.summary,
      sentiment: savedConversation.sentiment,
      topics: savedConversation.topics,
      startedAt: savedConversation.startedAt,
      endedAt: savedConversation.endedAt,
      savedByUserId: savedConversation.savedByUserId,
      messages: savedConversation.messages,
    },
  })
}

/**
 * End a conversation and generate AI summary
 * POST /api/conversations/:id/end
 *
 * Marks conversation as ended, calculates duration, and generates summary
 * for conversations with 5+ messages. Idempotent - returns existing data
 * if already ended.
 *
 * Authorization: No auth required (anonymous viewers can end their session)
 */
export async function endConversation(req: Request, res: Response) {
  const { id } = req.params
  const { recipientMessage } = req.body as { recipientMessage?: string }

  // Validate id is a valid CUID
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(id)) {
    throw new ValidationError('Invalid conversation ID format')
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          content: true,
        },
      },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Idempotent - if already ended, return existing data
  if (conversation.endedAt) {
    const existingRecCount = await prisma.conversationRecommendation.count({
      where: { conversationId: id },
    })

    res.json({
      conversation: {
        id: conversation.id,
        endedAt: conversation.endedAt,
        durationSeconds: conversation.durationSeconds,
        summary: conversation.summary,
        sentiment: conversation.sentiment,
        topics: conversation.topics,
      },
      summary: conversation.summary,
      recommendationCount: existingRecCount,
    })
    return
  }

  const endedAt = new Date()
  const durationSeconds = Math.floor(
    (endedAt.getTime() - conversation.startedAt.getTime()) / 1000
  )

  // Generate summary only if 5+ messages (cost control)
  let summary = null
  let sentiment = null
  let topics: string[] = []

  if (conversation.messages.length >= 5) {
    try {
      const analysis = await generateConversationSummary(conversation.messages)
      summary = analysis.summary
      sentiment = analysis.sentiment
      topics = analysis.topics
    } catch (error) {
      // Log error but don't fail the request - summary is optional
      console.error('Failed to generate conversation summary:', error)
    }
  }

  // Save recipient message if provided
  if (recipientMessage && recipientMessage.trim()) {
    await prisma.recipientMessage.create({
      data: {
        conversationId: id,
        content: recipientMessage.trim(),
        viewerEmail: conversation.viewerEmail,
        viewerName: conversation.viewerName,
      },
    })
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      endedAt,
      durationSeconds,
      summary,
      sentiment,
      topics,
    },
  })

  // Generate recommendations asynchronously (don't block response)
  let recommendationCount = 0
  if (conversation.messages.length >= 5) {
    try {
      const { generateConversationRecommendations } = await import(
        '../services/conversationRecommendationGenerator'
      )
      const recs = await generateConversationRecommendations(id)
      recommendationCount = recs.length

      // Update audience synthesis
      const { updateAudienceSynthesis } = await import('../services/audienceSynthesis')
      await updateAudienceSynthesis(conversation.projectId, id)
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
    }
  }

  res.json({
    conversation: {
      id: updated.id,
      endedAt: updated.endedAt,
      durationSeconds: updated.durationSeconds,
      summary: updated.summary,
      sentiment: updated.sentiment,
      topics: updated.topics,
    },
    summary: updated.summary,
    recommendationCount,
  })
}

/**
 * Continue a saved conversation with a new message
 * POST /api/conversations/:id/messages
 *
 * Authorization: Only savedByUserId can continue (project owner can VIEW only)
 */
export async function continueConversation(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { message } = req.body

  // Validate message
  if (!message?.trim()) {
    throw new ValidationError('Message is required')
  }

  // Validate ID format
  const cuidRegex = /^[0-9a-z]{25,}$/i
  if (!cuidRegex.test(id)) {
    throw new ValidationError('Invalid conversation ID format')
  }

  // Load conversation with project info
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, ownerId: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      },
    },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Authorization: ONLY savedByUserId can continue
  if (conversation.savedByUserId !== req.user.userId) {
    throw new AuthorizationError('Only the user who saved this conversation can continue it')
  }

  // Re-activate if ended (clear summary data - will regenerate on re-end)
  if (conversation.endedAt) {
    await prisma.conversation.update({
      where: { id },
      data: {
        endedAt: null,
        summary: null,
        sentiment: null,
        topics: [],
      },
    })
  }

  // Generate summary of older messages if conversation is long
  let historySummary: string | null = null
  if (conversation.messages.length > 10) {
    const olderMessages = conversation.messages.slice(0, -10)
    historySummary = await generateHistorySummary(olderMessages)
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = await generateChatCompletionWithSummary(
      conversation.project.id,
      id,
      message,
      historySummary,
      { stream: true }
    )

    // Stream chunks to client
    for await (const chunk of stream as AsyncIterable<string>) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (error) {
    console.error('Continuation streaming error:', error)
    res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
  } finally {
    res.end()
  }
}
