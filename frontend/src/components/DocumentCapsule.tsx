import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from './ui'
import { cn } from '../lib/utils'
import { useViewerPreferencesContext } from './viewer-prefs'

interface DocumentOutlineSection {
  id: string
  title: string
  level: number
  position: number
}

interface DocumentInfo {
  id: string
  filename: string
  title: string
  summary?: string
  outline?: DocumentOutlineSection[]
}

interface DocumentCapsuleProps {
  documents: DocumentInfo[]
  projectName: string
  onDocumentClick: (documentId: string) => void
  onSectionClick: (documentId: string, sectionId: string) => void
}

export function DocumentCapsule({
  documents,
  projectName,
  onDocumentClick,
  onSectionClick,
}: DocumentCapsuleProps) {
  // Track which documents are expanded
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

  // Get paper mode preference
  const { preferences } = useViewerPreferencesContext()
  const isPaperMode = preferences.paperMode

  const toggleExpanded = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-background-elevated min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          Document Capsule
        </h2>
        <p className="text-sm text-muted mt-1">{projectName}</p>
      </div>

      {/* Document List */}
      <div
        className="flex-1 overflow-y-auto p-4 min-h-0"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div
          className={cn(
            'space-y-2',
            isPaperMode && 'bg-[#F5F3EF] rounded-lg p-4 shadow-md'
          )}
        >
          {documents.map((doc) => {
            const isExpanded = expandedDocs.has(doc.id)
            return (
              <Card
                key={doc.id}
                className={cn(
                  'p-0 overflow-hidden',
                  isPaperMode
                    ? 'bg-white border-[#E0DCD6] hover:border-[#C4A77D] text-[#333333]'
                    : 'bg-card-bg border-border hover:border-accent/50 text-foreground'
                )}
              >
                {/* Document Header (clickable to expand) */}
                <button
                  onClick={() => toggleExpanded(doc.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 text-left transition-colors",
                    isPaperMode ? "hover:bg-[#E8E4DE]" : "hover:bg-white/5"
                  )}
                >
                  <FileText className={cn(
                    "w-5 h-5 shrink-0 mt-0.5",
                    isPaperMode ? "text-[#8B7355]" : "text-accent"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-display",
                      isPaperMode ? "text-[#333333]" : "text-foreground"
                    )}>
                      {doc.filename}
                    </div>
                    {doc.summary && (
                      <p className="text-sm text-muted mt-1 line-clamp-2">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted shrink-0" />
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className={cn(
                    "px-4 pb-4 border-t",
                    isPaperMode
                      ? "border-[#E0DCD6] bg-[#FAF9F7]"
                      : "border-border bg-background"
                  )}>
                    {/* View Full Document Button */}
                    <button
                      onClick={() => onDocumentClick(doc.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 mt-3 rounded-lg text-sm font-medium transition-colors",
                        isPaperMode
                          ? "bg-[#8B7355]/10 text-[#8B7355] hover:bg-[#8B7355]/20"
                          : "bg-accent/10 text-accent hover:bg-accent/20"
                      )}
                    >
                      View Full Document
                    </button>

                    {/* Outline Sections */}
                    {doc.outline && doc.outline.length > 0 && (
                      <div className="mt-3">
                        <div className={cn(
                          "text-xs uppercase tracking-wide mb-2 px-1 font-mono",
                          isPaperMode ? "text-[#666666]" : "text-dim"
                        )}>
                          Sections
                        </div>
                        <div className="space-y-1">
                          {doc.outline.map((section) => (
                            <button
                              key={section.id}
                              onClick={() => onSectionClick(doc.id, section.id)}
                              className={cn(
                                "w-full text-left px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors",
                                isPaperMode
                                  ? "text-[#555555] hover:bg-[#E8E4DE] hover:text-[#333333]"
                                  : "text-muted hover:bg-card-bg hover:text-foreground"
                              )}
                              style={{ paddingLeft: `${(section.level - 1) * 12 + 12}px` }}
                            >
                              <ChevronRight className={cn(
                                "w-3 h-3 shrink-0",
                                isPaperMode ? "text-[#8B7355]" : "text-accent"
                              )} />
                              <span className="truncate">{section.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!doc.outline || doc.outline.length === 0) && (
                      <p className={cn(
                        "mt-3 text-sm italic px-1",
                        isPaperMode ? "text-[#666666]" : "text-dim"
                      )}>
                        No sections available
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {documents.length === 0 && (
          <div className="text-center text-muted py-8">
            No documents in this capsule
          </div>
        )}
      </div>
    </div>
  )
}
