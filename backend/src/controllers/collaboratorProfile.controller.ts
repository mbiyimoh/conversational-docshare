import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'
import { synthesizeCollaboratorProfile } from '../services/profileBrainDumpSynthesizer'

/**
 * List all collaborator profiles for the authenticated user
 * GET /api/collaborator-profiles
 */
export async function getCollaboratorProfiles(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const profiles = await prisma.collaboratorProfile.findMany({
    where: { ownerId: req.user.userId },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({ profiles })
}

/**
 * Create a new collaborator profile
 * POST /api/collaborator-profiles
 */
export async function createCollaboratorProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { name, email, description, communicationNotes, expertiseAreas, feedbackStyle } = req.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Name is required')
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format')
  }

  // Validate feedbackStyle if provided
  const validFeedbackStyles = ['direct', 'gentle', 'detailed', 'high-level']
  if (feedbackStyle && !validFeedbackStyles.includes(feedbackStyle)) {
    throw new ValidationError(`feedbackStyle must be one of: ${validFeedbackStyles.join(', ')}`)
  }

  // Validate expertiseAreas is array of strings
  if (expertiseAreas && !Array.isArray(expertiseAreas)) {
    throw new ValidationError('expertiseAreas must be an array')
  }

  const profile = await prisma.collaboratorProfile.create({
    data: {
      ownerId: req.user.userId,
      name: name.trim(),
      email: email || null,
      description: description || null,
      communicationNotes: communicationNotes || null,
      expertiseAreas: expertiseAreas || [],
      feedbackStyle: feedbackStyle || null,
    },
  })

  res.status(201).json({ profile })
}

/**
 * Update a collaborator profile
 * PATCH /api/collaborator-profiles/:id
 */
export async function updateCollaboratorProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { name, email, description, communicationNotes, expertiseAreas, feedbackStyle } = req.body

  // Verify ownership
  const existing = await prisma.collaboratorProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Collaborator profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty')
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format')
  }

  // Validate feedbackStyle if provided
  const validFeedbackStyles = ['direct', 'gentle', 'detailed', 'high-level']
  if (feedbackStyle && !validFeedbackStyles.includes(feedbackStyle)) {
    throw new ValidationError(`feedbackStyle must be one of: ${validFeedbackStyles.join(', ')}`)
  }

  const profile = await prisma.collaboratorProfile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(email !== undefined && { email }),
      ...(description !== undefined && { description }),
      ...(communicationNotes !== undefined && { communicationNotes }),
      ...(expertiseAreas !== undefined && { expertiseAreas }),
      ...(feedbackStyle !== undefined && { feedbackStyle }),
    },
  })

  res.json({ profile })
}

/**
 * Delete a collaborator profile
 * DELETE /api/collaborator-profiles/:id
 */
export async function deleteCollaboratorProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.collaboratorProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Collaborator profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  await prisma.collaboratorProfile.delete({ where: { id } })

  res.status(204).send()
}

/**
 * Increment usage count for a profile
 * POST /api/collaborator-profiles/:id/use
 */
export async function incrementCollaboratorProfileUsage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.collaboratorProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Collaborator profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  const profile = await prisma.collaboratorProfile.update({
    where: { id },
    data: { timesUsed: { increment: 1 } },
  })

  res.json({ profile })
}

/**
 * Synthesize collaborator profile from raw input
 * POST /api/collaborator-profiles/synthesize
 */
export async function synthesizeCollaboratorProfileHandler(req: Request, res: Response) {
  const { rawInput, additionalContext } = req.body

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    const profile = await synthesizeCollaboratorProfile(rawInput, additionalContext)
    return res.json({ profile })
  } catch (error) {
    console.error('Collaborator profile synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}
