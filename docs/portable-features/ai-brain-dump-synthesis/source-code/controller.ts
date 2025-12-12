/**
 * AI Brain Dump Synthesis - Backend Controller Handlers
 *
 * HTTP controller handlers for the synthesis endpoints.
 * Add these handlers to your controller and register the routes.
 *
 * Dependencies:
 * - Express.js (or adapt to your HTTP framework)
 * - Your synthesis service
 * - Your error classes
 */

import { Request, Response } from 'express'
// Adapt these imports to your project structure:
// import { prisma } from '../utils/prisma'
// import { AuthorizationError, ValidationError } from '../utils/errors'
import {
  synthesizeAudienceProfile,
  synthesizeCollaboratorProfile
} from '../services/profileBrainDumpSynthesizer'

// ============================================================================
// Synthesis Handlers - The core of this feature
// ============================================================================

/**
 * Synthesize audience profile from raw input
 *
 * POST /api/audience-profiles/synthesize
 *
 * Request body:
 * - rawInput: string (required) - Natural language description
 * - additionalContext?: string (optional) - Extra context for refinement
 *
 * Response:
 * - profile: SynthesizedAudienceProfile
 *
 * Note: This endpoint returns a PREVIEW only - not saved to database.
 * The frontend shows this preview and user must confirm before saving.
 */
export async function synthesizeAudienceProfileHandler(
  req: Request,
  res: Response
) {
  const { rawInput, additionalContext } = req.body

  // Validate input
  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    // Call the synthesis service
    const profile = await synthesizeAudienceProfile(rawInput, additionalContext)
    return res.json({ profile })
  } catch (error) {
    console.error('Audience profile synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}

/**
 * Synthesize collaborator profile from raw input
 *
 * POST /api/collaborator-profiles/synthesize
 *
 * Request body:
 * - rawInput: string (required) - Natural language description
 * - additionalContext?: string (optional) - Extra context for refinement
 *
 * Response:
 * - profile: SynthesizedCollaboratorProfile
 */
export async function synthesizeCollaboratorProfileHandler(
  req: Request,
  res: Response
) {
  const { rawInput, additionalContext } = req.body

  // Validate input
  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    // Call the synthesis service
    const profile = await synthesizeCollaboratorProfile(rawInput, additionalContext)
    return res.json({ profile })
  } catch (error) {
    console.error('Collaborator profile synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}

// ============================================================================
// Route Registration Example
// ============================================================================

/**
 * Example route registration for Express.js
 *
 * Add to your routes file:
 *
 * ```typescript
 * import { Router } from 'express'
 * import { asyncHandler } from '../utils/asyncHandler'  // Your async error wrapper
 * import { authenticate } from '../middleware/auth'     // Your auth middleware
 * import {
 *   synthesizeAudienceProfileHandler,
 *   synthesizeCollaboratorProfileHandler
 * } from '../controllers/synthesis.controller'
 *
 * const router = Router()
 *
 * // Synthesis endpoints (require authentication)
 * router.post(
 *   '/audience-profiles/synthesize',
 *   authenticate,
 *   asyncHandler(synthesizeAudienceProfileHandler)
 * )
 *
 * router.post(
 *   '/collaborator-profiles/synthesize',
 *   authenticate,
 *   asyncHandler(synthesizeCollaboratorProfileHandler)
 * )
 *
 * export default router
 * ```
 */

// ============================================================================
// Example: Complete CRUD Controller with Synthesis
// ============================================================================

/**
 * Below is a complete example showing how synthesis fits with CRUD operations.
 * The key insight: synthesis returns a PREVIEW, not a saved record.
 * User must approve the preview before it's saved via the create endpoint.
 */

/*
// List all profiles
export async function getAudienceProfiles(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const profiles = await prisma.audienceProfile.findMany({
    where: { ownerId: req.user.userId },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({ profiles })
}

// Create a profile (after synthesis preview is approved)
export async function createAudienceProfile(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { name, description, audienceDescription, communicationStyle, topicsEmphasis, accessType } = req.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Name is required')
  }

  const profile = await prisma.audienceProfile.create({
    data: {
      ownerId: req.user.userId,
      name: name.trim(),
      description: description || null,
      audienceDescription: audienceDescription || null,
      communicationStyle: communicationStyle || null,
      topicsEmphasis: topicsEmphasis || null,
      accessType: accessType || 'password',
    },
  })

  res.status(201).json({ profile })
}

// Update a profile
export async function updateAudienceProfile(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { id } = req.params
  const { name, description, audienceDescription, communicationStyle, topicsEmphasis, accessType } = req.body

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) throw new NotFoundError('Audience profile')
  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  const profile = await prisma.audienceProfile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(audienceDescription !== undefined && { audienceDescription }),
      ...(communicationStyle !== undefined && { communicationStyle }),
      ...(topicsEmphasis !== undefined && { topicsEmphasis }),
      ...(accessType !== undefined && { accessType }),
    },
  })

  res.json({ profile })
}

// Delete a profile
export async function deleteAudienceProfile(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) throw new NotFoundError('Audience profile')
  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  await prisma.audienceProfile.delete({ where: { id } })

  res.status(204).send()
}
*/
