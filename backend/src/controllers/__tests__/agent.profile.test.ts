import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { Request, Response } from 'express'

// Mock dependencies
jest.mock('../../utils/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    agentConfig: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('../../services/profileSynthesizer', () => ({
  regenerateProfile: jest.fn(),
}))

import {
  generateAgentProfile,
  getAgentProfile,
  updateAgentProfile,
} from '../agent.controller'
import { prisma } from '../../utils/prisma'
import { regenerateProfile } from '../../services/profileSynthesizer'

interface MockUser {
  userId: string
}

interface MockRequest {
  user?: MockUser
  params: Record<string, string>
  body: Record<string, unknown>
}

interface MockResponse {
  json: jest.Mock
  status: jest.Mock
}

describe('Agent Profile Controller', () => {
  let mockReq: MockRequest
  let mockRes: MockResponse

  const mockUser = { userId: 'user-1' }
  const mockProject = { id: 'project-1', ownerId: 'user-1' }
  const mockProfile = {
    sections: {
      identityRole: { id: 'identityRole', title: 'Identity & Role', content: 'Test', isEdited: false },
      communicationStyle: { id: 'communicationStyle', title: 'Communication Style', content: 'Test', isEdited: false },
      contentPriorities: { id: 'contentPriorities', title: 'Content Priorities', content: 'Test', isEdited: false },
      engagementApproach: { id: 'engagementApproach', title: 'Engagement Approach', content: 'Test', isEdited: false },
      keyFramings: { id: 'keyFramings', title: 'Key Framings', content: 'Test', isEdited: false },
    },
    generatedAt: new Date().toISOString(),
    source: 'interview' as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    }

    mockReq = {
      user: mockUser,
      params: { projectId: 'project-1' },
      body: {},
    }
  })

  describe('generateAgentProfile', () => {
    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        generateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should throw NotFoundError if project not found', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(
        generateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })

    it('should throw AuthorizationError if not owner', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({
        ...mockProject,
        ownerId: 'other-user',
      } as never)

      await expect(
        generateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow()
    })

    it('should return cached profile when force is false and profile exists', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)
      mockReq.body = { force: false }

      await generateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.json).toHaveBeenCalledWith({
        profile: mockProfile,
        cached: true,
      })
    })

    it('should regenerate profile when force is true', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)
      ;(regenerateProfile as jest.Mock).mockResolvedValue(mockProfile as never)
      mockReq.body = { force: true }

      await generateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(regenerateProfile).toHaveBeenCalledWith('project-1')
      expect(mockRes.json).toHaveBeenCalledWith({
        profile: mockProfile,
        cached: false,
      })
    })
  })

  describe('getAgentProfile', () => {
    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        getAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should throw NotFoundError if profile not found', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: null,
      } as never)

      await expect(
        getAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })

    it('should return profile with metadata', async () => {
      const profileGeneratedAt = new Date()
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        profileGeneratedAt,
        profileSource: 'interview',
      } as never)

      await getAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.json).toHaveBeenCalledWith({
        profile: mockProfile,
        generatedAt: profileGeneratedAt,
        source: 'interview',
      })
    })
  })

  describe('updateAgentProfile', () => {
    it('should throw ValidationError if sectionId missing', async () => {
      mockReq.body = { content: 'Updated content' }

      await expect(
        updateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('sectionId and content are required')
    })

    it('should throw ValidationError if content missing', async () => {
      mockReq.body = { sectionId: 'identityRole' }

      await expect(
        updateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('sectionId and content are required')
    })

    it('should throw ValidationError for content over 2000 chars', async () => {
      mockReq.body = {
        sectionId: 'identityRole',
        content: 'A'.repeat(2001),
      }

      await expect(
        updateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('cannot exceed 2000 characters')
    })

    it('should throw ValidationError for invalid sectionId', async () => {
      mockReq.body = {
        sectionId: 'invalidSection',
        content: 'Updated content',
      }

      await expect(
        updateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Invalid section')
    })

    it('should update section and set isEdited flag', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: JSON.parse(JSON.stringify(mockProfile)),
      } as never)
      ;(prisma.agentConfig.update as jest.Mock).mockResolvedValue({} as never)
      mockReq.body = {
        sectionId: 'identityRole',
        content: 'Updated identity content',
      }

      await updateAgentProfile(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(prisma.agentConfig.update).toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Section updated successfully',
        })
      )
    })
  })
})
