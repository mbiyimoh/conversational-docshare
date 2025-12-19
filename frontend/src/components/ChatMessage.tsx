import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/utils'
import { getSectionInfo } from '../lib/documentLookup'
import { convertCitationsToMarkdownLinks, citationUrlTransform, parseCitationUrl } from '../lib/documentReferences'
import { createMarkdownComponents } from '../lib/markdownConfig'
import { ChatExpandButton } from './chat/ChatExpandButton'

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

/**
 * Citation button component for document references
 */
function CitationButton({
  filename,
  sectionId,
  onCitationClick,
  isUserMessage,
}: {
  filename: string
  sectionId: string
  onCitationClick?: (filename: string, sectionId: string) => void
  isUserMessage: boolean
}) {
  const sectionInfo = getSectionInfo(filename, sectionId)
  const displayText = sectionInfo
    ? `${sectionInfo.documentTitle}: ${sectionInfo.sectionTitle}`
    : filename

  return (
    <button
      onClick={() => onCitationClick?.(filename, sectionId)}
      className={cn(
        'inline-flex items-center gap-1 font-medium mx-1 transition-colors',
        isUserMessage
          ? 'text-background/90 hover:text-background underline hover:no-underline'
          : 'text-accent hover:text-accent/80 underline hover:no-underline'
      )}
      title={`Open ${filename}, section: ${sectionInfo?.sectionTitle || sectionId}`}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span className="break-words">{displayText}</span>
    </button>
  )
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

  // Show expand button for completed assistant messages that haven't been expanded
  const showExpandButton = isAssistant && !isStreaming && !isExpanded && messageId && onExpand

  // Convert citations to markdown links for processing
  const processedContent = useMemo(() => convertCitationsToMarkdownLinks(content), [content])

  // Custom components for ReactMarkdown using shared config
  const markdownComponents = useMemo(
    () =>
      createMarkdownComponents({
        isUser,
        renderLink: ({ href, children }) => {
          // Check if this is a citation link
          const citation = parseCitationUrl(href || '')
          if (citation) {
            return (
              <CitationButton
                filename={citation.filename}
                sectionId={citation.sectionId}
                onCitationClick={onCitationClick}
                isUserMessage={isUser}
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
    [onCitationClick, isUser]
  )

  const handleExpand = () => {
    if (messageId && onExpand) {
      onExpand(messageId)
    }
  }

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-accent text-background'
            : 'bg-card-bg border border-border text-foreground'
        )}
      >
        <div className="break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={citationUrlTransform}>
            {processedContent}
          </ReactMarkdown>
        </div>
        {timestamp && (
          <div
            className={cn(
              'mt-1 text-xs',
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
