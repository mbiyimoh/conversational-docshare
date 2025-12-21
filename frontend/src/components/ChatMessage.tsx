import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/utils'
import { getSectionInfo, getDocumentDisplayName } from '../lib/documentLookup'
import { convertCitationsToNumbered, citationUrlTransform, parseCitationUrl } from '../lib/documentReferences'
import { createMarkdownComponents } from '../lib/markdownConfig'
import { ChatExpandButton } from './chat/ChatExpandButton'
import { CitationPill } from './chat/CitationPill'
import { CitationBlock, type Citation } from './chat/CitationBlock'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  messageId?: string
  isStreaming?: boolean
  isExpanded?: boolean
  isExpandLoading?: boolean
  onCitationClick?: (filename: string, sectionId: string) => void
  onExpand?: (messageId: string) => void
}

export function ChatMessage({
  role,
  content,
  timestamp,
  messageId,
  isStreaming = false,
  isExpanded = false,
  isExpandLoading = false,
  onCitationClick,
  onExpand
}: ChatMessageProps) {
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'

  // Track currently highlighted citation
  const [activeCitation, setActiveCitation] = useState<number | undefined>()

  // Show expand button for completed assistant messages that haven't been expanded
  const showExpandButton = isAssistant && !isStreaming && !isExpanded && messageId && onExpand

  // Convert citations to numbered format and collect citation data
  const { processedContent, citations } = useMemo(() => {
    const { content: processed, citations: collected } = convertCitationsToNumbered(content)

    // Enrich citations with document/section titles
    const enrichedCitations: Citation[] = collected.map((c) => {
      const sectionInfo = getSectionInfo(c.filename, c.sectionId)
      // If section lookup fails, still try to get document display name
      // This handles cases where section ID doesn't match but document exists
      const documentTitle = sectionInfo?.documentTitle || getDocumentDisplayName(c.filename)
      return {
        number: c.number,
        filename: c.filename,
        sectionId: c.sectionId,
        documentTitle: documentTitle || undefined,
        sectionTitle: sectionInfo?.sectionTitle,
      }
    })

    return { processedContent: processed, citations: enrichedCitations }
  }, [content])

  // Custom components for ReactMarkdown using shared config
  const markdownComponents = useMemo(
    () =>
      createMarkdownComponents({
        isUser,
        renderLink: ({ href, children }) => {
          // Check if this is a citation link
          const citation = parseCitationUrl(href || '')
          if (citation && citation.number !== undefined) {
            // Numbered citation pill
            return (
              <CitationPill
                number={citation.number}
                onClick={() => {
                  setActiveCitation(citation.number)
                  onCitationClick?.(citation.filename, citation.sectionId)
                  // Clear highlight after a delay
                  setTimeout(() => setActiveCitation(undefined), 2000)
                }}
                isUserMessage={isUser}
                isActive={activeCitation === citation.number}
              />
            )
          }

          // Regular link - use default rendering
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'underline hover:no-underline transition-colors',
                isUser ? 'text-background/90 hover:text-background' : 'text-accent hover:text-accent/80'
              )}
            >
              {children}
            </a>
          )
        },
      }),
    [onCitationClick, isUser, activeCitation]
  )

  const handleExpand = () => {
    if (messageId && onExpand) {
      onExpand(messageId)
    }
  }

  const handleCitationBlockClick = (filename: string, sectionId: string) => {
    // Find the citation number for highlighting
    const citation = citations.find(c => c.filename === filename && c.sectionId === sectionId)
    if (citation) {
      setActiveCitation(citation.number)
      setTimeout(() => setActiveCitation(undefined), 2000)
    }
    onCitationClick?.(filename, sectionId)
  }

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-accent text-background'
            : 'bg-card-bg border border-border text-foreground'
        )}
        style={{
          // Apply max line width for optimal reading
          maxWidth: 'min(80%, var(--max-line-chat, 66ch))',
        }}
      >
        {/* Message content with elite typography */}
        <div
          className="break-words"
          style={{
            lineHeight: 'var(--leading-chat, 1.65)',
            letterSpacing: 'var(--letter-spacing-body, 0.01em)',
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
            urlTransform={citationUrlTransform}
          >
            {processedContent}
          </ReactMarkdown>
        </div>

        {/* Citation block for assistant messages with citations */}
        {isAssistant && citations.length > 0 && (
          <CitationBlock
            citations={citations}
            onCitationClick={handleCitationBlockClick}
            activeCitation={activeCitation}
          />
        )}

        {/* Timestamp */}
        {timestamp && (
          <div
            className={cn(
              'mt-2 text-xs',
              isUser ? 'text-background/70' : 'text-muted'
            )}
          >
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Expand button for assistant messages */}
        {showExpandButton && (
          <ChatExpandButton
            onClick={handleExpand}
            disabled={isExpanded}
            isLoading={isExpandLoading}
          />
        )}
      </div>
    </div>
  )
}
