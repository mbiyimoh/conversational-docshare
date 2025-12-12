import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getAudienceProfiles,
  createAudienceProfile,
  updateAudienceProfile,
  deleteAudienceProfile,
  incrementAudienceProfileUsage,
  synthesizeAudienceProfileHandler,
} from '../controllers/audienceProfile.controller'

const router = Router()

router.get('/audience-profiles', authenticate, asyncHandler(getAudienceProfiles))
router.post('/audience-profiles', authenticate, asyncHandler(createAudienceProfile))
router.patch('/audience-profiles/:id', authenticate, asyncHandler(updateAudienceProfile))
router.delete('/audience-profiles/:id', authenticate, asyncHandler(deleteAudienceProfile))
router.post('/audience-profiles/:id/use', authenticate, asyncHandler(incrementAudienceProfileUsage))
router.post('/audience-profiles/synthesize', authenticate, asyncHandler(synthesizeAudienceProfileHandler))

export default router
