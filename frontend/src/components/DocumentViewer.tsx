import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'

interface DocumentOutlineSection {
  id: string
  title: string
  level: number
  position: number
}

interface DocumentViewerProps {
  documentId: string
  highlightSectionId?: string
  highlightKey?: number // Key to force re-highlight on same section
  shareSlug?: string // If provided, use share link endpoint (public access)
  onClose?: () => void
}

const API_URL = import.meta.env.VITE_API_URL || ''

export function DocumentViewer({
  documentId,
  highlightSectionId,
  highlightKey = 0,
  shareSlug,
  onClose,
}: DocumentViewerProps) {
  const [document, setDocument] = useState<{
    title: string
    outline: DocumentOutlineSection[]
    mimeType: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(highlightSectionId || null)

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Track the currently highlighted element to remove animation class
  const highlightedElementRef = useRef<HTMLElement | null>(null)

  // Load document on mount or when documentId changes
  useEffect(() => {
    loadDocument()
  }, [documentId, shareSlug])

  // Handle highlight when section changes or highlight key changes (for re-highlighting same section)
  useEffect(() => {
    if (highlightSectionId) {
      scrollToAndHighlight(highlightSectionId)
    }
  }, [highlightSectionId, highlightKey])

  const loadDocument = async () => {
    setLoading(true)
    setError(null)

    try {
      if (shareSlug) {
        // Use share link endpoint (public access for viewers)
        const data = await api.getShareLinkDocument(shareSlug, documentId)
        setDocument({
          title: data.document.title,
          outline: data.document.outline,
          mimeType: data.document.mimeType,
        })
      } else {
        // Use authenticated endpoint
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!response.ok) {
          throw new Error('Failed to load document')
        }

        const data = await response.json()
        setDocument(data.document)
      }
    } catch (err) {
      console.error('Failed to load document:', err)
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Scroll to section and apply highlight animation
   */
  const scrollToAndHighlight = useCallback((sectionId: string) => {
    setSelectedSection(sectionId)

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const element = window.document.getElementById(`section-${sectionId}`)
      const container = scrollContainerRef.current

      if (!element) {
        console.warn(`Section ${sectionId} not found, cannot highlight`)
        return
      }

      if (!container) {
        console.warn('Scroll container not found')
        return
      }

      // Remove highlight from previously highlighted element
      if (highlightedElementRef.current) {
        highlightedElementRef.current.classList.remove('citation-highlight')
      }

      // Manual scroll calculation - only scrolls the container, not the viewport
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const elementTop = elementRect.top - containerRect.top + container.scrollTop
      const targetScroll = elementTop - (container.clientHeight / 2) + (element.clientHeight / 2)

      // Smooth scroll the container only
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      })

      // Apply highlight animation after scroll starts (300ms delay for smooth UX)
      setTimeout(() => {
        element.classList.add('citation-highlight')
        highlightedElementRef.current = element

        // Remove the class after animation completes (2.5s + buffer)
        setTimeout(() => {
          element.classList.remove('citation-highlight')
          if (highlightedElementRef.current === element) {
            highlightedElementRef.current = null
          }
        }, 3000)
      }, 300)
    }, 50)
  }, [])

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${API_URL}/api/documents/${documentId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document?.title || 'document'
      window.document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      window.document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download document:', err)
    }
  }

  const handleSectionClick = (sectionId: string) => {
    scrollToAndHighlight(sectionId)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading document...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <div className="text-red-500 mb-4">{error}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Close
          </button>
        )}
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-500">Failed to load document</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4 shrink-0">
        <h2 className="text-xl font-bold pr-8">{document.title}</h2>
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleDownload}
            className="rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700"
          >
            Download
          </button>
        </div>
      </div>

      {/* Document Outline */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        <h3 className="mb-4 font-semibold text-gray-700">Document Outline</h3>
        <div className="space-y-2">
          {document.outline.map((section) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className={`cursor-pointer rounded p-3 transition-colors ${
                selectedSection === section.id
                  ? 'bg-blue-100 border-l-4 border-blue-600'
                  : 'hover:bg-gray-50'
              }`}
              style={{ paddingLeft: `${(section.level - 1) * 16 + 12}px` }}
              onClick={() => handleSectionClick(section.id)}
              role="button"
              tabIndex={0}
              aria-label={`View section: ${section.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSectionClick(section.id)
                }
              }}
            >
              <div className="font-medium text-gray-900">{section.title}</div>
            </div>
          ))}
        </div>

        {document.outline.length === 0 && (
          <div className="text-gray-500">No outline available for this document</div>
        )}
      </div>

      {/* Document viewer note */}
      <div className="border-t bg-gray-50 p-4 text-sm text-gray-600 shrink-0">
        <p>
          Note: Full document preview requires PDF.js integration. Currently showing document outline.
          Use the Download button to view the complete document.
        </p>
      </div>
    </div>
  )
}
