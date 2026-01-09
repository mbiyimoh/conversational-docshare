import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'  // CUSTOMIZE: Update import path
import { CreateFeedbackSchema } from '@/lib/validation'  // CUSTOMIZE: Update import path
import { ApiErrorHandler } from '@/lib/api-errors'  // CUSTOMIZE: Update import path
import prisma from '@/lib/db'  // CUSTOMIZE: Update import path
import { Prisma, FeedbackArea, FeedbackType, FeedbackStatus } from '@/lib/generated/prisma'  // CUSTOMIZE: Update to your Prisma client path

/**
 * POST /api/feedback
 * Create new feedback submission
 *
 * Requires authentication. Creates feedback with attachments atomically.
 *
 * Request body:
 * - title: string (5-200 chars)
 * - description: string (10-5000 chars)
 * - area: FeedbackArea enum
 * - type: FeedbackType enum
 * - attachments: array of { url, filename, mimeType, sizeBytes } (optional)
 *
 * Returns 201 with created feedback object
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate input
    const body = await req.json()
    const validated = CreateFeedbackSchema.parse(body)

    // 3. Create feedback with attachments atomically
    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        title: validated.title,
        description: validated.description,
        area: validated.area,
        type: validated.type,
        attachments: {
          create: validated.attachments.map(attachment => ({
            url: attachment.url,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes
          }))
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        attachments: true,
        votes: false // Don't include votes array
      }
    })

    return NextResponse.json({ feedback }, { status: 201 })

  } catch (error) {
    return ApiErrorHandler.handle(error)
  }
}

/**
 * GET /api/feedback
 * List feedback submissions with filtering and pagination
 *
 * Query parameters:
 * - sort: 'popular' (default) | 'recent' | 'oldest'
 * - area: FeedbackArea enum (optional filter)
 * - type: FeedbackType enum (optional filter)
 * - status: FeedbackStatus enum (optional, defaults to open statuses)
 * - limit: number (default 50, max 100)
 * - cursor: feedback ID for pagination (optional)
 *
 * Returns 200 with:
 * - feedback: Array of feedback items
 * - nextCursor: ID for next page (null if no more)
 * - hasMore: boolean
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'popular'
    const area = searchParams.get('area')
    const type = searchParams.get('type')
    const statusParam = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const cursor = searchParams.get('cursor')

    // Optional: Get current user for hasUserUpvoted flag
    const user = await getCurrentUser().catch(() => null)

    // Build where clause using Prisma types
    const where: Prisma.FeedbackWhereInput = {}

    // Default to showing non-closed feedback
    if (statusParam) {
      where.status = statusParam as FeedbackStatus
    } else {
      where.status = { in: [FeedbackStatus.OPEN, FeedbackStatus.IN_REVIEW, FeedbackStatus.PLANNED, FeedbackStatus.IN_PROGRESS] }
    }

    if (area) where.area = area as FeedbackArea
    if (type) where.type = type as FeedbackType

    // Build orderBy clause
    const orderBy: Prisma.FeedbackOrderByWithRelationInput =
      sort === 'popular' ? { upvoteCount: 'desc' } :
      sort === 'recent' ? { createdAt: 'desc' } :
      { createdAt: 'asc' }

    // Fetch feedback with pagination (single query)
    const feedback = await prisma.feedback.findMany({
      where,
      orderBy,
      take: limit + 1, // Fetch one extra to determine hasMore
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0, // Skip the cursor item itself
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
            // Don't expose email in public API
          }
        },
        attachments: true,
        _count: {
          select: { votes: true }
        }
      }
    })

    const hasMore = feedback.length > limit
    const items = hasMore ? feedback.slice(0, -1) : feedback

    // Fetch all user votes in a single query (if authenticated)
    let userVoteSet = new Set<string>()
    if (user && items.length > 0) {
      const feedbackIds = items.map(item => item.id)
      const userVotes = await prisma.feedbackVote.findMany({
        where: {
          userId: user.id,
          feedbackId: { in: feedbackIds }
        },
        select: { feedbackId: true }
      })
      userVoteSet = new Set(userVotes.map(v => v.feedbackId))
    }

    // Transform to include hasUserUpvoted flag (O(1) Set lookup)
    const enriched = items.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      area: item.area,
      type: item.type,
      status: item.status,
      upvoteCount: item.upvoteCount,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      user: item.user,
      attachments: item.attachments,
      hasUserUpvoted: userVoteSet.has(item.id)
    }))

    return NextResponse.json({
      feedback: enriched,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore
    })

  } catch (error) {
    return ApiErrorHandler.handle(error)
  }
}
