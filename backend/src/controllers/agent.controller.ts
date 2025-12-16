import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { createContextLayersFromInterview, getContextLayers } from '../services/contextService'
import {
  regenerateProfile,
  AgentProfile,
  generateSingleSection,
  SECTION_ORDER,
  SECTION_NAMES,
  SectionId,
  synthesizeFromBrainDump,
  BrainDumpSynthesisResult,
  MIN_INPUT_LENGTH,
} from '../services/profileSynthesizer'
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors'
import type { ContextLayer } from '@prisma/client'

// Progress event types for SSE streaming
type ProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'section_start'; sectionId: string; sectionName: string }
  | { type: 'section_complete'; sectionId: string; content: string }
  | { type: 'complete'; profile: AgentProfile }
  | { type: 'error'; message: string }

interface InterviewData {
  audience?: string
  purpose?: string
  tone?: string
  emphasis?: string
  questions?: string
}

/**
 * Save agent configuration from interview
 */
export async function saveAgentConfig(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { interviewData, status, completionLevel } = req.body

  if (!interviewData) {
    throw new ValidationError('Interview data is required')
  }

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Upsert agent config
  const agentConfig = await prisma.agentConfig.upsert({
    where: { projectId },
    update: {
      interviewData,
      status: status || 'incomplete',
      completionLevel: completionLevel || 0,
    },
    create: {
      projectId,
      interviewData,
      status: status || 'incomplete',
      completionLevel: completionLevel || 0,
    },
  })

  // Create context layers from interview
  await createContextLayersFromInterview(projectId, interviewData)

  // Auto-regenerate profile if one already exists (async, don't block response)
  if (agentConfig.profile) {
    regenerateProfile(projectId).catch((err) => {
      console.error('Failed to auto-regenerate profile:', err)
    })
  }

  res.json({
    agentConfig: {
      id: agentConfig.id,
      status: agentConfig.status,
      completionLevel: agentConfig.completionLevel,
      preferredModel: agentConfig.preferredModel,
      temperature: agentConfig.temperature,
    },
  })
}

/**
 * Get agent configuration
 */
export async function getAgentConfig(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new NotFoundError('Agent configuration')
  }

  res.json({
    agentConfig: {
      id: agentConfig.id,
      interviewData: agentConfig.interviewData,
      status: agentConfig.status,
      completionLevel: agentConfig.completionLevel,
      preferredModel: agentConfig.preferredModel,
      temperature: agentConfig.temperature,
      createdAt: agentConfig.createdAt,
      updatedAt: agentConfig.updatedAt,
    },
  })
}

/**
 * Update agent model preferences
 */
export async function updateAgentPreferences(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { preferredModel, temperature } = req.body

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const agentConfig = await prisma.agentConfig.update({
    where: { projectId },
    data: {
      ...(preferredModel !== undefined && { preferredModel }),
      ...(temperature !== undefined && { temperature }),
    },
  })

  res.json({
    agentConfig: {
      id: agentConfig.id,
      preferredModel: agentConfig.preferredModel,
      temperature: agentConfig.temperature,
    },
  })
}

/**
 * Get context layers for a project
 */
