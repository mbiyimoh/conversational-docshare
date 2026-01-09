import { NextResponse } from 'next/server'
import { getCurrentUser, requireAdmin } from '@/lib/auth'  // CUSTOMIZE: Update import path
import { UpdateFeedbackSchema } from '@/lib/validation'  // CUSTOMIZE: Update import path
import { ApiErrorHandler } from '@/lib/api-errors'  // CUSTOMIZE: Update import path
import prisma from '@/lib/db'  // CUSTOMIZE: Update import path

/**
 * GET /api/feedback/[id]
 * Fetch single feedback item with full details
 *
 * Public endpoint - no authentication required.
 *
 * Returns 200 with feedback object including:
 * - Full description
 * - User info
 * - Attachments
 * - Vote count
 * - hasUserUpvoted (if authenticated)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: feedbackId } = await params

    // Optional: Get current user for hasUserUpvoted flag
    const user = await getCurrentUser().catch(() => null)

    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        attachments: true,
        ...(user ? {
          votes: {
            where: { userId: user.id },
            select: { id: true }
          }
        } : {})
      }
    })

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    // Transform response
    const response = {
      id: feedback.id,
      title: feedback.title,
      description: feedback.description,
      area: feedback.area,
      type: feedback.type,
      status: feedback.status,
      upvoteCount: feedback.upvoteCount,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
      user: feedback.user,
      attachments: feedback.attachments,
      hasUserUpvoted: user && 'votes' in feedback ? (feedback.votes as { id: string }[]).length > 0 : false
    }

    return NextResponse.json({ feedback: response })

  } catch (error) {
    return ApiErrorHandler.handle(error)
  }
}

/**
 * PATCH /api/feedback/[id]
 * Update feedback status (admin only)
 *
 * Requires authentication and admin role.
 * Currently only allows status updates.
 *
 * Request body:
 * - status: FeedbackStatus enum (optional)
 *
 * Returns 200 with updated feedback object
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Require admin access (throws 401/403 if not authorized)
    await requireAdmin()

    // 2. Validate input
    const body = await req.json()
    const validated = UpdateFeedbackSchema.parse(body)

    const { id: feedbackId } = await params

    // 3. Update feedback
    const feedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: validated,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        attachments: true
      }
    })

    return NextResponse.json({ feedback })

  } catch (error) {
    return ApiErrorHandler.handle(error)
  }
}
