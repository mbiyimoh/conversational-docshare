import { Router } from 'express'
import {
  createShareLink,
  getProjectShareLinks,
  getShareLinkBySlug,
  verifyShareLinkAccess,
  updateShareLink,
  deleteShareLink,
  getShareLinkDocument,
  getShareLinkDocuments,
  getShareLinkDocumentChunks,
  generateOpeningMessage,
  refineOpeningMessage,
  updateOpeningMessage,
  restoreOpeningMessageVersion,
  generateOpeningMessagePreview,
  refineOpeningMessagePreview,
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
 * @route   GET /api/share/:slug
 * @desc    Get share link and project info by slug
 * @access  Public
 */
router.get('/share/:slug', asyncHandler(getShareLinkBySlug))

/**
 * @route   POST /api/share/:slug/verify
 * @desc    Verify access to a share link
 * @access  Public
 */
router.post('/share/:slug/verify', asyncHandler(verifyShareLinkAccess))

/**
 * @route   GET /api/share/:slug/documents
 * @desc    Get all documents for a share link (for document lookup cache)
 * @access  Public (share link must be valid)
 */
router.get('/share/:slug/documents', asyncHandler(getShareLinkDocuments))

/**
 * @route   GET /api/share/:slug/documents/:documentId
 * @desc    Get a specific document via share link
 * @access  Public (share link must be valid)
 */
router.get('/share/:slug/documents/:documentId', asyncHandler(getShareLinkDocument))

/**
 * @route   GET /api/share/:slug/documents/:documentId/chunks
 * @desc    Get document chunks for content rendering
 * @access  Public (share link must be valid)
 */
router.get('/share/:slug/documents/:documentId/chunks', asyncHandler(getShareLinkDocumentChunks))

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

// ============================================================================
// OPENING MESSAGE ROUTES
// ============================================================================

// --- Preview Endpoints (before share link creation) ---

/**
 * @route   POST /api/projects/:projectId/opening-message/preview
 * @desc    Generate an opening message preview without creating a share link
 * @access  Private
 */
router.post(
  '/projects/:projectId/opening-message/preview',
  authenticate,
  asyncHandler(generateOpeningMessagePreview)
)

/**
 * @route   POST /api/projects/:projectId/opening-message/refine-preview
 * @desc    Refine an opening message preview without saving to database
 * @access  Private
 */
router.post(
  '/projects/:projectId/opening-message/refine-preview',
  authenticate,
  asyncHandler(refineOpeningMessagePreview)
)

// --- Share Link Endpoints (after share link creation) ---

/**
 * @route   POST /api/share-links/:shareLinkId/opening-message/generate
 * @desc    Generate an opening message for a share link
 * @access  Private
 */
router.post(
  '/share-links/:shareLinkId/opening-message/generate',
  authenticate,
  asyncHandler(generateOpeningMessage)
)

/**
 * @route   POST /api/share-links/:shareLinkId/opening-message/refine
 * @desc    Refine an existing opening message with AI
 * @access  Private
 */
router.post(
  '/share-links/:shareLinkId/opening-message/refine',
  authenticate,
  asyncHandler(refineOpeningMessage)
)

/**
 * @route   PATCH /api/share-links/:shareLinkId/opening-message
 * @desc    Update opening message manually
 * @access  Private
 */
router.patch(
  '/share-links/:shareLinkId/opening-message',
  authenticate,
  asyncHandler(updateOpeningMessage)
)

/**
 * @route   POST /api/share-links/:shareLinkId/opening-message/restore
 * @desc    Restore a previous version of the opening message
 * @access  Private
 */
router.post(
  '/share-links/:shareLinkId/opening-message/restore',
  authenticate,
  asyncHandler(restoreOpeningMessageVersion)
)

export default router
