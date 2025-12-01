import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock the dependencies before importing the module
jest.mock('../../utils/openai', () => ({
  getOpenAI: jest.fn(),
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    agentConfig: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { synthesizeProfile, regenerateProfile } from '../profileSynthesizer'
import { getOpenAI } from '../../utils/openai'
import { prisma } from '../../utils/prisma'

interface MockOpenAIInstance {
  chat: {
    completions: {
      create: jest.Mock
    }
  }
}

describe('profileSynthesizer', () => {
  const mockLLMResponse = {
    identityRole: 'Your agent represents your company to board members.',
    communicationStyle: 'Your agent communicates professionally but approachably.',
    contentPriorities: 'Your agent prioritizes ROI and strategic metrics.',
    engagementApproach: 'Your agent proactively asks clarifying questions.',
    keyFramings: 'Your agent frames conversations around business value.',
  }

  let mockOpenAIInstance: MockOpenAIInstance

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
  })

  describe('synthesizeProfile', () => {
    it('should generate all 5 sections from complete interview data', async () => {
      const interviewData = {
        audience: 'Board members',
        purpose: 'Quarterly reporting',
        tone: 'Professional but approachable',
        emphasis: 'ROI and strategic metrics',
        questions: 'How does this align with your objectives?',
      }

      const profile = await synthesizeProfile(interviewData)

      expect(profile.sections).toBeDefined()
      expect(profile.sections.identityRole).toBeDefined()
      expect(profile.sections.communicationStyle).toBeDefined()
      expect(profile.sections.contentPriorities).toBeDefined()
      expect(profile.sections.engagementApproach).toBeDefined()
      expect(profile.sections.keyFramings).toBeDefined()
      expect(profile.source).toBe('interview')
      expect(profile.generatedAt).toBeDefined()
    })

    it('should handle partial interview data', async () => {
      const interviewData = {
        audience: 'Investors',
        purpose: 'Due diligence',
      }

      const profile = await synthesizeProfile(interviewData)

      expect(profile.sections.identityRole.content).toBeDefined()
      expect(profile.sections.identityRole.isEdited).toBe(false)
    })

    it('should handle empty interview data', async () => {
      const interviewData = {}

      const profile = await synthesizeProfile(interviewData)

      expect(profile.sections).toBeDefined()
      expect(Object.keys(profile.sections)).toHaveLength(5)
    })

    it('should truncate content exceeding 4000 characters', async () => {
      const longContent = 'A'.repeat(5000)
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...mockLLMResponse,
                identityRole: longContent,
              }),
            },
          },
        ],
      } as never)

      const profile = await synthesizeProfile({ audience: 'Test' })

      expect(profile.sections.identityRole.content.length).toBeLessThanOrEqual(4003) // 4000 + '...'
      expect(profile.sections.identityRole.content.endsWith('...')).toBe(true)
    })

    it('should set isEdited to false for all generated sections', async () => {
      const profile = await synthesizeProfile({ audience: 'Test' })

      expect(profile.sections.identityRole.isEdited).toBe(false)
      expect(profile.sections.communicationStyle.isEdited).toBe(false)
      expect(profile.sections.contentPriorities.isEdited).toBe(false)
      expect(profile.sections.engagementApproach.isEdited).toBe(false)
      expect(profile.sections.keyFramings.isEdited).toBe(false)
    })

    it('should throw error on empty LLM response', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as never)

      await expect(synthesizeProfile({ audience: 'Test' })).rejects.toThrow(
        'Failed to generate sections: Empty response'
      )
    })
  })

  describe('regenerateProfile', () => {
    it('should throw error if config not found', async () => {
      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(regenerateProfile('non-existent-project')).rejects.toThrow(
        'Agent config not found'
      )
    })

    it('should regenerate and save profile for existing config', async () => {
      const mockConfig = {
        id: 'config-1',
        projectId: 'project-1',
        interviewData: {
          audience: 'Board members',
          purpose: 'Quarterly review',
        },
      }

      ;(prisma.agentConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig as never)
      ;(prisma.agentConfig.update as jest.Mock).mockResolvedValue({
        ...mockConfig,
        profile: mockLLMResponse,
      } as never)

      const profile = await regenerateProfile('project-1')

      expect(prisma.agentConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1' },
          data: expect.objectContaining({
            profileSource: 'interview',
          }),
        })
      )
      expect(profile.sections).toBeDefined()
    })
  })
})
