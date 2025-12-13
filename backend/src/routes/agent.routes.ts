import { Router } from 'express'
import {
  saveAgentConfig,
  getAgentConfig,
  updateAgentPreferences,
  getProjectContextLayers,
  updateContextLayer,
  generateAgentProfile,
  generateAgentProfileStream,
  getAgentProfile,
  updateAgentProfile,
  synthesizeAgentProfileHandler,
  saveAgentProfileHandler,
} from '../controllers/agent.controller'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route   POST /api/projects/:projectId/agent
 * @desc    Save agent configuration from interview
 * @access  Private
 */
router.post('/projects/:projectId/agent', authenticate, asyncHandler(saveAgentConfig))

/**
 * @route   GET /api/projects/:projectId/agent
 * @desc    Get agent configuration
 * @access  Private
 */
router.get('/projects/:projectId/agent', authenticate, asyncHandler(getAgentConfig))

/**
 * @route   PATCH /api/projects/:projectId/agent/preferences
 * @desc    Update agent model preferences
 * @access  Private
 */
router.patch('/projects/:projectId/agent/preferences', authenticate, asyncHandler(updateAgentPreferences))

/**
 * @route   GET /api/projects/:projectId/context-layers
 * @desc    Get context layers for a project
 * @access  Private
 */
router.get('/projects/:projectId/context-layers', authenticate, asyncHandler(getProjectContextLayers))

/**
 * @route   PATCH /api/context-layers/:layerId
 * @desc    Update a context layer
 * @access  Private
 */
router.patch('/context-layers/:layerId', authenticate, asyncHandler(updateContextLayer))

/**
 * @route   POST /api/projects/:projectId/agent/profile
 * @desc    Generate or regenerate AI agent profile
 * @access  Private
 */
router.post('/projects/:projectId/agent/profile', authenticate, asyncHandler(generateAgentProfile))

/**
 * @route   POST /api/projects/:projectId/agent/profile/generate-stream
 * @desc    Generate AI agent profile with SSE streaming progress
 * @access  Private
 */
router.post(
  '/projects/:projectId/agent/profile/generate-stream',
  authenticate,
  asyncHandler(generateAgentProfileStream)
)

/**
 * @route   GET /api/projects/:projectId/agent/profile
 * @desc    Get AI agent profile
 * @access  Private
 */
router.get('/projects/:projectId/agent/profile', authenticate, asyncHandler(getAgentProfile))

/**
 * @route   PATCH /api/projects/:projectId/agent/profile
 * @desc    Update a specific profile section
 * @access  Private
 */
router.patch('/projects/:projectId/agent/profile', authenticate, asyncHandler(updateAgentProfile))

// ============================================================================
// V2 BRAINDUMP SYNTHESIS ROUTES
// ============================================================================

/**
 * @route   POST /api/projects/:projectId/profile/synthesize
 * @desc    Synthesize 12-field agent profile from natural language braindump (preview only, no save)
 * @access  Private
 */
router.post(
  '/projects/:projectId/profile/synthesize',
  authenticate,
  asyncHandler(synthesizeAgentProfileHandler)
)

/**
 * @route   POST /api/projects/:projectId/profile/save
 * @desc    Save a synthesized braindump profile to database
 * @access  Private
 */
router.post(
  '/projects/:projectId/profile/save',
  authenticate,
  asyncHandler(saveAgentProfileHandler)
)

export default router
