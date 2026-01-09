import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import { FileText, Download, Loader2, MessageSquarePlus } from 'lucide-react'
import { PaperContainer } from './ui/PaperContainer'
import { useViewerPreferencesContext } from './viewer-prefs'

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
  onCommentSubmit?: (data: {
    chunkId: string
    startOffset: number
    endOffset: number
    text: string
    content: string
  }) => Promise<void>
}

// Inline Comment Popup Component
interface InlineCommentPopupProps {
  selection: TextSelection
  onSubmit: (content: string) => Promise<void>
  onCancel: () => void
  containerRect: DOMRect | null
}

function InlineCommentPopup({ selection, onSubmit, onCancel, containerRect }: InlineCommentPopupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keyboard accessibility: Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isExpanded])

  // Calculate position with viewport boundary detection
  const position = useMemo(() => {
    let x = selection.position.x
    const y = selection.position.y

    // Ensure popup stays within container bounds
    if (containerRect) {
      const popupWidth = isExpanded ? 320 : 140
      const minX = popupWidth / 2 + 8
      const maxX = containerRect.width - popupWidth / 2 - 8
      x = Math.max(minX, Math.min(maxX, x))
    }

    return { x, y }
  }, [selection.position, containerRect, isExpanded])

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Comment cannot be empty')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit(content.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      ref={popupRef}
      role="dialog"
      aria-label={isExpanded ? "Add comment form" : "Comment on selected text"}
      aria-modal="false"
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 5 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className="comment-popover absolute z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Caret pointing to selection */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0
        border-l-[8px] border-l-transparent
        border-r-[8px] border-r-transparent
        border-t-[8px] border-t-card-bg" />

      <div className="bg-card-bg backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // Collapsed: Just the button
            <motion.button
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-accent hover:bg-background-elevated transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Comment
            </motion.button>
          ) : (
            // Expanded: Inline form
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-80 p-4"
            >
              {/* Selected text preview */}
              <div className="mb-3 pb-2 border-b border-border">
                <div className="text-[10px] font-mono text-accent uppercase tracking-wider mb-1">
                  Commenting on:
                </div>
                <div className="text-sm text-muted italic line-clamp-2">
                  &quot;{selection.text}&quot;
                </div>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your comment..."
                aria-label="Comment text"
                className="w-full h-20 px-3 py-2 text-sm bg-background border border-border rounded-lg
                  text-foreground placeholder:text-muted resize-none
                  focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />

              {error && (
                <p className="text-xs text-red-400 mt-1">{error}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !content.trim()}
                  className="px-4 py-1.5 text-sm font-medium bg-accent text-background rounded-md
                    hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function DocumentContentViewer({
  documentId,
  shareSlug,
  highlightSectionId,
  highlightKey = 0,
  isCollaborator = false,
  onCommentSubmit,
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

  // Get viewer preferences for paper mode
  const { preferences } = useViewerPreferencesContext()
  const isPaperMode = preferences.paperMode

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
    if (!isCollaborator || !onCommentSubmit) return

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
  }, [isCollaborator, onCommentSubmit, chunks])

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
              <h2 className="text-xl font-display text-foreground">{docData?.filename}</h2>
              {docData?.title && docData.title !== docData.filename && (
                <p className="text-sm text-dim">{docData.title}</p>
              )}
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
        className={`flex-1 overflow-y-auto min-h-0 relative ${isPaperMode ? 'p-4 bg-background-elevated' : ''}`}
        style={{ overscrollBehavior: 'contain' }}
        onMouseUp={handleTextSelection}
      >
        {isPaperMode ? (
          // Paper mode: wrap content in PaperContainer with prose classes
          <PaperContainer
            className="prose prose-lg max-w-none
              prose-headings:font-display prose-headings:text-[#1a1a1a]
              prose-p:text-[#333333] prose-p:leading-relaxed
              prose-li:text-[#333333]
              prose-strong:text-[#1a1a1a] prose-strong:font-semibold
              prose-a:text-[#8B7355] prose-a:underline
              prose-blockquote:border-l-[#C4A77D] prose-blockquote:text-[#555555]
              prose-code:bg-[#E8E4DE] prose-code:text-[#333333] prose-code:rounded prose-code:px-1.5
              prose-pre:bg-[#E8E4DE]
              prose-hr:border-[#D9D9D9]"
          >
            {sectionedContent.map((section, idx) => (
              <section
                key={section.sectionId || `chunk-${idx}`}
                id={`section-${section.sectionId}`}
                ref={(el) => {
                  if (el && section.sectionId) {
                    sectionRefs.current.set(section.sectionId, el)
                  }
                }}
                className="mb-10 scroll-mt-20"
              >
                {section.sectionTitle && (
                  <h2
                    className="text-xl font-display text-[#1a1a1a] mb-5 pb-2 border-b border-[#D9D9D9]"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {section.sectionTitle}
                  </h2>
                )}

                {/* Enhanced typography for document content - paper mode specific colors */}
                <div
                  className="text-[#333333] document-content"
                  style={{
                    lineHeight: 'var(--leading-document, 1.7)',
                  }}
                >
                  {section.chunks.map((chunk) => {
                    const displayContent = stripDuplicateHeading(chunk.content, section.sectionTitle)

                    return (
                      <div
                        key={chunk.id}
                        data-chunk-id={chunk.id}
                        ref={(el) => {
                          if (el) chunkRefs.current.set(chunk.id, el)
                        }}
                        className="mb-5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                          [&>p]:mb-[1.25em] [&>p:last-child]:mb-0
                          [&>ul]:my-4 [&>ul]:ml-4 [&>ul]:space-y-2
                          [&>ol]:my-4 [&>ol]:ml-4 [&>ol]:space-y-2
                          [&_ul_ul]:ml-6 [&_ol_ol]:ml-6 [&_ul_ol]:ml-6 [&_ol_ul]:ml-6
                          [&_ul_ul_ul]:ml-6 [&_ol_ol_ol]:ml-6
                          [&>li]:relative [&>li]:pl-6
                          [&>blockquote]:border-l-2 [&>blockquote]:border-[#C4A77D] [&>blockquote]:pl-4 [&>blockquote]:my-4 [&>blockquote]:italic [&>blockquote]:text-[#555555]
                          [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:text-[#1a1a1a]
                          [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:text-[#1a1a1a]
                          [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mt-5 [&>h3]:mb-2 [&>h3]:text-[#1a1a1a]
                          [&>h4]:text-base [&>h4]:font-medium [&>h4]:mt-4 [&>h4]:mb-2 [&>h4]:text-[#555555]
                          [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:bg-[#E8E4DE] [&>pre]:overflow-x-auto [&>pre]:text-sm [&>pre]:my-4
                          [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:bg-[#E8E4DE] [&>code]:text-[0.9em] [&>code]:font-mono [&>code]:text-[#333333]
                          [&>table]:w-full [&>table]:text-sm [&>table]:border-collapse [&>table]:my-4
                          [&>table_th]:px-3 [&>table_th]:py-2 [&>table_th]:text-left [&>table_th]:font-semibold [&>table_th]:border-b [&>table_th]:border-[#D9D9D9]
                          [&>table_td]:px-3 [&>table_td]:py-2 [&>table_td]:border-b [&>table_td]:border-[#D9D9D9]/50
                          [&_strong]:font-semibold [&_strong]:text-[#1a1a1a]
                          [&_em]:italic
                          [&_a]:text-[#8B7355] [&_a]:underline [&_a]:hover:no-underline"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {displayContent}
                        </ReactMarkdown>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}

            {/* Text Selection Popover for Collaborators */}
            <AnimatePresence>
              {textSelection && isCollaborator && onCommentSubmit && (
                <InlineCommentPopup
                  selection={textSelection}
                  containerRect={scrollContainerRef.current?.getBoundingClientRect() || null}
                  onSubmit={async (content) => {
                    await onCommentSubmit({
                      chunkId: textSelection.chunkId,
                      startOffset: textSelection.startOffset,
                      endOffset: textSelection.endOffset,
                      text: textSelection.text,
                      content,
                    })
                    setTextSelection(null)
                  }}
                  onCancel={() => setTextSelection(null)}
                />
              )}
            </AnimatePresence>

            {chunks.length === 0 && (
              <div className="text-center text-dim py-8">
                No content available for this document
              </div>
            )}
          </PaperContainer>
        ) : (
          // Dark mode: existing styling
          <div
            className="p-6 mx-auto"
            style={{
              maxWidth: 'var(--max-line-document, 72ch)',
              lineHeight: 'var(--leading-document, 1.7)',
              letterSpacing: 'var(--letter-spacing-body, 0.01em)',
            }}
          >
            {sectionedContent.map((section, idx) => (
              <section
                key={section.sectionId || `chunk-${idx}`}
                id={`section-${section.sectionId}`}
                ref={(el) => {
                  if (el && section.sectionId) {
                    sectionRefs.current.set(section.sectionId, el)
                  }
                }}
                className="mb-10 scroll-mt-20"
              >
                {section.sectionTitle && (
                  <h2
                    className="text-xl font-display text-foreground mb-5 pb-2 border-b border-border"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {section.sectionTitle}
                  </h2>
                )}

                {/* Enhanced typography for document content */}
                <div
                  className="text-foreground/90 document-content"
                  style={{
                    lineHeight: 'var(--leading-document, 1.7)',
                  }}
                >
                  {section.chunks.map((chunk) => {
                    const displayContent = stripDuplicateHeading(chunk.content, section.sectionTitle)

                    return (
                      <div
                        key={chunk.id}
                        data-chunk-id={chunk.id}
                        ref={(el) => {
                          if (el) chunkRefs.current.set(chunk.id, el)
                        }}
                        className="mb-5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                          [&>p]:mb-[1.25em] [&>p:last-child]:mb-0
                          [&>ul]:my-4 [&>ul]:ml-4 [&>ul]:space-y-2
                          [&>ol]:my-4 [&>ol]:ml-4 [&>ol]:space-y-2
                          [&_ul_ul]:ml-6 [&_ol_ol]:ml-6 [&_ul_ol]:ml-6 [&_ol_ul]:ml-6
                          [&_ul_ul_ul]:ml-6 [&_ol_ol_ol]:ml-6
                          [&>li]:relative [&>li]:pl-6
                          [&>blockquote]:border-l-2 [&>blockquote]:border-accent/50 [&>blockquote]:pl-4 [&>blockquote]:my-4 [&>blockquote]:italic [&>blockquote]:text-muted
                          [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-8 [&>h1]:mb-4
                          [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-3
                          [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mt-5 [&>h3]:mb-2
                          [&>h4]:text-base [&>h4]:font-medium [&>h4]:mt-4 [&>h4]:mb-2 [&>h4]:text-muted
                          [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:bg-muted/20 [&>pre]:overflow-x-auto [&>pre]:text-sm [&>pre]:my-4
                          [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:bg-muted/30 [&>code]:text-[0.9em] [&>code]:font-mono
                          [&>table]:w-full [&>table]:text-sm [&>table]:border-collapse [&>table]:my-4
                          [&>table_th]:px-3 [&>table_th]:py-2 [&>table_th]:text-left [&>table_th]:font-semibold [&>table_th]:border-b [&>table_th]:border-border
                          [&>table_td]:px-3 [&>table_td]:py-2 [&>table_td]:border-b [&>table_td]:border-border/50
                          [&_strong]:font-semibold [&_strong]:text-foreground
                          [&_em]:italic
                          [&_a]:text-accent [&_a]:underline [&_a]:hover:no-underline"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {displayContent}
                        </ReactMarkdown>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}

            {/* Text Selection Popover for Collaborators */}
            <AnimatePresence>
              {textSelection && isCollaborator && onCommentSubmit && (
                <InlineCommentPopup
                  selection={textSelection}
                  containerRect={scrollContainerRef.current?.getBoundingClientRect() || null}
                  onSubmit={async (content) => {
                    await onCommentSubmit({
                      chunkId: textSelection.chunkId,
                      startOffset: textSelection.startOffset,
                      endOffset: textSelection.endOffset,
                      text: textSelection.text,
                      content,
                    })
                    setTextSelection(null)
                  }}
                  onCancel={() => setTextSelection(null)}
                />
              )}
            </AnimatePresence>

            {chunks.length === 0 && (
              <div className="text-center text-dim py-8">
                No content available for this document
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper to strip duplicate heading from chunk content if it matches section title
function stripDuplicateHeading(content: string, sectionTitle: string | null): string {
  if (!sectionTitle) return content

  let displayContent = content
  const sectionTitleNormalized = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Try 1: Match markdown headings at start: # Heading, ## Heading, etc.
  const markdownMatch = displayContent.match(/^(#{1,6})\s+(.+?)(\n|$)/)
  if (markdownMatch) {
    const headingNormalized = markdownMatch[2].trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (sectionTitleNormalized === headingNormalized ||
        sectionTitleNormalized.includes(headingNormalized) ||
        headingNormalized.includes(sectionTitleNormalized)) {
      displayContent = displayContent.replace(/^#{1,6}\s+.+?\n*/, '').trim()
    }
  }

  // Try 2: Match plain text heading (first line matches section title)
  const firstLine = displayContent.split('\n')[0]?.trim()
  if (firstLine) {
    const firstLineNormalized = firstLine.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (firstLineNormalized && (
        sectionTitleNormalized === firstLineNormalized ||
        (firstLineNormalized.length > 3 && sectionTitleNormalized.includes(firstLineNormalized)) ||
        (sectionTitleNormalized.length > 3 && firstLineNormalized.includes(sectionTitleNormalized)))) {
      // Use [^\n]+ (greedy non-newline chars) instead of .+? (non-greedy any char)
      // .+? matches only 1 char minimum, leaving "ECITALS" when stripping "RECITALS"
      displayContent = displayContent.replace(/^[^\n]+\n*/, '').trim()
    }
  }

  return displayContent
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
