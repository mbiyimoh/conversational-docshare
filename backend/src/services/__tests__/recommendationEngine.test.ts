import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock the dependencies before importing the module
jest.mock('../../utils/openai', () => ({
  getOpenAI: jest.fn(),
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    testComment: { findMany: jest.fn() },
    agentConfig: { findUnique: jest.fn(), update: jest.fn() },
    profileRecommendation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    profileVersion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-set-id-123'),
}))

import {
  generateRecommendations,
  applyRecommendations,
  rollbackToVersion,
  getVersionHistory,
} from '../recommendationEngine'
import { getOpenAI } from '../../utils/openai'
import { prisma } from '../../utils/prisma'

interface MockOpenAIInstance {
  chat: {
    completions: {
      create: jest.Mock
    }
  }
}

describe('recommendationEngine', () => {
  let mockOpenAIInstance: MockOpenAIInstance

  const mockProfile = {
    sections: {
      identityRole: {
        id: 'identityRole',
        title: 'Identity & Role',
        content: 'AI assistant for financial reporting',
        isEdited: false,
      },
      communicationStyle: {
        id: 'communicationStyle',
        title: 'Communication Style',
        content: 'Professional and formal tone',
        isEdited: false,
      },
      contentPriorities: {
        id: 'contentPriorities',
        title: 'Content Priorities',
        content: 'Focus on ROI metrics and quarterly performance',
        isEdited: false,
      },
      engagementApproach: {
        id: 'engagementApproach',
        title: 'Engagement Approach',
        content: 'Ask clarifying questions before providing analysis',
        isEdited: false,
      },
      keyFramings: {
        id: 'keyFramings',
        title: 'Key Framings',
        content: 'Position metrics as opportunities, not problems',
        isEdited: false,
      },
    },
    generatedAt: '2024-01-01T00:00:00.000Z',
    source: 'interview' as const,
  }

  const mockComments = [
    {
      id: 'comment-1',
      content: 'The tone is too formal here',
      templateId: 'communication',
      createdAt: new Date(),
      message: {
        content: 'The projected ROI for Q3 shows a 35% increase based on our analysis...',
        session: { id: 'session-1' },
      },
    },
    {
      id: 'comment-2',
      content: 'Should mention risk factors',
      templateId: 'content',
      createdAt: new Date(),
      message: {
        content: 'Our revenue projections indicate strong growth in the coming quarter...',
        session: { id: 'session-1' },
      },
    },
  ]

  const mockLLMResponse = {
    analysisSummary: {
      overview: 'After analyzing 2 comments, I identified tone and content issues.',
      feedbackThemes: ['tone formality', 'risk coverage'],
      configAlignment: 'needs_update',
      noChangeReason: null,
    },
    recommendations: [
      {
        type: 'add',
        targetSection: 'communicationStyle',
        addedContent: 'Use a more approachable and conversational tone when discussing complex metrics.',
        summaryBullets: ['Add approachable tone', 'Make metrics accessible'],
        rationale: 'Feedback indicated the formal tone is too stiff',
        relatedCommentIds: ['comment-1'],
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockLLMResponse),
                },
              },
            ],
          } as never),
        },
      },
    }

    ;(getOpenAI as jest.Mock).mockReturnValue(mockOpenAIInstance)

    // Default mock for profileRecommendation.create
    ;(prisma.profileRecommendation.create as jest.Mock).mockImplementation((args: unknown) => {
      const typedArgs = args as { data: Record<string, unknown> }
      return Promise.resolve({ id: 'rec-id-1', ...typedArgs.data }) as never
    })
  })

  describe('generateRecommendations', () => {
    it('should return empty recommendations when no comments exist', async () => {
      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue([] as never)

      const result = await generateRecommendations('project-1')

      expect(result.recommendations).toEqual([])
      expect(result.totalComments).toBe(0)
      expect(result.sessionsAnalyzed).toBe(0)
      expect(result.setId).toBeDefined()
      expect(result.analysisSummary).toEqual({
        overview: 'No feedback comments available to analyze.',
        feedbackThemes: [],
        configAlignment: 'good',
        noChangeReason: 'No testing feedback has been provided yet.',
      })
      expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled()
    })

    it('should throw error when profile not found', async () => {
      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(generateRecommendations('project-1')).rejects.toThrow(
        'Profile not found - complete interview first'
      )
    })

    it('should generate profile-direct recommendations from comments', async () => {
      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].targetSection).toBe('communicationStyle')
      expect(result.recommendations[0].type).toBe('add')
      expect(result.recommendations[0].addedContent).toContain('approachable')
      expect(result.totalComments).toBe(2)
      expect(result.sessionsAnalyzed).toBe(1)
      expect(result.setId).toBe('test-set-id-123')
      expect(result.analysisSummary).toBeDefined()
      expect(result.analysisSummary.feedbackThemes).toContain('tone formality')
    })

    it('should generate max 1 recommendation per section', async () => {
      const multiRecResponse = {
        analysisSummary: {
          overview: 'Multiple issues found.',
          feedbackThemes: ['tone'],
          configAlignment: 'needs_update',
        },
        recommendations: [
          {
            type: 'add',
            targetSection: 'communicationStyle',
            addedContent: 'First suggestion',
            summaryBullets: ['Bullet 1'],
            rationale: 'First rationale',
            relatedCommentIds: ['comment-1'],
          },
          {
            type: 'modify',
            targetSection: 'communicationStyle', // Duplicate section!
            modifiedFrom: 'formal',
            modifiedTo: 'casual',
            summaryBullets: ['Bullet 2'],
            rationale: 'Second rationale',
            relatedCommentIds: ['comment-2'],
          },
        ],
      }

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(multiRecResponse) } }],
      } as never)

      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      // Should only have 1 recommendation for communicationStyle
      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].type).toBe('add')
    })

    it('should filter out recommendations with invalid targetSection', async () => {
      const invalidResponse = {
        analysisSummary: {
          overview: 'Analysis complete.',
          feedbackThemes: [],
          configAlignment: 'partial',
        },
        recommendations: [
          {
            type: 'add',
            targetSection: 'invalidSection', // Invalid!
            addedContent: 'Some suggestion',
            summaryBullets: ['Bullet'],
            rationale: 'Some rationale',
            relatedCommentIds: [],
          },
          {
            type: 'add',
            targetSection: 'contentPriorities', // Valid
            addedContent: 'Valid suggestion',
            summaryBullets: ['Valid bullet'],
            rationale: 'Valid rationale',
            relatedCommentIds: [],
          },
        ],
      }

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(invalidResponse) } }],
      } as never)

      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].targetSection).toBe('contentPriorities')
    })

    it('should compute previewBefore and previewAfter for ADD operation', async () => {
      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      expect(result.recommendations[0].previewBefore).toBe('Professional and formal tone')
      expect(result.recommendations[0].previewAfter).toContain('Professional and formal tone')
      expect(result.recommendations[0].previewAfter).toContain('approachable')
    })

    it('should include 2-3 summary bullets', async () => {
      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      expect(result.recommendations[0].summaryBullets).toBeInstanceOf(Array)
      expect(result.recommendations[0].summaryBullets.length).toBeGreaterThanOrEqual(1)
      expect(result.recommendations[0].summaryBullets.length).toBeLessThanOrEqual(3)
    })

    it('should store recommendations in database', async () => {
      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      await generateRecommendations('project-1')

      expect(prisma.profileRecommendation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-1',
          setId: 'test-set-id-123',
          type: 'add',
          targetSection: 'communicationStyle',
          status: 'pending',
        }),
      })
    })

    it('should throw error on empty LLM response', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as never)

      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      await expect(generateRecommendations('project-1')).rejects.toThrow('Empty response')
    })

    it('should throw error on invalid JSON response', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'not valid json' } }],
      } as never)

      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      await expect(generateRecommendations('project-1')).rejects.toThrow(
        'Failed to parse recommendations response'
      )
    })

    it('should count unique sessions analyzed', async () => {
      const multiSessionComments = [
        { ...mockComments[0], message: { ...mockComments[0].message, session: { id: 'session-1' } } },
        { ...mockComments[1], message: { ...mockComments[1].message, session: { id: 'session-2' } } },
      ]

      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(multiSessionComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      expect(result.sessionsAnalyzed).toBe(2)
    })

    it('should provide fallback noChangeReason if LLM omits it', async () => {
      const emptyResponse = {
        analysisSummary: {
          overview: 'Analysis complete.',
          feedbackThemes: [],
          configAlignment: 'partial',
        },
        recommendations: [],
      }

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(emptyResponse) } }],
      } as never)

      ;(prisma.testComment.findMany as jest.Mock).mockResolvedValue(mockComments as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
      } as never)

      const result = await generateRecommendations('project-1')

      expect(result.recommendations).toHaveLength(0)
      expect(result.analysisSummary.noChangeReason).toBeDefined()
      expect(result.analysisSummary.noChangeReason).toContain('Unable to generate')
    })
  })

  describe('applyRecommendations', () => {
    const mockPendingRecs = [
      {
        id: 'rec-1',
        setId: 'set-123',
        type: 'add',
        targetSection: 'communicationStyle',
        addedContent: 'Be more approachable.',
        status: 'pending',
      },
    ]

    it('should create version snapshot before applying', async () => {
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        profileVersion: 1,
      } as never)
      ;(prisma.profileRecommendation.findMany as jest.Mock).mockResolvedValue(mockPendingRecs as never)
      ;(prisma.profileRecommendation.findFirst as jest.Mock).mockResolvedValue(null as never)
      ;(prisma.profileVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-id',
        version: 2,
        createdAt: new Date(),
      } as never)
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}] as never)

      await applyRecommendations('project-1', 'set-123')

      expect(prisma.profileVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-1',
          version: 2,
          source: 'recommendation',
          recommendationSetId: 'set-123',
        }),
      })
    })

    it('should throw ConflictError if already applied', async () => {
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        profileVersion: 1,
      } as never)
      ;(prisma.profileRecommendation.findMany as jest.Mock).mockResolvedValue(mockPendingRecs as never)
      ;(prisma.profileRecommendation.findFirst as jest.Mock).mockResolvedValue({
        id: 'already-applied',
        status: 'applied',
      } as never)

      await expect(applyRecommendations('project-1', 'set-123')).rejects.toThrow(
        'This recommendation set has already been applied'
      )
    })

    it('should append addedContent with newline separator for ADD', async () => {
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        profileVersion: 1,
      } as never)
      ;(prisma.profileRecommendation.findMany as jest.Mock).mockResolvedValue(mockPendingRecs as never)
      ;(prisma.profileRecommendation.findFirst as jest.Mock).mockResolvedValue(null as never)
      ;(prisma.profileVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-id',
        version: 2,
        createdAt: new Date(),
      } as never)
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}] as never)

      const result = await applyRecommendations('project-1', 'set-123')

      expect(result.profile.sections.communicationStyle.content).toContain(
        'Professional and formal tone\n\nBe more approachable.'
      )
    })

    it('should mark sections as edited with recommendation source', async () => {
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        profileVersion: 1,
      } as never)
      ;(prisma.profileRecommendation.findMany as jest.Mock).mockResolvedValue(mockPendingRecs as never)
      ;(prisma.profileRecommendation.findFirst as jest.Mock).mockResolvedValue(null as never)
      ;(prisma.profileVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-id',
        version: 2,
        createdAt: new Date(),
      } as never)
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}] as never)

      const result = await applyRecommendations('project-1', 'set-123')

      expect(result.profile.sections.communicationStyle.isEdited).toBe(true)
      expect(result.profile.sections.communicationStyle.editSource).toBe('recommendation')
      expect(result.profile.sections.communicationStyle.editedAt).toBeDefined()
    })

    it('should update all recommendations to applied status', async () => {
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profile: mockProfile,
        profileVersion: 1,
      } as never)
      ;(prisma.profileRecommendation.findMany as jest.Mock).mockResolvedValue(mockPendingRecs as never)
      ;(prisma.profileRecommendation.findFirst as jest.Mock).mockResolvedValue(null as never)
      ;(prisma.profileVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-id',
        version: 2,
        createdAt: new Date(),
      } as never)
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}] as never)

      await applyRecommendations('project-1', 'set-123')

      // Verify transaction was called (contains agentConfig.update and profileRecommendation.updateMany)
      expect(prisma.$transaction).toHaveBeenCalled()
      // Verify the individual update calls were prepared
      expect(prisma.agentConfig.update).toHaveBeenCalled()
      expect(prisma.profileRecommendation.updateMany).toHaveBeenCalledWith({
        where: { setId: 'set-123' },
        data: { status: 'applied', appliedAt: expect.any(Date) },
      })
    })
  })

  describe('rollbackToVersion', () => {
    it('should restore profile from specified version', async () => {
      const oldProfile = { ...mockProfile, source: 'interview' as const }
      ;(prisma.profileVersion.findUnique as jest.Mock).mockResolvedValue({
        profile: oldProfile,
        source: 'interview',
      } as never)
      ;(prisma.agentConfig.update as jest.Mock).mockResolvedValue({} as never)

      const result = await rollbackToVersion('project-1', 1)

      expect(result).toEqual(oldProfile)
      expect(prisma.agentConfig.update).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        data: {
          profile: oldProfile,
          profileVersion: 1,
          profileSource: 'interview',
        },
      })
    })

    it('should throw NotFoundError for invalid version', async () => {
      ;(prisma.profileVersion.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(rollbackToVersion('project-1', 999)).rejects.toThrow(
        'Version 999 not found'
      )
    })
  })

  describe('getVersionHistory', () => {
    it('should return last 10 versions ordered by version desc', async () => {
      const mockVersions = [
        { version: 3, source: 'recommendation', createdAt: new Date(), recommendationSetId: 'set-3' },
        { version: 2, source: 'manual', createdAt: new Date(), recommendationSetId: null },
        { version: 1, source: 'interview', createdAt: new Date(), recommendationSetId: null },
      ]

      ;(prisma.profileVersion.findMany as jest.Mock).mockResolvedValue(mockVersions as never)
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue({
        profileVersion: 3,
      } as never)

      const result = await getVersionHistory('project-1')

      expect(result.versions).toHaveLength(3)
      expect(result.versions[0].version).toBe(3)
      expect(result.currentVersion).toBe(3)
      expect(prisma.profileVersion.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { version: 'desc' },
        take: 10,
        select: {
          version: true,
          source: true,
          createdAt: true,
          recommendationSetId: true,
        },
      })
    })
  })
})
