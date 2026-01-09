import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { z } from 'zod'
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  AuthenticationError,
} from '../utils/errors'

// Valid feedback areas for validation
const FEEDBACK_AREAS = [
  'DOCUMENT_UPLOAD',
  'AI_CHAT',
  'SHARE_LINKS',
  'ANALYTICS',
  'AGENT_CONFIG',
  'GENERAL',
] as const

const FEEDBACK_TYPES = ['BUG', 'ENHANCEMENT', 'IDEA', 'QUESTION'] as const
const FEEDBACK_STATUSES = ['OPEN', 'IN_REVIEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'] as const

// Zod validation schemas
const createFeedbackSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title must be 200 characters or less'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000, 'Description must be 5000 characters or less'),
  areas: z.array(z.enum(FEEDBACK_AREAS)).min(1, 'Select at least one area'),
  type: z.enum(FEEDBACK_TYPES),
})

const updateStatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
})

const voteSchema = z.object({
  action: z.enum(['upvote', 'remove']),
})

/**
 * List all feedback with optional filters and sorting
 * GET /api/feedback
 */
export async function listFeedback(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthenticationError()
  }

  const { sort = 'popular', area, type, status, limit = '50', cursor } = req.query

  // Build where clause for filters
  const where: {
    type?: (typeof FEEDBACK_TYPES)[number]
    status?: (typeof FEEDBACK_STATUSES)[number]
  } = {}

  if (type && FEEDBACK_TYPES.includes(type as (typeof FEEDBACK_TYPES)[number])) {
    where.type = type as (typeof FEEDBACK_TYPES)[number]
  }

  if (status && FEEDBACK_STATUSES.includes(status as (typeof FEEDBACK_STATUSES)[number])) {
    where.status = status as (typeof FEEDBACK_STATUSES)[number]
  }

  // Build orderBy based on sort param
  let orderBy: { upvoteCount?: 'desc'; createdAt?: 'desc' | 'asc' }
  switch (sort) {
    case 'recent':
      orderBy = { createdAt: 'desc' }
      break
    case 'oldest':
      orderBy = { createdAt: 'asc' }
      break
    case 'popular':
    default:
      orderBy = { upvoteCount: 'desc' }
  }

  const limitNum = Math.min(parseInt(limit as string) || 50, 100)

  // Build cursor-based pagination
  const cursorObj = cursor ? { id: cursor as string } : undefined

  const feedback = await prisma.feedback.findMany({
    where,
    orderBy,
    take: limitNum + 1, // Fetch one extra to check if there's more
    cursor: cursorObj,
    skip: cursorObj ? 1 : 0, // Skip the cursor item itself
    select: {
      id: true,
      title: true,
      description: true,
      areas: true,
      type: true,
      status: true,
      upvoteCount: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      votes: {
        where: { userId: req.user.userId },
        select: { id: true },
      },
    },
  })

  // Filter by area if specified (JSON array contains check)
  let filteredFeedback = feedback
  if (area && FEEDBACK_AREAS.includes(area as (typeof FEEDBACK_AREAS)[number])) {
    filteredFeedback = feedback.filter((f) => {
      const areas = f.areas as string[]
      return areas.includes(area as string)
    })
  }

  // Check if there's more data
  const hasMore = filteredFeedback.length > limitNum
  const items = hasMore ? filteredFeedback.slice(0, limitNum) : filteredFeedback
  const nextCursor = hasMore ? items[items.length - 1]?.id : null

  // Transform response
  const transformed = items.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    areas: f.areas as string[],
    type: f.type,
    status: f.status,
    upvoteCount: f.upvoteCount,
    hasUserUpvoted: f.votes.length > 0,
    createdAt: f.createdAt.toISOString(),
    user: f.user,
  }))

  res.json({
    feedback: transformed,
    nextCursor,
  })
}

/**
 * Create new feedback
 * POST /api/feedback
 */
