/**
 * Shared Markdown Configuration
 *
 * Provides consistent markdown rendering configuration across chat components.
 * Used by ChatMessage, DojoChat, and other message rendering contexts.
 *
 * Typography optimized for dark mode readability with elite design standards:
 * - Line-height: 1.65 for optimal reading
 * - Paragraph spacing: 1.25em for visual breathing room
 * - Letter-spacing: 0.01em for character separation
 * - Max-width: 66ch for optimal line length
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
 * Provides consistent styling across all chat contexts with elite typography
 */
export function createMarkdownComponents({
  isUser,
  renderLink,
}: MarkdownComponentsOptions): Components {
  // Base text style classes for optimal dark mode reading
  const textStyle = {
    lineHeight: 'var(--leading-chat, 1.65)',
    letterSpacing: 'var(--letter-spacing-body, 0.01em)',
  }

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

    // Paragraphs - proper spacing for readability
    p: ({ children }) => (
      <p
        className="mb-[1.25em] last:mb-0"
        style={textStyle}
      >
        {children}
      </p>
    ),

    // Inline code
    code: ({ className, children }) => {
      const isInline = !className
      if (isInline) {
        return (
          <code
            className={cn(
              'px-1.5 py-0.5 rounded text-[0.9em] font-mono',
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
          'p-4 rounded-lg overflow-x-auto text-sm my-4',
          isUser ? 'bg-background/20' : 'bg-muted/20'
        )}
      >
        {children}
      </pre>
    ),

    // Unordered lists - proper spacing and visual hierarchy with nesting support
    ul: ({ children }) => (
      <ul className="my-4 ml-4 space-y-2 list-none [&_ul]:ml-6 [&_ul]:mt-2 [&_ol]:ml-6 [&_ol]:mt-2">
        {children}
      </ul>
    ),

    // Ordered lists - proper spacing and visual hierarchy with nesting support
    ol: ({ children }) => (
      <ol className="my-4 ml-4 space-y-2 list-none counter-reset-item [&_ul]:ml-6 [&_ul]:mt-2 [&_ol]:ml-6 [&_ol]:mt-2">
        {children}
      </ol>
    ),

    // List items - clear visual separation with custom bullets
    li: ({ children, ...props }) => {
      // Check if it's part of an ordered list (has index prop)
      const isOrdered = typeof (props as { index?: number }).index === 'number'
      const index = (props as { index?: number }).index ?? 0

      return (
        <li
          className="relative pl-6"
          style={textStyle}
        >
          {/* Custom bullet/number */}
          <span
            className={cn(
              'absolute left-0 top-0 select-none',
              isUser ? 'text-background/70' : 'text-accent'
            )}
          >
            {isOrdered ? `${index + 1}.` : '•'}
          </span>
          <span>{children}</span>
        </li>
      )
    },

    // Text formatting - clear weight hierarchy for emphasis
    strong: ({ children }) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,

    // Blockquotes - elegant styling with accent border
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          'border-l-2 pl-4 my-4 italic',
          isUser ? 'border-background/50 text-background/90' : 'border-accent/50 text-muted'
        )}
        style={textStyle}
      >
        {children}
      </blockquote>
    ),

    // Headings - clear visual hierarchy with varied font weights
    h1: ({ children }) => (
      <h1
        className="text-xl font-bold mt-6 mb-3 first:mt-0 text-foreground"
        style={{ letterSpacing: '-0.01em' }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className="text-lg font-semibold mt-5 mb-2.5 first:mt-0 text-foreground"
        style={{ letterSpacing: '-0.005em' }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className="text-base font-medium mt-4 mb-2 first:mt-0 text-foreground"
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-sm font-medium mt-4 mb-2 first:mt-0 uppercase tracking-wide text-muted">
        {children}
      </h4>
    ),

    // Horizontal rule - subtle separator
    hr: () => (
      <hr className="my-6 border-0 h-px bg-border" />
    ),

    // Tables - clean styling
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-border">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-medium text-muted">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 border-b border-border/50">
        {children}
      </td>
    ),
  }
}
