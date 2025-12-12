import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'
import { synthesizeAudienceProfile } from '../services/profileBrainDumpSynthesizer'

/**
 * List all audience profiles for the authenticated user
 * GET /api/audience-profiles
 */
export async function getAudienceProfiles(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const profiles = await prisma.audienceProfile.findMany({
    where: { ownerId: req.user.userId },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({ profiles })
}

/**
 * Create a new audience profile
 * POST /api/audience-profiles
 */
export async function createAudienceProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { name, description, audienceDescription, communicationStyle, topicsEmphasis, accessType } = req.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Name is required')
  }

  // Validate accessType if provided
  const validAccessTypes = ['open', 'email', 'password', 'domain']
  if (accessType && !validAccessTypes.includes(accessType)) {
    throw new ValidationError(`accessType must be one of: ${validAccessTypes.join(', ')}`)
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

/**
 * Update an audience profile
 * PATCH /api/audience-profiles/:id
 */
export async function updateAudienceProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { name, description, audienceDescription, communicationStyle, topicsEmphasis, accessType } = req.body

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Audience profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty')
  }

  // Validate accessType if provided
  const validAccessTypes = ['open', 'email', 'password', 'domain']
  if (accessType && !validAccessTypes.includes(accessType)) {
    throw new ValidationError(`accessType must be one of: ${validAccessTypes.join(', ')}`)
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

/**
 * Delete an audience profile
 * DELETE /api/audience-profiles/:id
 */
export async function deleteAudienceProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Audience profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  await prisma.audienceProfile.delete({ where: { id } })

  res.status(204).send()
}

/**
 * Increment usage count for a profile
 * POST /api/audience-profiles/:id/use
 */
export async function incrementAudienceProfileUsage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Audience profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  const profile = await prisma.audienceProfile.update({
    where: { id },
    data: { timesUsed: { increment: 1 } },
  })

  res.json({ profile })
}

/**
 * Synthesize audience profile from raw input
 * POST /api/audience-profiles/synthesize
 */
export async function synthesizeAudienceProfileHandler(req: Request, res: Response) {
  const { rawInput, additionalContext } = req.body

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return res.status(400).json({ error: 'rawInput is required' })
  }

  try {
    const profile = await synthesizeAudienceProfile(rawInput, additionalContext)
    return res.json({ profile })
  } catch (error) {
    console.error('Audience profile synthesis failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Synthesis failed'
    })
  }
}
