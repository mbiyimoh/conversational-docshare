import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import { FileText, Download, Loader2, MessageSquarePlus } from 'lucide-react'

interface DocumentChunk {
  id: string
  content: string
  sectionId: string | null
  sectionTitle: string | null
  chunkIndex: number
}

interface SectionedContent {
  sectionId: string | null
  sectionTitle: string | null
  chunks: DocumentChunk[]
}

interface TextSelection {
  chunkId: string
  startOffset: number
  endOffset: number
  text: string
  position: { x: number; y: number }
}

interface DocumentContentViewerProps {
  documentId: string
  shareSlug: string
  highlightSectionId?: string | null
  highlightKey?: number
  isCollaborator?: boolean
  onAddComment?: (selection: { chunkId: string; startOffset: number; endOffset: number; text: string }) => void
}

export function DocumentContentViewer({
  documentId,
  shareSlug,
  highlightSectionId,
  highlightKey = 0,
  isCollaborator = false,
  onAddComment,
}: DocumentContentViewerProps) {
  const [docData, setDocData] = useState<{ title: string; filename: string } | null>(null)
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null)

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const chunkRefs = useRef<Map<string, HTMLElement>>(new Map())
  const highlightedRef = useRef<HTMLElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Load document metadata and chunks
  useEffect(() => {
    loadDocument()
  }, [documentId, shareSlug])

  // Handle highlight when section changes
  useEffect(() => {
    if (highlightSectionId && !loading) {
      scrollToAndHighlight(highlightSectionId)
    }
  }, [highlightSectionId, highlightKey, loading])

  // Handle text selection for collaborators
  const handleTextSelection = useCallback(() => {
    if (!isCollaborator || !onAddComment) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setTextSelection(null)
      return
    }

    const selectedText = selection.toString().trim()
    if (selectedText.length < 3) {
      setTextSelection(null)
      return
    }

    // Find which chunk the selection is in
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer

    // Walk up to find the chunk container
    let chunkElement: HTMLElement | null = null
    let node: Node | null = container
    while (node && node !== scrollContainerRef.current) {
      if (node instanceof HTMLElement && node.dataset.chunkId) {
        chunkElement = node
        break
      }
      node = node.parentNode
    }

    if (!chunkElement) {
      setTextSelection(null)
      return
    }

    const chunkId = chunkElement.dataset.chunkId!
    const chunk = chunks.find(c => c.id === chunkId)
    if (!chunk) {
      setTextSelection(null)
      return
    }

    // Calculate offset using DOM Range API for accurate positioning
    // This handles cases where the same text appears multiple times
    const calculateTextOffset = (container: HTMLElement, range: Range): number => {
      const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      )
      let offset = 0
      let node: Node | null
      while ((node = treeWalker.nextNode())) {
        if (node === range.startContainer) {
          return offset + range.startOffset
        }
        offset += (node.textContent || '').length
      }
      return -1
    }

    const startOffset = calculateTextOffset(chunkElement, range)
    if (startOffset === -1) {
      setTextSelection(null)
      return
    }

    // Get position for the popup
    const rect = range.getBoundingClientRect()
    const containerRect = scrollContainerRef.current?.getBoundingClientRect()

    setTextSelection({
      chunkId,
      startOffset,
      endOffset: startOffset + selectedText.length,
      text: selectedText,
      position: {
        x: rect.left - (containerRect?.left || 0) + rect.width / 2,
        y: rect.top - (containerRect?.top || 0) - 10,
      },
    })
  }, [isCollaborator, onAddComment, chunks])

  // Clear selection when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.comment-popover')) {
        setTextSelection(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadDocument = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch document metadata
      const response = await api.getShareLinkDocument(shareSlug, documentId)
      setDocData({
        title: response.document.title,
        filename: response.document.filename,
      })

      // Fetch document chunks for content rendering
      const chunksData = await api.getShareLinkDocumentChunks(shareSlug, documentId)
      setChunks(chunksData.chunks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const scrollToAndHighlight = useCallback((sectionId: string) => {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const element = sectionRefs.current.get(sectionId)
      const container = scrollContainerRef.current
      if (!element || !container) {
        console.warn(`Section ${sectionId} or container not found`)
        return
      }

      // Remove previous highlight
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove('citation-highlight')
      }

      // Manual scroll calculation - only scrolls the container, not the viewport
      // Get element position relative to the scroll container
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Calculate where element is relative to container's current scroll position
      const elementTop = elementRect.top - containerRect.top + container.scrollTop

      // Center the element in the container
      const targetScroll = elementTop - (container.clientHeight / 2) + (element.clientHeight / 2)

      // Smooth scroll the container only
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      })

      // Apply highlight after scroll
      setTimeout(() => {
        element.classList.add('citation-highlight')
        highlightedRef.current = element

        // Remove highlight after animation
        setTimeout(() => {
          element.classList.remove('citation-highlight')
          if (highlightedRef.current === element) {
            highlightedRef.current = null
          }
        }, 3000)
      }, 300)
    }, 150)
  }, [])

  // Group chunks by section for better rendering
  const sectionedContent = groupChunksBySectionId(chunks)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <span className="ml-3 text-muted">Loading document...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-warning mb-4">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card-bg min-h-0">
      {/* Document Header */}
      <div className="p-4 border-b border-border shrink-0 min-h-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-accent" />
            <div>
              <h2 className="text-xl font-display text-foreground">{docData?.title}</h2>
              <p className="text-sm text-dim">{docData?.filename}</p>
            </div>
          </div>
          <button
            onClick={() => {
              // Open download in new tab via API
              const url = `${import.meta.env.VITE_API_URL || ''}/api/documents/${documentId}/download`
              window.open(url, '_blank')
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-background text-sm rounded hover:opacity-90 transition-opacity shrink-0"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 relative"
        style={{ overscrollBehavior: 'contain' }}
        onMouseUp={handleTextSelection}
      >
        <div className="max-w-none p-6">
          {sectionedContent.map((section, idx) => (
            <section
              key={section.sectionId || `chunk-${idx}`}
              id={`section-${section.sectionId}`}
              ref={(el) => {
                if (el && section.sectionId) {
                  sectionRefs.current.set(section.sectionId, el)
                }
              }}
              className="mb-8 scroll-mt-20"
            >
              {section.sectionTitle && (
                <h2 className="text-xl font-display text-foreground mb-4 pb-2 border-b border-border">
                  {section.sectionTitle}
                </h2>
              )}

              <div className="text-muted leading-relaxed">
                {section.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    data-chunk-id={chunk.id}
                    ref={(el) => {
                      if (el) chunkRefs.current.set(chunk.id, el)
                    }}
                    className="mb-4 prose prose-invert max-w-none"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {chunk.content}
                    </ReactMarkdown>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Text Selection Popover for Collaborators */}
          {textSelection && isCollaborator && onAddComment && (
            <div
              className="comment-popover absolute z-50 bg-background-elevated rounded-lg shadow-lg border border-border p-1 backdrop-blur-sm"
              style={{
                left: textSelection.position.x,
                top: textSelection.position.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <button
                onClick={() => {
                  onAddComment({
                    chunkId: textSelection.chunkId,
                    startOffset: textSelection.startOffset,
                    endOffset: textSelection.endOffset,
                    text: textSelection.text,
                  })
                  setTextSelection(null)
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-accent hover:bg-card-bg rounded transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
                Add Comment
              </button>
            </div>
          )}

          {chunks.length === 0 && (
            <div className="text-center text-dim py-8">
              No content available for this document
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to group consecutive chunks by section
function groupChunksBySectionId(chunks: DocumentChunk[]): SectionedContent[] {
  const sections: SectionedContent[] = []
  let currentSection: SectionedContent | null = null

  for (const chunk of chunks) {
    if (!currentSection || currentSection.sectionId !== chunk.sectionId) {
      currentSection = {
        sectionId: chunk.sectionId,
        sectionTitle: chunk.sectionTitle,
        chunks: [],
      }
      sections.push(currentSection)
    }
    currentSection.chunks.push(chunk)
  }

  return sections
}
