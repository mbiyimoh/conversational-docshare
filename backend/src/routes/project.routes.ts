import { Router } from 'express'
import {
  createProject,
  getUserProjects,
  getProject,
  updateProject,
  deleteProject,
} from '../controllers/project.controller'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(createProject))

/**
 * @route   GET /api/projects
 * @desc    Get all projects for current user
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(getUserProjects))

/**
 * @route   GET /api/projects/:projectId
 * @desc    Get a single project
 * @access  Private
 */
router.get('/:projectId', authenticate, asyncHandler(getProject))

/**
 * @route   PATCH /api/projects/:projectId
 * @desc    Update a project
 * @access  Private
 */
router.patch('/:projectId', authenticate, asyncHandler(updateProject))

/**
 * @route   DELETE /api/projects/:projectId
 * @desc    Delete a project
 * @access  Private
 */
router.delete('/:projectId', authenticate, asyncHandler(deleteProject))

export default router
