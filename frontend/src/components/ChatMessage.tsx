import { cn } from '../lib/utils'
import { splitMessageIntoParts } from '../lib/documentReferences'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  onCitationClick?: (filename: string, sectionId: string) => void
}

export function ChatMessage({ role, content, timestamp, onCitationClick }: ChatMessageProps) {
  const isUser = role === 'user'

  // Parse content for document references (only for assistant messages)
  const messageParts = !isUser ? splitMessageIntoParts(content) : [{ type: 'text' as const, content }]

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {messageParts.map((part, idx) => {
            if (part.type === 'text') {
              return <span key={idx}>{part.content}</span>
            } else if (part.type === 'reference' && part.reference) {
              return (
                <button
                  key={idx}
                  onClick={() => onCitationClick?.(part.reference!.filename, part.reference!.sectionId)}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline hover:no-underline font-medium mx-1"
                  title={`Open ${part.reference.filename}, section ${part.reference.sectionId}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {part.content}
                </button>
              )
            }
            return null
          })}
        </div>
        {timestamp && (
          <div
            className={cn(
              'mt-1 text-xs',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}
          >
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}
