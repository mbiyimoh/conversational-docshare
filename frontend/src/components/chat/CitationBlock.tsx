/**
 * CitationBlock Component
 *
 * Collapsible block at the end of messages showing all citation sources.
 * Part of the Perplexity-style citation system for document references.
 */

import { useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface Citation {
  /** Citation number (1-based) */
  number: number
  /** Document filename */
  filename: string
  /** Section ID within document */
  sectionId: string
  /** Human-readable document title */
  documentTitle?: string
  /** Human-readable section title */
  sectionTitle?: string
}

interface CitationBlockProps {
  /** List of citations in this message */
  citations: Citation[]
  /** Click handler for individual citations */
  onCitationClick?: (filename: string, sectionId: string) => void
  /** Currently highlighted citation number */
  activeCitation?: number
}

export function CitationBlock({
  citations,
  onCitationClick,
  activeCitation,
}: CitationBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (citations.length === 0) return null

  return (
    <div className="mt-4 pt-3 border-t border-border/50">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full text-left',
          'text-xs text-muted hover:text-foreground',
          'transition-colors duration-150'
        )}
        aria-expanded={isExpanded}
        aria-controls="citation-list"
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="font-medium">
          {citations.length} source{citations.length !== 1 ? 's' : ''}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 ml-auto transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Citation list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="citation-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 space-y-1.5">
              {citations.map((citation) => (
                <li key={citation.number}>
                  <button
                    onClick={() =>
                      onCitationClick?.(citation.filename, citation.sectionId)
                    }
                    className={cn(
                      'flex items-start gap-2 w-full text-left',
                      'px-2 py-1.5 rounded-md',
                      'text-xs text-muted hover:text-foreground',
                      'hover:bg-accent/5 transition-colors duration-150',
                      'focus:outline-none focus:ring-1 focus:ring-accent/50',
                      activeCitation === citation.number &&
                        'bg-accent/10 text-foreground'
                    )}
                  >
                    {/* Citation number badge */}
                    <span
                      className={cn(
                        'flex-shrink-0 w-5 h-5',
                        'flex items-center justify-center',
                        'rounded bg-accent/20 text-accent',
                        'text-[10px] font-semibold'
                      )}
                    >
                      {citation.number}
                    </span>

                    {/* Citation details */}
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-foreground truncate">
                        {citation.documentTitle || citation.filename}
                      </span>
                      {citation.sectionTitle && (
                        <span className="block text-muted truncate">
                          {citation.sectionTitle}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
