import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/utils'
import { getSectionInfo } from '../lib/documentLookup'
import { splitMessageIntoParts, type MessagePart } from '../lib/documentReferences'
import { createMarkdownComponents } from '../lib/markdownConfig'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  onCitationClick?: (filename: string, sectionId: string) => void
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

/**
 * Renders a text part through ReactMarkdown
 */
function TextPart({ content, markdownComponents }: {
  content: string
  markdownComponents: ReturnType<typeof createMarkdownComponents>
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}

/**
 * Renders message content with interleaved markdown text and citation buttons.
 * This bypasses react-markdown's URL sanitization by rendering citations directly.
 */
function MessageContent({
  content,
  isUser,
  onCitationClick,
}: {
  content: string
  isUser: boolean
  onCitationClick?: (filename: string, sectionId: string) => void
}) {
  // Split message into text and citation parts
  const parts = useMemo(() => splitMessageIntoParts(content), [content])

  // Create markdown components for text parts (no citation handling needed here)
  const markdownComponents = useMemo(
    () =>
      createMarkdownComponents({
        isUser,
        renderLink: ({ href, children }) => {
          // Regular link rendering (citations are handled separately)
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
    [isUser]
  )

  // If no citations, render entire content through ReactMarkdown
  if (parts.length === 1 && parts[0].type === 'text') {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    )
  }

  // Render interleaved text and citation parts
  return (
    <>
      {parts.map((part: MessagePart, index: number) => {
        if (part.type === 'reference' && part.reference) {
          return (
            <CitationButton
              key={`citation-${index}`}
              filename={part.reference.filename}
              sectionId={part.reference.sectionId}
              onCitationClick={onCitationClick}
              isUserMessage={isUser}
            />
          )
        }
        // Text part - render through ReactMarkdown
        return (
          <TextPart
            key={`text-${index}`}
            content={part.content}
            markdownComponents={markdownComponents}
          />
        )
      })}
    </>
  )
}

export function ChatMessage({ role, content, timestamp, onCitationClick }: ChatMessageProps) {
  const isUser = role === 'user'

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
          <MessageContent
            content={content}
            isUser={isUser}
            onCitationClick={onCitationClick}
          />
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
      </div>
    </div>
  )
}
