import { Router } from 'express'
import {
  createShareLink,
  getProjectShareLinks,
  verifyShareLinkAccess,
  updateShareLink,
  deleteShareLink,
} from '../controllers/shareLink.controller'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route   POST /api/projects/:projectId/share-links
 * @desc    Create a share link for a project
 * @access  Private
 */
router.post('/projects/:projectId/share-links', authenticate, asyncHandler(createShareLink))

/**
 * @route   GET /api/projects/:projectId/share-links
 * @desc    Get all share links for a project
 * @access  Private
 */
router.get('/projects/:projectId/share-links', authenticate, asyncHandler(getProjectShareLinks))

/**
 * @route   POST /api/share/:slug/verify
 * @desc    Verify access to a share link
 * @access  Public
 */
router.post('/share/:slug/verify', asyncHandler(verifyShareLinkAccess))

/**
 * @route   PATCH /api/share-links/:shareLinkId
 * @desc    Update a share link
 * @access  Private
 */
router.patch('/share-links/:shareLinkId', authenticate, asyncHandler(updateShareLink))

/**
 * @route   DELETE /api/share-links/:shareLinkId
 * @desc    Delete a share link
 * @access  Private
 */
router.delete('/share-links/:shareLinkId', authenticate, asyncHandler(deleteShareLink))

export default router
