import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'  // CUSTOMIZE: Update import path
import { VoteActionSchema } from '@/lib/validation'  // CUSTOMIZE: Update import path
import { ApiErrorHandler } from '@/lib/api-errors'  // CUSTOMIZE: Update import path
import prisma from '@/lib/db'  // CUSTOMIZE: Update import path

/**
 * POST /api/feedback/[id]/vote
 * Upvote or remove vote from feedback
 *
 * Requires authentication. Updates vote count atomically with transaction.
 *
 * Request body:
 * - action: 'upvote' | 'remove'
 *
 * Returns 200 with:
 * - success: boolean
 * - upvoteCount: number
 * - hasUserUpvoted: boolean
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validate input
    const body = await req.json()
    const { action } = VoteActionSchema.parse(body)

    const { id: feedbackId } = await params

    // 3. Perform vote action atomically
    if (action === 'upvote') {
      // Check if vote already exists
      const existingVote = await prisma.feedbackVote.findUnique({
        where: {
          feedbackId_userId: {
            feedbackId,
            userId: user.id
          }
        }
      })

      if (!existingVote) {
        // Create vote and increment counter atomically
        await prisma.$transaction([
          prisma.feedbackVote.create({
            data: {
              feedbackId,
              userId: user.id
            }
          }),
          prisma.feedback.update({
            where: { id: feedbackId },
            data: { upvoteCount: { increment: 1 } }
          })
        ])
      }
      // If vote already exists, no-op (idempotent)

    } else if (action === 'remove') {
      // Check if vote exists
      const existingVote = await prisma.feedbackVote.findUnique({
        where: {
          feedbackId_userId: {
            feedbackId,
            userId: user.id
          }
        }
      })

      if (existingVote) {
        // Delete vote and decrement counter atomically
        await prisma.$transaction([
          prisma.feedbackVote.delete({
            where: {
              feedbackId_userId: {
                feedbackId,
                userId: user.id
              }
            }
          }),
          prisma.feedback.update({
            where: { id: feedbackId },
            data: { upvoteCount: { decrement: 1 } }
          })
        ])
      }
      // If vote doesn't exist, no-op (idempotent)
    }

    // 4. Fetch updated feedback
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: {
        upvoteCount: true,
        votes: {
          where: { userId: user.id },
          select: { id: true }
        }
      }
    })

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      upvoteCount: feedback.upvoteCount,
      hasUserUpvoted: feedback.votes.length > 0
    })

  } catch (error) {
    return ApiErrorHandler.handle(error)
  }
}
