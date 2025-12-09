import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { Request, Response } from 'express'

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

// Mock chat service
jest.mock('../../services/chatService', () => ({
  generateHistorySummary: jest.fn(),
  generateChatCompletionWithSummary: jest.fn(),
}))

import { continueConversation } from '../conversation.controller'
import { prisma } from '../../utils/prisma'
import { generateHistorySummary, generateChatCompletionWithSummary } from '../../services/chatService'

interface MockRequest {
  params: Record<string, string>
  body: Record<string, unknown>
  user?: { userId: string }
}

interface MockResponse {
  json: jest.Mock
  status: jest.Mock
  setHeader: jest.Mock
  write: jest.Mock
  end: jest.Mock
}

describe('continueConversation', () => {
  let mockReq: MockRequest
  let mockRes: MockResponse

  // Valid CUID format IDs (25+ alphanumeric chars)
  const validConversationId = 'clz1234567890abcdefghijkl'
  const validProjectId = 'clz1234567890projectidxyz'

  const mockUser = { userId: 'user-123' }
  const mockOtherUser = { userId: 'other-user-456' }
  const mockProjectOwner = { userId: 'owner-789' }

  const mockConversation = {
    id: validConversationId,
    projectId: validProjectId,
    shareLinkId: 'sharelink-1',
    savedByUserId: 'user-123',
    endedAt: null,
    summary: null,
    sentiment: null,
    topics: [],
    messages: [
      { role: 'assistant', content: 'Welcome message' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ],
    project: {
      id: validProjectId,
      ownerId: 'owner-789',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    }

    mockReq = {
      params: { id: validConversationId },
      body: { message: 'Test message' },
      user: mockUser,
    }
  })

  describe('Authorization', () => {
    it('should throw AuthorizationError if user is not authenticated', async () => {
      mockReq.user = undefined

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow()
    })

    it('should throw AuthorizationError if user is project owner but not savedByUser', async () => {
      mockReq.user = mockProjectOwner
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Only the user who saved this conversation can continue it')
    })

    it('should throw AuthorizationError if user is neither owner nor savedByUser', async () => {
      mockReq.user = mockOtherUser
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Only the user who saved this conversation can continue it')
    })

    it('should allow savedByUserId to continue conversation', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Hello'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    })
  })

  describe('Validation', () => {
    it('should throw ValidationError if message is empty', async () => {
      mockReq.body = { message: '' }

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Message is required')
    })

    it('should throw ValidationError if message is whitespace only', async () => {
      mockReq.body = { message: '   ' }

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Message is required')
    })

    it('should throw ValidationError for invalid conversation ID format', async () => {
      mockReq.params = { id: 'invalid-id!' }

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('Invalid conversation ID format')
    })

    it('should throw NotFoundError if conversation does not exist', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(
        continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })
  })

  describe('Re-activation of ended conversations', () => {
    it('should clear ended state when continuing an ended conversation', async () => {
      const endedConversation = {
        ...mockConversation,
        endedAt: new Date(),
        summary: 'Previous summary',
        sentiment: 'positive',
        topics: ['topic1', 'topic2'],
      }

      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(endedConversation as never)
      ;(prisma.conversation.update as jest.Mock).mockResolvedValue({} as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: validConversationId },
        data: {
          endedAt: null,
          summary: null,
          sentiment: null,
          topics: [],
        },
      })
    })

    it('should not update conversation if not already ended', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      // update should not be called for re-activation (only for message saving which is handled elsewhere)
      expect(prisma.conversation.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endedAt: null }),
        })
      )
    })
  })

  describe('History summarization', () => {
    it('should generate history summary for conversations with > 10 messages', async () => {
      const longConversation = {
        ...mockConversation,
        messages: Array.from({ length: 15 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        })),
      }

      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(longConversation as never)
      ;(generateHistorySummary as jest.Mock).mockResolvedValue('Summary of older messages' as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      // Should summarize older messages (first 5, keeping last 10)
      expect(generateHistorySummary).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'Message 0' }),
        ])
      )
      expect(generateHistorySummary).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          expect.objectContaining({ content: 'Message 14' }),
        ])
      )
    })

    it('should not generate history summary for short conversations', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(generateHistorySummary).not.toHaveBeenCalled()
    })

    it('should pass history summary to generateChatCompletionWithSummary', async () => {
      const longConversation = {
        ...mockConversation,
        messages: Array.from({ length: 12 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        })),
      }

      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(longConversation as never)
      ;(generateHistorySummary as jest.Mock).mockResolvedValue('Conversation history summary' as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(generateChatCompletionWithSummary).toHaveBeenCalledWith(
        validProjectId,
        validConversationId,
        'Test message',
        'Conversation history summary',
        { stream: true }
      )
    })

    it('should pass null history summary for short conversations', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(generateChatCompletionWithSummary).toHaveBeenCalledWith(
        validProjectId,
        validConversationId,
        'Test message',
        null,
        { stream: true }
      )
    })
  })

  describe('SSE Streaming', () => {
    it('should set correct SSE headers', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
    })

    it('should stream chunks to client', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Hello'
          yield ' world'
          yield '!'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"Hello"}\n\n')
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":" world"}\n\n')
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"!"}\n\n')
    })

    it('should send done event after streaming completes', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Response'
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.write).toHaveBeenCalledWith('data: {"done":true}\n\n')
      expect(mockRes.end).toHaveBeenCalled()
    })

    it('should send error event if streaming fails', async () => {
      ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation as never)
      ;(generateChatCompletionWithSummary as jest.Mock).mockResolvedValue(
        (async function* () {
          yield 'Starting...'
          throw new Error('LLM error')
        })() as never
      )

      await continueConversation(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"LLM error"}\n\n')
      expect(mockRes.end).toHaveBeenCalled()
    })
  })
})
