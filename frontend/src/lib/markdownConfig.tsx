/**
 * Shared Markdown Configuration
 *
 * Provides consistent markdown rendering configuration across chat components.
 * Used by ChatMessage, DojoChat, and other message rendering contexts.
 */

import type { Components } from 'react-markdown'
import { cn } from './utils'

interface MarkdownComponentsOptions {
  /** Whether the message is from the user (affects styling) */
  isUser: boolean
  /** Custom link renderer (for handling citations) */
  renderLink?: (props: { href?: string; children?: React.ReactNode }) => React.ReactNode
}

/**
 * Creates markdown component overrides for ReactMarkdown
 * Provides consistent styling across all chat contexts
 */
export function createMarkdownComponents({
  isUser,
  renderLink,
}: MarkdownComponentsOptions): Components {
  return {
    // Link rendering - can be customized for citations
    a: ({ href, children }) => {
      // Try custom renderLink first
      if (renderLink) {
        const customResult = renderLink({ href, children })
        // If renderLink returns undefined, fall back to default
        if (customResult !== undefined) {
          return customResult
        }
      }
      // Default link rendering
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

    // Paragraphs - render as spans to work inline
    p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,

    // Inline code
    code: ({ className, children }) => {
      const isInline = !className
      if (isInline) {
        return (
          <code
            className={cn(
              'px-1.5 py-0.5 rounded text-sm font-mono',
              isUser ? 'bg-background/20 text-background' : 'bg-muted/30 text-foreground'
            )}
          >
            {children}
          </code>
        )
      }
      return <code className={cn('font-mono text-sm', className)}>{children}</code>
    },

    // Code blocks
    pre: ({ children }) => (
      <pre
        className={cn(
          'p-3 rounded-lg overflow-x-auto text-sm my-2',
          isUser ? 'bg-background/20' : 'bg-muted/20'
        )}
      >
        {children}
      </pre>
    ),

    // Lists
    ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,

    // Text formatting
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote
        className={cn('border-l-2 pl-3 my-2 italic', isUser ? 'border-background/50' : 'border-accent/50')}
      >
        {children}
      </blockquote>
    ),

    // Headings (scaled down for chat context)
    h1: ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-1">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
  }
}
