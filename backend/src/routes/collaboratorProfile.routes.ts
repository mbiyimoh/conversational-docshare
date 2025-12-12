import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getCollaboratorProfiles,
  createCollaboratorProfile,
  updateCollaboratorProfile,
  deleteCollaboratorProfile,
  incrementCollaboratorProfileUsage,
  synthesizeCollaboratorProfileHandler,
} from '../controllers/collaboratorProfile.controller'

const router = Router()

router.get('/collaborator-profiles', authenticate, asyncHandler(getCollaboratorProfiles))
router.post('/collaborator-profiles', authenticate, asyncHandler(createCollaboratorProfile))
router.patch('/collaborator-profiles/:id', authenticate, asyncHandler(updateCollaboratorProfile))
router.delete('/collaborator-profiles/:id', authenticate, asyncHandler(deleteCollaboratorProfile))
router.post('/collaborator-profiles/:id/use', authenticate, asyncHandler(incrementCollaboratorProfileUsage))
router.post('/collaborator-profiles/synthesize', authenticate, asyncHandler(synthesizeCollaboratorProfileHandler))

export default router
