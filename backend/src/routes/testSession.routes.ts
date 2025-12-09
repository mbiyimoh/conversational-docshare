import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getTestSessions,
  createTestSession,
  getTestSession,
  updateTestSession,
  deleteTestSession,
  sendTestMessage,
  addTestComment,
  deleteTestComment,
} from '../controllers/testSession.controller'

const router = Router()

// Session routes (require project ownership)
router.get('/projects/:projectId/test-sessions', authenticate, asyncHandler(getTestSessions))
router.post('/projects/:projectId/test-sessions', authenticate, asyncHandler(createTestSession))
router.get('/test-sessions/:sessionId', authenticate, asyncHandler(getTestSession))
router.patch('/test-sessions/:sessionId', authenticate, asyncHandler(updateTestSession))
router.delete('/test-sessions/:sessionId', authenticate, asyncHandler(deleteTestSession))

// Message routes (SSE streaming)
router.post('/test-sessions/:sessionId/messages', authenticate, asyncHandler(sendTestMessage))

// Comment routes
router.post('/test-messages/:messageId/comments', authenticate, asyncHandler(addTestComment))
router.delete('/test-comments/:commentId', authenticate, asyncHandler(deleteTestComment))

export default router
