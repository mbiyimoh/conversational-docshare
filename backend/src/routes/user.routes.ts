import { Router } from 'express'
import { getSavedConversations, getDashboardData } from '../controllers/user.controller'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route   GET /api/users/me/saved-conversations
 * @desc    Get all saved conversations for the authenticated user
 * @access  Private
 */
router.get('/me/saved-conversations', authenticate, asyncHandler(getSavedConversations))

/**
 * @route   GET /api/users/me/dashboard
 * @desc    Get unified dashboard data (projects + saved conversations + stats)
 * @access  Private
 */
router.get('/me/dashboard', authenticate, asyncHandler(getDashboardData))

export default router
