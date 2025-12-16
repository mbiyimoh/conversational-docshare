import { Router } from 'express'
import {
  uploadDocument,
  getProjectDocuments,
  getDocument,
  deleteDocument,
  downloadDocument,
  retryDocument,
} from '../controllers/document.controller'
import { authenticate } from '../middleware/auth'
import { uploadSingle, handleMulterError } from '../middleware/upload'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route   POST /api/projects/:projectId/documents
 * @desc    Upload a document to a project
 * @access  Private
 */
router.post(
  '/projects/:projectId/documents',
  authenticate,
  uploadSingle,
  handleMulterError,
  asyncHandler(uploadDocument)
)

/**
 * @route   GET /api/projects/:projectId/documents
 * @desc    Get all documents for a project
 * @access  Private
 */
router.get('/projects/:projectId/documents', authenticate, asyncHandler(getProjectDocuments))

/**
 * @route   GET /api/documents/:documentId
 * @desc    Get a single document
 * @access  Private
 */
router.get('/documents/:documentId', authenticate, asyncHandler(getDocument))

/**
 * @route   DELETE /api/documents/:documentId
 * @desc    Delete a document
 * @access  Private
 */
router.delete('/documents/:documentId', authenticate, asyncHandler(deleteDocument))

/**
 * @route   GET /api/documents/:documentId/download
 * @desc    Download a document file
 * @access  Private
 */
router.get('/documents/:documentId/download', authenticate, asyncHandler(downloadDocument))

/**
 * @route   POST /api/documents/:documentId/retry
 * @desc    Retry processing a failed document
 * @access  Private
 */
router.post('/documents/:documentId/retry', authenticate, asyncHandler(retryDocument))

export default router
