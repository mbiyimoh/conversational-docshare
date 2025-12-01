import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors'

/**
 * Create a new project
 */
export async function createProject(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { name, description } = req.body

  if (!name) {
    throw new ValidationError('Project name is required')
  }

  const project = await prisma.project.create({
    data: {
      ownerId: req.user.userId,
      name,
      description,
    },
  })

  res.status(201).json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  })
}

/**
 * Get all projects for current user
 */
export async function getUserProjects(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const projects = await prisma.project.findMany({
    where: { ownerId: req.user.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          documents: true,
          conversations: true,
        },
      },
      agentConfig: {
        select: {
          status: true,
          completionLevel: true,
        },
      },
    },
  })

  res.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      documentCount: p._count.documents,
      conversationCount: p._count.conversations,
      agentConfigured: p.agentConfig?.status === 'complete',
      agentCompletionLevel: p.agentConfig?.completionLevel || 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  })
}

/**
 * Get a single project
 */
export async function getProject(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          documents: true,
          conversations: true,
          shareLinks: true,
        },
      },
      agentConfig: true,
    },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  res.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      isActive: project.isActive,
      documentCount: project._count.documents,
      conversationCount: project._count.conversations,
      shareLinkCount: project._count.shareLinks,
      agentConfig: project.agentConfig
        ? {
            status: project.agentConfig.status,
            completionLevel: project.agentConfig.completionLevel,
            preferredModel: project.agentConfig.preferredModel,
            temperature: project.agentConfig.temperature,
          }
        : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  })
}

/**
 * Update a project
 */
export async function updateProject(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { name, description, isActive } = req.body

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  res.json({
    project: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  })
}

/**
 * Delete a project
 */
export async function deleteProject(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  await prisma.project.delete({
    where: { id: projectId },
  })

  res.status(204).send()
}
