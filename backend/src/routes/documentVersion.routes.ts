import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import {
  getDocumentForEdit,
  saveDocumentVersion,
  listDocumentVersions,
  getDocumentVersion,
  rollbackDocumentVersion,
} from '../controllers/documentVersion.controller'

const router = Router()

// GET /api/documents/:documentId/edit - Get document for editing
router.get('/documents/:documentId/edit', authenticate, asyncHandler(getDocumentForEdit))

// POST /api/documents/:documentId/versions - Create new version
router.post('/documents/:documentId/versions', authenticate, asyncHandler(saveDocumentVersion))

// GET /api/documents/:documentId/versions - List all versions
router.get('/documents/:documentId/versions', authenticate, asyncHandler(listDocumentVersions))

// GET /api/documents/:documentId/versions/:versionNum - Get specific version
router.get(
  '/documents/:documentId/versions/:versionNum',
  authenticate,
  asyncHandler(getDocumentVersion)
)

// POST /api/documents/:documentId/rollback/:versionNum - Rollback to version
router.post(
  '/documents/:documentId/rollback/:versionNum',
  authenticate,
  asyncHandler(rollbackDocumentVersion)
)

export { router as documentVersionRoutes }
