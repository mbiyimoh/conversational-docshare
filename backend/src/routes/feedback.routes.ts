import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import {
  listFeedback,
  createFeedback,
  getFeedback,
  toggleVote,
  updateStatus,
} from '../controllers/feedback.controller'

const router = Router()

/**
 * @route   GET /api/feedback
 * @desc    List all feedback with optional filters
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(listFeedback))

/**
 * @route   POST /api/feedback
 * @desc    Create new feedback
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(createFeedback))

/**
 * @route   GET /api/feedback/:id
 * @desc    Get single feedback by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(getFeedback))

/**
 * @route   POST /api/feedback/:id/vote
 * @desc    Toggle upvote on feedback
 * @access  Private
 */
router.post('/:id/vote', authenticate, asyncHandler(toggleVote))

/**
 * @route   PATCH /api/feedback/:id/status
 * @desc    Update feedback status (admin only)
 * @access  Private (SYSTEM_ADMIN)
 */
router.patch('/:id/status', authenticate, asyncHandler(updateStatus))

export default router
