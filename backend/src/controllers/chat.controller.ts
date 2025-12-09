import { Request, Response } from 'express'
import { generateChatCompletion, createConversation, getConversation } from '../services/chatService'
import { NotFoundError, AuthorizationError } from '../utils/errors'
import { prisma } from '../utils/prisma'

/**
 * Start a new conversation
 */
export async function startConversation(req: Request, res: Response) {
  const { projectId } = req.params
  const { viewerEmail, viewerName } = req.body

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  // Create conversation
  const conversation = await createConversation(projectId, undefined, viewerEmail, viewerName)

  res.status(201).json({
    conversation: {
      id: conversation.id,
      projectId: conversation.projectId,
      startedAt: conversation.startedAt,
    },
  })
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(req: Request, res: Response) {
  const { conversationId } = req.params
  const { message } = req.body

  if (!message) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Message is required',
        retryable: false,
      },
    })
    return
  }

  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Generate response (non-streaming)
  const response = await generateChatCompletion(
    conversation.projectId,
    conversationId,
    message,
    { stream: false }
  )

  res.json({
    message: response,
  })
}

/**
 * Send a message with streaming response
 */
export async function sendMessageStream(req: Request, res: Response) {
  const { conversationId } = req.params
  const { message } = req.body

  if (!message) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Message is required',
        retryable: false,
      },
    })
    return
  }

  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  })

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    // Generate response with streaming
    const stream = await generateChatCompletion(
      conversation.projectId,
      conversationId,
      message,
      { stream: true }
    )

    // Stream chunks to client
    for await (const chunk of stream as AsyncIterable<string>) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }

    // Send done event
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
    res.end()
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(req: Request, res: Response) {
  const { conversationId } = req.params

  const conversation = await getConversation(conversationId)

  if (!conversation) {
    throw new NotFoundError('Conversation')
  }

  res.json({
    conversation: {
      id: conversation.id,
      projectId: conversation.projectId,
      viewerEmail: conversation.viewerEmail,
      viewerName: conversation.viewerName,
      messageCount: conversation.messageCount,
      durationSeconds: conversation.durationSeconds,
      summary: conversation.summary,
      sentiment: conversation.sentiment,
      topics: conversation.topics,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      recipientMessage: conversation.recipientMessage || null,
    },
  })
}

/**
 * Get all conversations for a project (owner only)
 */
export async function getProjectConversations(req: Request, res: Response) {
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

  // Get conversations
  const conversations = await prisma.conversation.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
    },
  })

  res.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      viewerEmail: c.viewerEmail,
      viewerName: c.viewerName,
      messageCount: c._count.messages,
      durationSeconds: c.durationSeconds,
      summary: c.summary,
      sentiment: c.sentiment,
      topics: c.topics,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
    })),
  })
}
