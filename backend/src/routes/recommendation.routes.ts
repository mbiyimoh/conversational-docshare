import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getRecommendations,
  applyAllRecommendations,
  rollbackProfile,
  getProfileVersionHistory,
  dismissSingleRecommendation,
  getConversationRecommendations,
  applyConversationRecommendation,
  dismissConversationRecommendation,
} from '../controllers/recommendation.controller'

const router = Router()

// Generate profile-direct recommendations from testing feedback
router.post('/projects/:projectId/recommendations', authenticate, asyncHandler(getRecommendations))

// Apply all pending recommendations from a set
router.post('/projects/:projectId/recommendations/apply-all', authenticate, asyncHandler(applyAllRecommendations))

// Dismiss a single recommendation
router.post('/projects/:projectId/recommendations/:recommendationId/dismiss', authenticate, asyncHandler(dismissSingleRecommendation))

// Rollback profile to a previous version
router.post('/projects/:projectId/profile/rollback', authenticate, asyncHandler(rollbackProfile))

// Get profile version history
router.get('/projects/:projectId/profile/versions', authenticate, asyncHandler(getProfileVersionHistory))

// ============================================================================
// CONVERSATION RECOMMENDATIONS (Post-conversation document improvements)
// ============================================================================

// Get recommendations for a conversation
router.get('/conversations/:id/recommendations', authenticate, asyncHandler(getConversationRecommendations))

// Apply a conversation recommendation
router.post('/recommendations/:id/apply', authenticate, asyncHandler(applyConversationRecommendation))

// Dismiss a conversation recommendation
router.post('/recommendations/:id/dismiss', authenticate, asyncHandler(dismissConversationRecommendation))

export default router