export async function createFeedback(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthenticationError()
  }

  // Validate input
  const parseResult = createFeedbackSchema.safeParse(req.body)
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message)
  }

  const { title, description, areas, type } = parseResult.data

  // Create feedback with auto self-vote in a transaction
  const feedback = await prisma.$transaction(async (tx) => {
    // Create the feedback
    const newFeedback = await tx.feedback.create({
      data: {
        userId: req.user!.userId,
        title,
        description,
        areas: areas as unknown as string[],
        type,
        status: 'OPEN',
        upvoteCount: 1, // Start with 1 (self-vote)
      },
      select: {
        id: true,
        title: true,
        description: true,
        areas: true,
        type: true,
        status: true,
        upvoteCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create the self-vote
    await tx.feedbackVote.create({
      data: {
        feedbackId: newFeedback.id,
        userId: req.user!.userId,
      },
    })

    return newFeedback
  })

  res.status(201).json({
    feedback: {
      id: feedback.id,
      title: feedback.title,
      description: feedback.description,
      areas: feedback.areas as string[],
      type: feedback.type,
      status: feedback.status,
      upvoteCount: feedback.upvoteCount,
      hasUserUpvoted: true,
      createdAt: feedback.createdAt.toISOString(),
      user: feedback.user,
    },
  })
}

/**
 * Get single feedback by ID
 * GET /api/feedback/:id
 */
export async function getFeedback(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthenticationError()
  }

  const { id } = req.params

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      areas: true,
      type: true,
      status: true,
      upvoteCount: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      votes: {
        where: { userId: req.user.userId },
        select: { id: true },
      },
    },
  })

  if (!feedback) {
    throw new NotFoundError('Feedback')
  }

  res.json({
    feedback: {
      id: feedback.id,
      title: feedback.title,
      description: feedback.description,
      areas: feedback.areas as string[],
      type: feedback.type,
      status: feedback.status,
      upvoteCount: feedback.upvoteCount,
      hasUserUpvoted: feedback.votes.length > 0,
      createdAt: feedback.createdAt.toISOString(),
      user: feedback.user,
    },
  })
}

/**
 * Toggle upvote on feedback
 * POST /api/feedback/:id/vote
 */
export async function toggleVote(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthenticationError()
  }

  const { id } = req.params

  // Validate input
  const parseResult = voteSchema.safeParse(req.body)
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message)
  }

  const { action } = parseResult.data

  // Check feedback exists
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    select: { id: true, upvoteCount: true },
  })

  if (!feedback) {
    throw new NotFoundError('Feedback')
  }

  // Check if user already voted
  const existingVote = await prisma.feedbackVote.findUnique({
    where: {
      feedbackId_userId: {
        feedbackId: id,
        userId: req.user.userId,
      },
    },
  })

  let newUpvoteCount = feedback.upvoteCount
  let hasUserUpvoted = !!existingVote

  if (action === 'upvote' && !existingVote) {
    // Add vote
    await prisma.$transaction([
      prisma.feedbackVote.create({
        data: {
          feedbackId: id,
          userId: req.user.userId,
        },
      }),
      prisma.feedback.update({
        where: { id },
        data: { upvoteCount: { increment: 1 } },
      }),
    ])
    newUpvoteCount += 1
    hasUserUpvoted = true
  } else if (action === 'remove' && existingVote) {
    // Remove vote
    await prisma.$transaction([
      prisma.feedbackVote.delete({
        where: { id: existingVote.id },
      }),
      prisma.feedback.update({
        where: { id },
        data: { upvoteCount: { decrement: 1 } },
      }),
    ])
    newUpvoteCount = Math.max(0, newUpvoteCount - 1)
    hasUserUpvoted = false
  }

  res.json({
    upvoteCount: newUpvoteCount,
    hasUserUpvoted,
  })
}

/**
 * Update feedback status (SYSTEM_ADMIN only)
 * PATCH /api/feedback/:id/status
 */
export async function updateStatus(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthenticationError()
  }

  // Get user with role
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true },
  })

  if (!user || user.role !== 'SYSTEM_ADMIN') {
    throw new AuthorizationError('Only system administrators can update feedback status')
  }

  const { id } = req.params

  // Validate input
  const parseResult = updateStatusSchema.safeParse(req.body)
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message)
  }

  const { status } = parseResult.data

  // Check feedback exists
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!feedback) {
    throw new NotFoundError('Feedback')
  }

  // Update status
  const updated = await prisma.feedback.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      title: true,
      description: true,
      areas: true,
      type: true,
      status: true,
      upvoteCount: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  res.json({
    feedback: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      areas: updated.areas as string[],
      type: updated.type,
      status: updated.status,
      upvoteCount: updated.upvoteCount,
      createdAt: updated.createdAt.toISOString(),
      user: updated.user,
    },
  })
}
