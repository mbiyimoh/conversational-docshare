import { Router } from 'express'
import {
  startConversation,
  sendMessage,
  sendMessageStream,
  getConversationHistory,
  getProjectConversations,
} from '../controllers/chat.controller'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route   POST /api/projects/:projectId/conversations
 * @desc    Start a new conversation
 * @access  Public
 */
router.post('/projects/:projectId/conversations', asyncHandler(startConversation))

/**
 * @route   POST /api/conversations/:conversationId/messages
 * @desc    Send a message in a conversation
 * @access  Public
 */
router.post('/conversations/:conversationId/messages', asyncHandler(sendMessage))

/**
 * @route   POST /api/conversations/:conversationId/messages/stream
 * @desc    Send a message with streaming response
 * @access  Public
 */
router.post('/conversations/:conversationId/messages/stream', asyncHandler(sendMessageStream))

/**
 * @route   GET /api/conversations/:conversationId
 * @desc    Get conversation history
 * @access  Public
 */
router.get('/conversations/:conversationId', asyncHandler(getConversationHistory))

/**
 * @route   GET /api/projects/:projectId/conversations
 * @desc    Get all conversations for a project
 * @access  Private (owner only)
 */
router.get('/projects/:projectId/conversations', authenticate, asyncHandler(getProjectConversations))

export default router
