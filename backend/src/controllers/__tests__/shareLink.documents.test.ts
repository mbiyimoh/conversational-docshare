import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { Request, Response } from 'express'

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    shareLink: { findUnique: jest.fn() },
    document: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}))

import { getShareLinkDocument, getShareLinkDocuments } from '../shareLink.controller'
import { prisma } from '../../utils/prisma'

interface MockRequest {
  params: Record<string, string>
  body: Record<string, unknown>
}

interface MockResponse {
  json: jest.Mock
  status: jest.Mock
}

describe('ShareLink Document Endpoints', () => {
  let mockReq: MockRequest
  let mockRes: MockResponse

  const mockShareLink = {
    id: 'share-1',
    slug: 'test-slug',
    isActive: true,
    expiresAt: null,
    maxViews: null,
    currentViews: 0,
    project: { id: 'project-1' },
  }

  const mockDocument = {
    id: 'doc-1',
    filename: 'test.pdf',
    title: 'Test Document',
    mimeType: 'application/pdf',
    outline: [
      { id: 'section-abc123', title: 'Introduction', level: 1, position: 0 },
      { id: 'section-def456', title: 'Details', level: 2, position: 1 },
    ],
    status: 'completed',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    }

    mockReq = {
      params: { slug: 'test-slug', documentId: 'doc-1' },
      body: {},
    }
  })

  describe('getShareLinkDocument', () => {
    it('should throw NotFoundError if share link not found', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue(null as never)

      await expect(
        getShareLinkDocument(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })

    it('should return 403 if share link is inactive', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue({
        ...mockShareLink,
        isActive: false,
      } as never)

      await getShareLinkDocument(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'LINK_INACTIVE',
          }),
        })
      )
    })

    it('should return 410 if share link is expired', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue({
        ...mockShareLink,
        expiresAt: expiredDate,
      } as never)

      await getShareLinkDocument(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'LINK_EXPIRED',
          }),
        })
      )
    })

    it('should throw NotFoundError if document not found', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue(mockShareLink as never)
      ;(prisma.document.findFirst as jest.Mock).mockResolvedValue(null as never)

      await expect(
        getShareLinkDocument(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })

    it('should return document with outline when valid', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue(mockShareLink as never)
      ;(prisma.document.findFirst as jest.Mock).mockResolvedValue(mockDocument as never)

      await getShareLinkDocument(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.json).toHaveBeenCalledWith({
        document: {
          id: mockDocument.id,
          filename: mockDocument.filename,
          title: mockDocument.title,
          mimeType: mockDocument.mimeType,
          outline: mockDocument.outline,
          status: mockDocument.status,
        },
      })
    })
  })

  describe('getShareLinkDocuments', () => {
    it('should throw NotFoundError if share link not found', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue(null as never)

      mockReq.params = { slug: 'test-slug' }

      await expect(
        getShareLinkDocuments(mockReq as unknown as Request, mockRes as unknown as Response)
      ).rejects.toThrow('not found')
    })

    it('should return 403 if share link is inactive', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue({
        ...mockShareLink,
        isActive: false,
      } as never)

      mockReq.params = { slug: 'test-slug' }

      await getShareLinkDocuments(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.status).toHaveBeenCalledWith(403)
    })

    it('should return all documents for the project', async () => {
      const mockDocuments = [
        mockDocument,
        { ...mockDocument, id: 'doc-2', filename: 'other.pdf', title: 'Other Document' },
      ]

      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue(mockShareLink as never)
      ;(prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments as never)

      mockReq.params = { slug: 'test-slug' }

      await getShareLinkDocuments(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(mockRes.json).toHaveBeenCalledWith({
        documents: expect.arrayContaining([
          expect.objectContaining({ id: 'doc-1' }),
          expect.objectContaining({ id: 'doc-2' }),
        ]),
      })
    })

    it('should order documents by uploadedAt', async () => {
      ;(prisma.shareLink.findUnique as jest.Mock).mockResolvedValue(mockShareLink as never)
      ;(prisma.document.findMany as jest.Mock).mockResolvedValue([mockDocument] as never)

      mockReq.params = { slug: 'test-slug' }

      await getShareLinkDocuments(mockReq as unknown as Request, mockRes as unknown as Response)

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { uploadedAt: 'asc' },
        })
      )
    })
  })
})
