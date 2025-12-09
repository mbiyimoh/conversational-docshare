import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getCurrentSynthesis,
  getSynthesisVersions,
  getSynthesisVersion,
  regenerateSynthesis,
} from '../controllers/audienceSynthesis.controller'

const router = Router()

// Get current (latest) synthesis
router.get(
  '/projects/:projectId/audience-synthesis',
  authenticate,
  asyncHandler(getCurrentSynthesis)
)

// Get version history
router.get(
  '/projects/:projectId/audience-synthesis/versions',
  authenticate,
  asyncHandler(getSynthesisVersions)
)

// Get specific version
router.get(
  '/projects/:projectId/audience-synthesis/versions/:version',
  authenticate,
  asyncHandler(getSynthesisVersion)
)

// Regenerate synthesis
router.post(
  '/projects/:projectId/audience-synthesis/regenerate',
  authenticate,
  asyncHandler(regenerateSynthesis)
)

export default router
