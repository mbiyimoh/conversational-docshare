import { Router } from 'express'
import {
  getProjectAnalytics,
  getConversationAnalytics,
  exportConversationsCSV,
} from '../controllers/analytics.controller'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route GET /api/projects/:projectId/analytics
 * @desc Get analytics for a project
 * @access Private (project owner only)
 */
router.get('/projects/:projectId/analytics', authenticate, asyncHandler(getProjectAnalytics))

/**
 * @route GET /api/projects/:projectId/analytics/export
 * @desc Export project conversations as CSV
 * @access Private (project owner only)
 */
router.get(
  '/projects/:projectId/analytics/export',
  authenticate,
  asyncHandler(exportConversationsCSV)
)

/**
 * @route GET /api/conversations/:conversationId/analytics
 * @desc Get detailed analytics for a conversation
 * @access Private (project owner only)
 */
router.get(
  '/conversations/:conversationId/analytics',
  authenticate,
  asyncHandler(getConversationAnalytics)
)

export default router
