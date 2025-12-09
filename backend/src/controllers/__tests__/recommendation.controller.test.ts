import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { Request, Response } from 'express'

// Mock dependencies
jest.mock('../../utils/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
  },
}))

jest.mock('../../services/recommendationEngine', () => ({
  generateRecommendations: jest.fn(),
  applyRecommendations: jest.fn(),
  rollbackToVersion: jest.fn(),
  getVersionHistory: jest.fn(),
  dismissRecommendation: jest.fn(),
}))

import {
  getRecommendations,
  applyAllRecommendations,
  rollbackProfile,
  getProfileVersionHistory,
  dismissSingleRecommendation,
} from '../recommendation.controller'
import { prisma } from '../../utils/prisma'
import {
  generateRecommendations,
  applyRecommendations,
  rollbackToVersion,
  getVersionHistory,
  dismissRecommendation,
} from '../../services/recommendationEngine'

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

describe('Recommendation Controller', () => {
  let mockReq: MockRequest
  let mockRes: MockResponse

  const mockUser = { userId: 'user-1' }
  const mockProject = { id: 'project-1', ownerId: 'user-1' }

  const mockProfile = {
    sections: {
      identityRole: { id: 'identityRole', title: 'Identity & Role', content: 'Test', isEdited: false },
      communicationStyle: { id: 'communicationStyle', title: 'Communication Style', content: 'Test', isEdited: true },
      contentPriorities: { id: 'contentPriorities', title: 'Content Priorities', content: 'Test', isEdited: false },
      engagementApproach: { id: 'engagementApproach', title: 'Engagement Approach', content: 'Test', isEdited: false },
      keyFramings: { id: 'keyFramings', title: 'Key Framings', content: 'Test', isEdited: false },
    },
    generatedAt: '2024-01-01T00:00:00.000Z',
    source: 'interview' as const,
  }

  const mockRecommendations = [
    {
      id: 'rec-1',
      setId: 'set-123',
      type: 'add' as const,
      targetSection: 'communicationStyle' as const,
      addedContent: 'Be more approachable.',
      summaryBullets: ['Add approachability', 'Keep professional tone'],
      previewBefore: 'Test',
      previewAfter: 'Test\n\nBe more approachable.',
      rationale: 'Feedback suggested being more approachable',
      relatedCommentIds: ['c-1'],
      status: 'pending' as const,
    },
  ]

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

  describe('getRecommendations', () => {
    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        getRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should throw NotFoundError if project not found', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(
        getRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })

    it('should throw AuthorizationError if not project owner', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({
        ...mockProject,
        ownerId: 'other-user',
      } as never)

      await expect(
        getRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('You do not own this project')
    })

    it('should return profile-direct recommendations on success', async () => {
      const mockAnalysisSummary = {
        overview: 'Analyzed 5 comments. Main theme: tone formality.',
        feedbackThemes: ['tone formality'],
        configAlignment: 'needs_update' as const,
      }
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(generateRecommendations as jest.Mock).mockResolvedValue({
        setId: 'set-123',
        recommendations: mockRecommendations,
        totalComments: 5,
        sessionsAnalyzed: 2,
        analysisSummary: mockAnalysisSummary,
        generatedAt: '2024-01-01T00:00:00.000Z',
      } as never)

      await getRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          setId: 'set-123',
          recommendations: mockRecommendations,
          totalComments: 5,
          sessionsAnalyzed: 2,
          analysisSummary: mockAnalysisSummary,
          generatedAt: expect.any(String),
        })
      )
    })

    it('should enforce rate limiting after multiple requests', async () => {
      // Use unique projectId to avoid state pollution from other tests
      const rateLimitTestProject = { id: 'project-rate-limit-test', ownerId: 'user-1' }
      const rateLimitReq = {
        user: mockUser,
        params: { projectId: 'project-rate-limit-test' },
        body: {},
      }

      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(rateLimitTestProject as never)
      ;(generateRecommendations as jest.Mock).mockResolvedValue({
        setId: 'set-123',
        recommendations: [],
        totalComments: 0,
        sessionsAnalyzed: 0,
        analysisSummary: {
          overview: 'No feedback comments available to analyze.',
          feedbackThemes: [],
          configAlignment: 'good' as const,
          noChangeReason: 'No testing feedback has been provided yet.',
        },
        generatedAt: '2024-01-01T00:00:00.000Z',
      } as never)

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        await getRecommendations(rateLimitReq as unknown as Request, mockRes as unknown as Response)
      }

      // 11th request should fail with rate limit
      await expect(
        getRecommendations(rateLimitReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('applyAllRecommendations', () => {
    beforeEach(() => {
      mockReq.body = { setId: 'set-123' }
    })

    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        applyAllRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should throw ValidationError if setId is missing', async () => {
      mockReq.body = {}

      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)

      await expect(
        applyAllRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('setId is required')
    })

    it('should apply all recommendations and return updated profile', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(applyRecommendations as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        version: {
          id: 'version-id',
          projectId: 'project-1',
          version: 2,
          profile: mockProfile,
          source: 'recommendation',
          recommendationSetId: 'set-123',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      } as never)

      await applyAllRecommendations(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(applyRecommendations).toHaveBeenCalledWith('project-1', 'set-123')
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          appliedCount: expect.any(Number),
          profile: mockProfile,
          version: {
            number: 2,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          rollbackAvailable: true,
        })
      )
    })
  })

  describe('rollbackProfile', () => {
    beforeEach(() => {
      mockReq.body = { toVersion: 1 }
    })

    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        rollbackProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should throw ValidationError if toVersion is invalid', async () => {
      mockReq.body = { toVersion: 0 }

      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)

      await expect(
        rollbackProfile(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('toVersion must be a positive number')
    })

    it('should rollback profile and return restored version', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(rollbackToVersion as jest.Mock).mockResolvedValue(mockProfile as never)

      await rollbackProfile(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(rollbackToVersion).toHaveBeenCalledWith('project-1', 1)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        profile: mockProfile,
        restoredVersion: 1,
      })
    })
  })

  describe('getProfileVersionHistory', () => {
    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        getProfileVersionHistory(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should return version history', async () => {
      const mockVersionHistory = {
        versions: [
          { version: 2, source: 'recommendation', createdAt: '2024-01-02T00:00:00.000Z', recommendationSetId: 'set-123' },
          { version: 1, source: 'interview', createdAt: '2024-01-01T00:00:00.000Z' },
        ],
        currentVersion: 2,
      }

      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(getVersionHistory as jest.Mock).mockResolvedValue(mockVersionHistory as never)

      await getProfileVersionHistory(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(getVersionHistory).toHaveBeenCalledWith('project-1')
      expect(mockRes.json).toHaveBeenCalledWith(mockVersionHistory)
    })
  })

  describe('dismissSingleRecommendation', () => {
    beforeEach(() => {
      mockReq.params = { projectId: 'project-1', recommendationId: 'rec-1' }
    })

    it('should throw AuthorizationError if not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        dismissSingleRecommendation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Access denied')
    })

    it('should dismiss recommendation and return success', async () => {
      ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject as never)
      ;(dismissRecommendation as jest.Mock).mockResolvedValue(undefined as never)

      await dismissSingleRecommendation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(dismissRecommendation).toHaveBeenCalledWith('project-1', 'rec-1')
      expect(mockRes.json).toHaveBeenCalledWith({ success: true })
    })
  })
})
