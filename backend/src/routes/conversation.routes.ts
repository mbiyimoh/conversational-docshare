import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { getConversationDetail, saveConversation, endConversation, continueConversation } from '../controllers/conversation.controller'

const router = Router()

/**
 * @route GET /api/conversations/:id
 * @desc Get full conversation details with messages
 * @access Private (project owner OR savedByUser)
 */
router.get('/:id', authenticate, asyncHandler(getConversationDetail))

/**
 * @route POST /api/conversations/:id/save
 * @desc Save a conversation to authenticated user's account
 * @access Private (requires authentication)
 */
router.post('/:id/save', authenticate, asyncHandler(saveConversation))

/**
 * @route POST /api/conversations/:id/end
 * @desc End a conversation and generate AI summary (if 5+ messages)
 * @access Public (no auth required - anonymous viewers can end their session)
 */
router.post('/:id/end', asyncHandler(endConversation))

/**
 * @route POST /api/conversations/:id/messages
 * @desc Continue a saved conversation with a new message (SSE streaming)
 * @access Private (only savedByUserId can continue)
 */
router.post('/:id/messages', authenticate, asyncHandler(continueConversation))

export default router