export async function getProjectContextLayers(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const layers = await getContextLayers(projectId)

  res.json({
    contextLayers: layers.map((l: ContextLayer) => ({
      id: l.id,
      category: l.category,
      priority: l.priority,
      content: l.content,
      metadata: l.metadata,
      isActive: l.isActive,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  })
}

/**
 * Update a context layer
 */
export async function updateContextLayer(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { layerId } = req.params
  const { content, isActive, priority } = req.body

  // Get layer and verify ownership
  const layer = await prisma.contextLayer.findUnique({
    where: { id: layerId },
    include: {
      project: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!layer) {
    throw new NotFoundError('Context layer')
  }

  if (layer.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this context layer')
  }

  const updated = await prisma.contextLayer.update({
    where: { id: layerId },
    data: {
      ...(content !== undefined && { content }),
      ...(isActive !== undefined && { isActive }),
      ...(priority !== undefined && { priority }),
    },
  })

  res.json({
    contextLayer: {
      id: updated.id,
      category: updated.category,
      priority: updated.priority,
      content: updated.content,
      metadata: updated.metadata,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
  })
}

/**
 * Generate or regenerate AI agent profile from interview data
 * POST /api/projects/:projectId/agent/profile
 */
export async function generateAgentProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { force } = req.body

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Check if profile exists and force is false
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new NotFoundError('Agent configuration')
  }

  if (agentConfig.profile && !force) {
    res.json({ profile: agentConfig.profile, cached: true })
    return
  }

  // Generate new profile
  const profile = await regenerateProfile(projectId)

  res.json({ profile, cached: false })
}

/**
 * Generate AI agent profile with streaming progress
 * POST /api/projects/:projectId/agent/profile/generate-stream
 */
export async function generateAgentProfileStream(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Unauthorized' } })
    return
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    res.status(404).json({ error: { message: 'Project not found' } })
    return
  }

  if (project.ownerId !== req.user.userId) {
    res.status(403).json({ error: { message: 'You do not own this project' } })
    return
  }

  // Get agent config with interview data
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    res.status(404).json({ error: { message: 'Agent configuration not found' } })
    return
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  res.flushHeaders()

  const sendEvent = (data: ProgressEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const interviewData = agentConfig.interviewData as InterviewData

    // Determine if input is structured
    const allInputs = [
      interviewData.audience || '',
      interviewData.purpose || '',
      interviewData.tone || '',
      interviewData.emphasis || '',
      interviewData.questions || '',
    ].join('\n\n')
    const wordCount = allInputs.split(/\s+/).filter(Boolean).length
    const hasStructure = /(?:tier|level|\d+[.)]\s|[-•*]\s|#{1,3}\s)/im.test(allInputs)
    const isStructured = wordCount > 200 && hasStructure

    // Initial status messages
    sendEvent({ type: 'status', message: 'Reviewing interview responses...' })
    await new Promise((resolve) => setTimeout(resolve, 500))

    sendEvent({ type: 'status', message: 'Analyzing content structure...' })
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Generate sections sequentially
    const sections: Record<string, string> = {}

    for (const sectionId of SECTION_ORDER) {
      sendEvent({
        type: 'section_start',
        sectionId,
        sectionName: SECTION_NAMES[sectionId],
      })

      const content = await generateSingleSection(interviewData, sectionId as SectionId, isStructured)
      sections[sectionId] = content

      sendEvent({
        type: 'section_complete',
        sectionId,
        content,
      })
    }

    // Build complete profile
    const now = new Date().toISOString()
    const profile: AgentProfile = {
      sections: {
        identityRole: {
          id: 'identityRole',
          title: 'Identity & Role',
          content: sections.identityRole,
          isEdited: false,
        },
        communicationStyle: {
          id: 'communicationStyle',
          title: 'Communication Style',
          content: sections.communicationStyle,
          isEdited: false,
        },
        contentPriorities: {
          id: 'contentPriorities',
          title: 'Content Priorities',
          content: sections.contentPriorities,
          isEdited: false,
        },
        engagementApproach: {
          id: 'engagementApproach',
          title: 'Engagement Approach',
          content: sections.engagementApproach,
          isEdited: false,
        },
        keyFramings: {
          id: 'keyFramings',
          title: 'Key Framings',
          content: sections.keyFramings,
          isEdited: false,
        },
      },
      generatedAt: now,
      source: 'interview',
    }

    // Save to database
    await prisma.agentConfig.update({
      where: { projectId },
      data: {
        profile: JSON.parse(JSON.stringify(profile)),
        profileGeneratedAt: new Date(),
        profileSource: 'interview',
      },
    })

    // Send complete event
    sendEvent({ type: 'complete', profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed'
    sendEvent({ type: 'error', message })
  } finally {
    res.end()
  }
}

/**
 * Get AI agent profile
 * GET /api/projects/:projectId/agent/profile
 */
export async function getAgentProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Agent profile')
  }

  res.json({
    profile: agentConfig.profile,
    generatedAt: agentConfig.profileGeneratedAt,
    source: agentConfig.profileSource,
    interviewData: agentConfig.interviewData, // Include for frontend comparison
  })
}

/**
 * Update a specific profile section
 * PATCH /api/projects/:projectId/agent/profile
 */
export async function updateAgentProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { sectionId, content } = req.body

  if (!sectionId || !content) {
    throw new ValidationError('sectionId and content are required')
  }

  // Validate content length
  if (content.length > 2000) {
    throw new ValidationError('Section content cannot exceed 2000 characters')
  }

  // V1 and V2 valid field/section IDs
  const validV1Sections = [
    'identityRole',
    'communicationStyle',
    'contentPriorities',
    'engagementApproach',
    'keyFramings',
  ]
  const validV2Fields = [
    'agentIdentity',
    'domainExpertise',
    'targetAudience',
    'toneAndVoice',
    'languagePatterns',
    'adaptationRules',
    'keyTopics',
    'avoidanceAreas',
    'examplePreferences',
    'proactiveGuidance',
    'framingStrategies',
    'successCriteria',
  ]
  const allValidIds = [...validV1Sections, ...validV2Fields]
  if (!allValidIds.includes(sectionId)) {
    throw new ValidationError(
      `Invalid section/field: ${sectionId}. Must be a valid profile section or field ID.`
    )
  }

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Agent profile')
  }

  // Detect profile version and update the appropriate structure
  const profile = agentConfig.profile as unknown as Record<string, unknown>
  const isV2 = 'version' in profile && profile.version === 2 && 'fields' in profile

  if (isV2) {
    // V2 profile: update fields object
    const fields = profile.fields as Record<string, { content: string; confidence?: string }>
    if (!fields[sectionId]) {
      throw new NotFoundError(`Field ${sectionId}`)
    }
    fields[sectionId].content = content
    profile.source = 'manual'
  } else {
    // V1 profile: update sections object
    const v1Profile = profile as unknown as AgentProfile
    const section = v1Profile.sections[sectionId as keyof typeof v1Profile.sections]
    if (!section) {
      throw new NotFoundError(`Section ${sectionId}`)
    }
    section.content = content
    section.isEdited = true
    section.editedAt = new Date().toISOString()
    v1Profile.source = 'manual'
  }

  await prisma.agentConfig.update({
    where: { projectId },
    data: { profile: JSON.parse(JSON.stringify(profile)) },
  })

  // Return the updated section/field
  if (isV2) {
    const fields = profile.fields as Record<string, unknown>
    res.json({
      section: fields[sectionId],
      message: 'Field updated successfully',
    })
  } else {
    const v1Profile = profile as unknown as AgentProfile
    res.json({
      section: v1Profile.sections[sectionId as keyof typeof v1Profile.sections],
      message: 'Section updated successfully',
    })
  }
}

// ============================================================================
// V2 BRAINDUMP SYNTHESIS HANDLERS
// ============================================================================

const VALID_SYNTHESIS_MODES = ['voice', 'text']

/**
 * POST /api/projects/:projectId/profile/synthesize
 *
 * Synthesize a 12-field agent profile from natural language braindump.
 * Does NOT save to database - returns preview for user review.
 */
export async function synthesizeAgentProfileHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { rawInput, additionalContext, synthesisMode } = req.body

  // Validate request body
  if (!rawInput || typeof rawInput !== 'string') {
    throw new ValidationError('rawInput is required and must be a string')
  }

  if (rawInput.trim().length < MIN_INPUT_LENGTH) {
    throw new ValidationError(`rawInput must be at least ${MIN_INPUT_LENGTH} characters`)
  }

  if (additionalContext !== undefined && typeof additionalContext !== 'string') {
    throw new ValidationError('additionalContext must be a string if provided')
  }

  if (synthesisMode && !VALID_SYNTHESIS_MODES.includes(synthesisMode)) {
    throw new ValidationError(`synthesisMode must be one of: ${VALID_SYNTHESIS_MODES.join(', ')}`)
  }

  // Verify project exists and user has access
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: req.user.userId }
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  // Synthesize profile (does not save)
  const result: BrainDumpSynthesisResult = await synthesizeFromBrainDump(
    rawInput.trim(),
    additionalContext?.trim()
  )

  res.json({
    success: true,
    ...result,
    synthesisMode: synthesisMode || 'text'
  })
}

