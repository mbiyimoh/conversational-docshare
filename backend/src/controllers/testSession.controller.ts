import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'
import { buildSystemPrompt } from '../services/contextService'
import { buildDocumentContext } from '../services/chatService'
import { getOpenAI } from '../utils/openai'
import type { TestMessage, TestComment } from '@prisma/client'

/**
 * Get all test sessions for a project
 * GET /api/projects/:projectId/test-sessions
 */
export async function getTestSessions(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const sessions = await prisma.testSession.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
    },
  })

  // Get comment counts for each session
  const sessionsWithCounts = await Promise.all(
    sessions.map(async (session: typeof sessions[0]) => {
      const commentCount = await prisma.testComment.count({
        where: {
          message: {
            sessionId: session.id,
          },
        },
      })

      return {
        id: session.id,
        name: session.name,
        status: session.status,
        messageCount: session._count.messages,
        commentCount,
        createdAt: session.createdAt,
        endedAt: session.endedAt,
      }
    })
  )

  res.json({ sessions: sessionsWithCounts })
}

/**
 * Create new test session
 * POST /api/projects/:projectId/test-sessions
 */
export async function createTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { name } = req.body

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Count existing sessions for default naming
  const sessionCount = await prisma.testSession.count({
    where: { projectId },
  })

  const session = await prisma.testSession.create({
    data: {
      projectId,
      name: name || `Session #${sessionCount + 1}`,
      status: 'active',
    },
  })

  res.status(201).json({ session })
}

/**
 * Get test session with messages and comments
 * GET /api/test-sessions/:sessionId
 */
export async function getTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { ownerId: true },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  res.json({
    session: {
      id: session.id,
      projectId: session.projectId,
      name: session.name,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      endedAt: session.endedAt,
      messages: session.messages.map((m: TestMessage & { comments: TestComment[] }) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        comments: m.comments.map((c: TestComment) => ({
          id: c.id,
          messageId: c.messageId,
          content: c.content,
          templateId: c.templateId,
          createdAt: c.createdAt,
        })),
      })),
    },
  })
}

/**
 * Update test session (name, status)
 * PATCH /api/test-sessions/:sessionId
 */
export async function updateTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params
  const { name, status } = req.body

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { ownerId: true },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (status !== undefined) {
    updateData.status = status
    if (status === 'ended') {
      updateData.endedAt = new Date()
    }
  }

  const updated = await prisma.testSession.update({
    where: { id: sessionId },
    data: updateData,
  })

  res.json({ session: updated })
}

/**
 * Delete test session
 * DELETE /api/test-sessions/:sessionId
 */
export async function deleteTestSession(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { ownerId: true },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  await prisma.testSession.delete({
    where: { id: sessionId },
  })

  res.json({ success: true })
}

/**
 * Send message in test session (with SSE streaming)
 * POST /api/test-sessions/:sessionId/messages
 */
export async function sendTestMessage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { sessionId } = req.params
  const { message } = req.body

  if (!message) {
    throw new ValidationError('Message is required')
  }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      project: {
        select: { id: true, ownerId: true },
      },
    },
  })

  if (!session) {
    throw new NotFoundError('Test session')
  }

  if (session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test session')
  }

  // Store user message
  const userMessage = await prisma.testMessage.create({
    data: {
      sessionId,
      role: 'user',
      content: message,
    },
  })

  // Get existing messages for context
  const existingMessages = await prisma.testMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  })

  // Build system prompt using same logic as real chat
  const systemPrompt = await buildSystemPrompt(session.project.id)

  // Build document context from RAG (same as production chat)
  const documentContext = await buildDocumentContext(session.project.id, message)

  // Get agent config for model/temperature settings
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId: session.project.id },
  })
  const model = agentConfig?.preferredModel || 'gpt-4-turbo'
  const temperature = agentConfig?.temperature ?? 0.7

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Stream response from OpenAI
  const openai = getOpenAI()

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...(documentContext ? [{ role: 'system' as const, content: documentContext }] : []),
    ...existingMessages.map((m: TestMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  let fullResponse = ''

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: chatMessages,
      temperature,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        fullResponse += content
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`)
      }
    }

    // Store assistant message
    const assistantMessage = await prisma.testMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullResponse,
      },
    })

    res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id, userMessageId: userMessage.id })}\n\n`)
    res.write('data: [DONE]\n\n')
  } catch (error) {
    console.error('Test chat error:', error)
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`)
  } finally {
    res.end()
  }
}

/**
 * Add comment to test message
 * POST /api/test-messages/:messageId/comments
 */
export async function addTestComment(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { messageId } = req.params
  const { content, templateId } = req.body

  if (!content) {
    throw new ValidationError('Content is required')
  }

  const message = await prisma.testMessage.findUnique({
    where: { id: messageId },
    include: {
      session: {
        include: {
          project: {
            select: { ownerId: true },
          },
        },
      },
    },
  })

  if (!message) {
    throw new NotFoundError('Test message')
  }

  if (message.session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this test message')
  }

  const comment = await prisma.testComment.create({
    data: {
      messageId,
      content,
      templateId: templateId || null,
    },
  })

  res.status(201).json({ comment })
}

/**
 * Delete comment
 * DELETE /api/test-comments/:commentId
 */
export async function deleteTestComment(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { commentId } = req.params

  const comment = await prisma.testComment.findUnique({
    where: { id: commentId },
    include: {
      message: {
        include: {
          session: {
            include: {
              project: {
                select: { ownerId: true },
              },
            },
          },
        },
      },
    },
  })

  if (!comment) {
    throw new NotFoundError('Test comment')
  }

  if (comment.message.session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this comment')
  }

  await prisma.testComment.delete({
    where: { id: commentId },
  })

  res.json({ success: true })
}
