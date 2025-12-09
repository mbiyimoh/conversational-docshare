import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { optionalAuthenticate, authenticate } from '../middleware/auth'
import {
  createComment,
  getComments,
  updateCommentStatus,
} from '../controllers/documentComment.controller'

const router = Router()

/**
 * @route   POST /api/documents/:documentId/comments
 * @desc    Create comment on document (public for collaborators)
 * @access  Public
 */
router.post('/documents/:documentId/comments', optionalAuthenticate, asyncHandler(createComment))

/**
 * @route   GET /api/documents/:documentId/comments
 * @desc    Get comments for document
 * @access  Public
 */
router.get('/documents/:documentId/comments', optionalAuthenticate, asyncHandler(getComments))

/**
 * @route   PATCH /api/comments/:id/status
 * @desc    Update comment status (owner only)
 * @access  Private
 */
router.patch('/comments/:id/status', authenticate, asyncHandler(updateCommentStatus))

export default router