/**
 * POST /api/projects/:projectId/profile/save
 *
 * Save a synthesized profile to the database.
 * Called after user reviews and approves the preview.
 */
export async function saveAgentProfileHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { profile, rawInput, lightAreas, synthesisMode } = req.body

  // Validate required fields
  if (!profile || typeof profile !== 'object') {
    throw new ValidationError('profile is required')
  }

  if (!rawInput || typeof rawInput !== 'string') {
    throw new ValidationError('rawInput is required')
  }

  // Verify project exists and user has access
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: req.user.userId }
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  // Get current config to increment version
  const existingConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })

  const nextVersion = (existingConfig?.profileVersion || 0) + 1

  // Upsert agent config with new profile
  const agentConfig = await prisma.agentConfig.upsert({
    where: { projectId },
    create: {
      projectId,
      interviewData: {}, // Empty for braindump-created profiles
      status: 'complete',
      completionLevel: 100,
      profile,
      profileGeneratedAt: new Date(),
      profileSource: 'braindump',
      profileVersion: 1,
      rawBrainDump: rawInput,
      synthesisMode: synthesisMode || 'text',
      lightAreas: lightAreas || []
    },
    update: {
      profile,
      profileGeneratedAt: new Date(),
      profileSource: 'braindump',
      profileVersion: nextVersion,
      rawBrainDump: rawInput,
      synthesisMode: synthesisMode || 'text',
      lightAreas: lightAreas || [],
      status: 'complete',
      completionLevel: 100
    }
  })

  res.json({
    success: true,
    agentConfig: {
      id: agentConfig.id,
      profileVersion: agentConfig.profileVersion,
      profileSource: agentConfig.profileSource,
      profileGeneratedAt: agentConfig.profileGeneratedAt
    }
  })
}
